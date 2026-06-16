#!/usr/bin/env node

const path = require('node:path');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const configuredBaseUrl = process.env.STEAM_SMOKE_BASE_URL
  ? trimTrailingSlash(process.env.STEAM_SMOKE_BASE_URL)
  : null;
const demoEmail = process.env.DEMO_USER_EMAIL ?? 'demo@gaming-journal.club';
const demoPassword = process.env.DEMO_USER_PASSWORD ?? 'demo-password';
const smokeProfile =
  process.env.STEAM_SMOKE_PROFILE ?? '76561197960435530';

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function hasSteamApiKey() {
  return Boolean(process.env.STEAM_WEB_API_KEY);
}

async function main() {
  if (!hasSteamApiKey()) {
    console.error(
      'STEAM_WEB_API_KEY is missing. Add it to server/.env before running this smoke test.',
    );
    process.exitCode = 1;
    return;
  }

  const temporaryServer = configuredBaseUrl
    ? null
    : await startTemporaryNestServer();
  const baseUrl = configuredBaseUrl ?? temporaryServer.baseUrl;
  let cookie = '';
  let originalSteamId = null;

  try {
    const login = await axios.post(
      `${baseUrl}/auth/login`,
      { email: demoEmail, password: demoPassword },
      { timeout: 15_000 },
    );
    cookie = extractCookie(login.headers['set-cookie']);

    if (!cookie) {
      throw new Error('Login did not return an access_token cookie.');
    }

    const me = await axios.get(`${baseUrl}/auth/me`, {
      headers: { Cookie: cookie },
      timeout: 15_000,
    });
    originalSteamId = me.data?.steamId ?? null;

    // The smoke test uses the same route as the Profile page, then restores
    // the demo user's previous Steam link so repeated runs stay idempotent.
    const linked = await axios.post(
      `${baseUrl}/auth/steam/link`,
      { steamProfile: smokeProfile },
      {
        headers: { Cookie: cookie },
        timeout: 20_000,
      },
    );

    assertConnectedSteamProfile(linked.data, 'link response');

    const fetched = await axios.get(`${baseUrl}/auth/steam/profile`, {
      headers: { Cookie: cookie },
      timeout: 20_000,
    });

    assertConnectedSteamProfile(fetched.data, 'profile response');

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: configuredBaseUrl ? 'external-server' : 'temporary-nest-app',
          personaName: fetched.data.profile.personaName,
          profileUrl: fetched.data.profile.profileUrl,
          steamId: fetched.data.steamId,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    reportError(error);
    process.exitCode = 1;
  } finally {
    if (cookie) {
      await restoreOriginalSteamLink(baseUrl, cookie, originalSteamId);
    }

    if (temporaryServer) {
      await temporaryServer.close();
    }
  }
}

function extractCookie(setCookieHeader) {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader].filter(Boolean);

  return cookies
    .map((cookie) => cookie.split(';')[0])
    .filter((cookie) => cookie.startsWith('access_token='))
    .join('; ');
}

function assertConnectedSteamProfile(response, label) {
  if (!response?.connected || response.error || response.errorCode) {
    throw new Error(
      `Steam ${label} was not connected: ${response?.errorCode ?? 'unknown_error'} ${response?.error ?? ''}`.trim(),
    );
  }

  if (
    !response.steamId ||
    !response.profile?.steamId ||
    !response.profile?.personaName ||
    !response.profile?.profileUrl
  ) {
    throw new Error(`Steam ${label} did not include required profile fields.`);
  }
}

async function restoreOriginalSteamLink(baseUrl, cookie, originalSteamId) {
  try {
    if (originalSteamId) {
      await axios.post(
        `${baseUrl}/auth/steam/link`,
        { steamProfile: originalSteamId },
        {
          headers: { Cookie: cookie },
          timeout: 20_000,
        },
      );
      return;
    }

    await axios.delete(`${baseUrl}/auth/steam/link`, {
      headers: { Cookie: cookie },
      timeout: 15_000,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'unknown restore error';
    console.error(`Steam smoke cleanup failed: ${message}`);
  }
}

function reportError(error) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 'no-response';
    console.error(`Steam profile smoke test failed. HTTP status: ${status}`);

    if (error.response?.data) {
      console.error(JSON.stringify(error.response.data, null, 2));
      return;
    }

    console.error(error.message);
    return;
  }

  console.error(
    error instanceof Error
      ? error.message
      : 'Steam profile smoke test failed with an unknown error.',
  );
}

async function startTemporaryNestServer() {
  require('reflect-metadata');
  require('ts-node/register');
  require('tsconfig-paths/register');

  const { NestFactory } = require('@nestjs/core');
  const cookieParser = require('cookie-parser');
  const { AppModule } = require('../src/app.module');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  app.use(cookieParser());
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
