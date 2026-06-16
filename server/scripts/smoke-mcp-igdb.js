#!/usr/bin/env node

const path = require('node:path');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const configuredBaseUrl = process.env.MCP_SMOKE_BASE_URL
  ? trimTrailingSlash(process.env.MCP_SMOKE_BASE_URL)
  : null;
const query = process.env.MCP_SMOKE_QUERY ?? 'CrossCode';
const limit = normalizeLimit(process.env.MCP_SMOKE_LIMIT);

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return 3;
  }

  return Math.min(Math.max(parsed, 1), 10);
}

function hasIgdbCredentials() {
  return Boolean(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET);
}

async function main() {
  if (!hasIgdbCredentials()) {
    console.error(
      'IGDB credentials are missing. Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET in server/.env before running this smoke test.',
    );
    process.exitCode = 1;
    return;
  }

  const temporaryServer = configuredBaseUrl
    ? null
    : await startTemporaryNestServer();
  const baseUrl = configuredBaseUrl ?? temporaryServer.baseUrl;

  // This intentionally calls the public MCP endpoint instead of IgdbService directly,
  // so it verifies JSON-RPC routing, tool execution, and IGDB response normalization together.
  const payload = {
    id: 'igdb-live-smoke',
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      arguments: {
        limit,
        preferenceTags: ['RETRO_PIXEL', 'STORY_DRIVEN'],
        query,
      },
      name: 'search_games',
    },
  };

  try {
    const response = await axios.post(`${baseUrl}/mcp`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20_000,
    });
    const structuredContent = response.data?.result?.structuredContent;

    if (!structuredContent) {
      throw new Error('MCP response did not include result.structuredContent.');
    }

    if (response.data?.result?.isError || structuredContent.error) {
      throw new Error(
        `MCP search_games failed with ${structuredContent.errorCode ?? 'unknown_error'}: ${structuredContent.error ?? 'no message'}`,
      );
    }

    const games = structuredContent.games;

    if (!Array.isArray(games) || games.length === 0) {
      throw new Error('MCP search_games returned zero IGDB games.');
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: configuredBaseUrl ? 'external-server' : 'temporary-nest-app',
          provider: structuredContent.provider,
          query,
          resultCount: games.length,
          firstGames: games.slice(0, 3).map((game) => ({
            genres: game.genres,
            platforms: game.platforms,
            releaseDate: game.releaseDate,
            sourceUrl: game.sourceUrl,
            title: game.title,
          })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 'no-response';
      console.error(`MCP IGDB smoke test failed. HTTP status: ${status}`);

      if (error.response?.data) {
        console.error(JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(error.message);
      }
    } else {
      console.error(
        error instanceof Error
          ? error.message
          : 'MCP IGDB smoke test failed with an unknown error.',
      );
    }

    process.exitCode = 1;
  } finally {
    if (temporaryServer) {
      await temporaryServer.close();
    }
  }
}

async function startTemporaryNestServer() {
  require('reflect-metadata');
  require('ts-node/register');
  require('tsconfig-paths/register');

  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../src/app.module');

  // Port 0 asks the OS for an unused local port, keeping the smoke test independent
  // from a manually running dev server on :3000.
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  await app.listen(0, '127.0.0.1');

  const address = app.getHttpServer().address();

  if (!address || typeof address === 'string') {
    await app.close();
    throw new Error('Temporary Nest app did not expose a TCP port.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => app.close(),
  };
}

void main();
