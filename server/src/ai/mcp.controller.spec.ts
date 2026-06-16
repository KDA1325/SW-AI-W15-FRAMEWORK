import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { sign } from 'jsonwebtoken';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

describe('McpController auth policy', () => {
  const body = {
    id: 'auth-test',
    jsonrpc: '2.0',
    method: 'tools/list',
  };

  function createController(env: Record<string, string | undefined>) {
    const config = {
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService;
    const mcpService = {
      handle: jest.fn().mockResolvedValue({
        id: body.id,
        jsonrpc: '2.0',
        result: { tools: [] },
      }),
    } as unknown as McpService;

    return {
      controller: new McpController(config, mcpService),
      mcpService,
    };
  }

  function request(
    headers: Request['headers'] = {},
    cookies?: Record<string, unknown>,
  ): Request {
    return {
      cookies,
      headers,
    } as Request;
  }

  it('returns a JSON-RPC auth error when auth is required and missing', async () => {
    const { controller, mcpService } = createController({});

    expect(controller.handle(body, request())).toEqual({
      error: {
        code: -32001,
        message:
          'MCP authentication required. Provide a valid JWT cookie or x-mcp-internal-token header.',
      },
      id: 'auth-test',
      jsonrpc: '2.0',
    });
    expect(mcpService.handle).not.toHaveBeenCalled();
  });

  it('allows unauthenticated calls only when explicit non-production dev mode is enabled', async () => {
    const { controller, mcpService } = createController({
      MCP_ALLOW_UNAUTHENTICATED: 'true',
      NODE_ENV: 'development',
    });

    await controller.handle(body, request());

    expect(mcpService.handle).toHaveBeenCalledWith(body);
  });

  it('keeps production protected even if dev bypass is set', async () => {
    const { controller, mcpService } = createController({
      MCP_ALLOW_UNAUTHENTICATED: 'true',
      NODE_ENV: 'production',
    });

    await controller.handle(body, request());

    expect(mcpService.handle).not.toHaveBeenCalled();
  });

  it('allows calls with a valid internal token header', async () => {
    const { controller, mcpService } = createController({
      MCP_INTERNAL_TOKEN: 'internal-token',
    });

    await controller.handle(
      body,
      request({ 'x-mcp-internal-token': 'internal-token' }),
    );

    expect(mcpService.handle).toHaveBeenCalledWith(body);
  });

  it('allows calls with a valid JWT bearer token', async () => {
    const jwt = sign({ email: 'agent@example.com', sub: 'agent-user-id' }, 's');
    const { controller, mcpService } = createController({
      JWT_SECRET: 's',
    });

    await controller.handle(body, request({ authorization: `Bearer ${jwt}` }));

    expect(mcpService.handle).toHaveBeenCalledWith(body);
  });
});
