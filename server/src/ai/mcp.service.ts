import { Injectable } from '@nestjs/common';
import { IgdbService, SearchGamesInput } from './igdb.service';

type JsonRpcId = number | string | null;

type JsonRpcRequest = {
  id?: JsonRpcId;
  jsonrpc?: string;
  method?: string;
  params?: unknown;
};

type ToolCallParams = {
  arguments?: unknown;
  name?: unknown;
};

@Injectable()
export class McpService {
  constructor(private readonly igdbService: IgdbService) {}

  async handle(request: JsonRpcRequest) {
    if (request.jsonrpc !== '2.0' || !request.method) {
      return this.error(
        request.id ?? null,
        -32600,
        'Invalid JSON-RPC request.',
      );
    }

    if (request.method === 'initialize') {
      return this.result(request.id ?? null, {
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        protocolVersion: '2025-06-18',
        serverInfo: {
          name: 'gaming-journal-club-mcp',
          version: '0.1.0',
        },
      });
    }

    if (request.method === 'tools/list') {
      return this.result(request.id ?? null, {
        tools: [this.searchGamesToolDefinition()],
      });
    }

    if (request.method === 'tools/call') {
      return this.callTool(request.id ?? null, request.params);
    }

    return this.error(
      request.id ?? null,
      -32601,
      `Unsupported JSON-RPC method: ${request.method}`,
    );
  }

  private async callTool(id: JsonRpcId, params: unknown) {
    const toolParams = params as ToolCallParams;

    if (toolParams?.name !== 'search_games') {
      return this.error(
        id,
        -32602,
        `Unknown tool: ${String(toolParams?.name)}`,
      );
    }

    const input = this.parseSearchGamesInput(toolParams.arguments);

    if (!input) {
      return this.error(
        id,
        -32602,
        'search_games requires arguments.query as a non-empty string.',
      );
    }

    try {
      const result = await this.igdbService.searchGames(input);
      const isError = Boolean(result.error);

      // MCP clients can read structuredContent directly; the text block keeps the result readable in simpler clients.
      return this.result(id, {
        content: [
          {
            text: JSON.stringify(result, null, 2),
            type: 'text',
          },
        ],
        isError,
        structuredContent: result,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown IGDB search error.';
      const result = {
        error: message,
        errorCode: 'external_api_error',
        games: [],
        provider: 'igdb' as const,
      };

      return this.result(id, {
        content: [
          {
            text: JSON.stringify(result, null, 2),
            type: 'text',
          },
        ],
        isError: true,
        structuredContent: result,
      });
    }
  }

  private parseSearchGamesInput(
    argumentsValue: unknown,
  ): SearchGamesInput | null {
    if (!argumentsValue || typeof argumentsValue !== 'object') {
      return null;
    }

    const args = argumentsValue as Record<string, unknown>;
    const query = typeof args.query === 'string' ? args.query.trim() : '';

    if (!query) {
      return null;
    }

    return {
      limit: typeof args.limit === 'number' ? args.limit : undefined,
      preferenceTags: Array.isArray(args.preferenceTags)
        ? args.preferenceTags.filter(
            (tag): tag is string => typeof tag === 'string',
          )
        : undefined,
      query,
    };
  }

  private searchGamesToolDefinition() {
    return {
      annotations: {
        readOnlyHint: true,
      },
      description:
        'Search IGDB for video game metadata that can populate AI recommendation cards.',
      inputSchema: {
        additionalProperties: false,
        properties: {
          limit: {
            default: 5,
            description: 'Maximum games to return. Range: 1-10.',
            maximum: 10,
            minimum: 1,
            type: 'number',
          },
          preferenceTags: {
            description:
              'Optional player preference tags from the RAG context for the agent to track why it searched.',
            items: { type: 'string' },
            type: 'array',
          },
          query: {
            description: 'Game title or search phrase.',
            minLength: 1,
            type: 'string',
          },
        },
        required: ['query'],
        type: 'object',
      },
      name: 'search_games',
      outputSchema: {
        additionalProperties: false,
        properties: {
          error: { type: ['string', 'null'] },
          errorCode: {
            enum: [
              'missing_credentials',
              'unauthorized',
              'rate_limited',
              'network_error',
              'external_api_error',
              null,
            ],
          },
          games: { type: 'array' },
          provider: { const: 'igdb', type: 'string' },
        },
        required: ['provider', 'games', 'error', 'errorCode'],
        type: 'object',
      },
      title: 'Search IGDB Games',
    };
  }

  private result(id: JsonRpcId, result: unknown) {
    return {
      id,
      jsonrpc: '2.0',
      result,
    };
  }

  private error(id: JsonRpcId, code: number, message: string) {
    return {
      error: {
        code,
        message,
      },
      id,
      jsonrpc: '2.0',
    };
  }
}
