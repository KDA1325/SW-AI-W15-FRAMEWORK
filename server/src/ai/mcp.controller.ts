import { Body, Controller, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { verify } from 'jsonwebtoken';
import { McpService } from './mcp.service';

@Controller('mcp')
export class McpController {
  constructor(
    private readonly config: ConfigService,
    private readonly mcpService: McpService,
  ) {}

  @Post()
  handle(@Body() body: unknown, @Req() req: Request) {
    const auth = this.authorize(req);

    if (!auth.authorized) {
      return this.authError(body, auth.code, auth.message);
    }

    return this.mcpService.handle(body as Parameters<McpService['handle']>[0]);
  }

  private authorize(req: Request):
    | { authorized: true }
    | { authorized: false; code: number; message: string } {
    if (!this.requiresAuth()) {
      return { authorized: true };
    }

    if (this.hasValidInternalToken(req) || this.hasValidJwt(req)) {
      return { authorized: true };
    }

    return {
      authorized: false,
      code: -32001,
      message:
        'MCP authentication required. Provide a valid JWT cookie or x-mcp-internal-token header.',
    };
  }

  private requiresAuth(): boolean {
    if (this.isProduction()) {
      return true;
    }

    if (
      this.booleanConfig('MCP_ALLOW_UNAUTHENTICATED') ||
      this.config.get<string>('MCP_REQUIRE_AUTH')?.toLowerCase() === 'false'
    ) {
      return false;
    }

    return true;
  }

  private hasValidInternalToken(req: Request): boolean {
    const expectedToken = this.config.get<string>('MCP_INTERNAL_TOKEN')?.trim();

    if (!expectedToken) {
      return false;
    }

    return this.headerValue(req, 'x-mcp-internal-token') === expectedToken;
  }

  private hasValidJwt(req: Request): boolean {
    const token = this.jwtToken(req);
    const secret = this.config.get<string>('JWT_SECRET');

    if (!token || !secret) {
      return false;
    }

    try {
      verify(token, secret);
      return true;
    } catch {
      return false;
    }
  }

  private jwtToken(req: Request): string | null {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const cookieToken = cookies?.access_token;

    if (typeof cookieToken === 'string' && cookieToken.trim()) {
      return cookieToken;
    }

    const authorization = this.headerValue(req, 'authorization');
    const bearerPrefix = 'Bearer ';

    if (authorization?.startsWith(bearerPrefix)) {
      return authorization.slice(bearerPrefix.length).trim() || null;
    }

    return null;
  }

  private headerValue(req: Request, name: string): string | null {
    const value = req.headers[name.toLowerCase()];

    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return typeof value === 'string' ? value : null;
  }

  private booleanConfig(name: string): boolean {
    return this.config.get<string>(name)?.toLowerCase() === 'true';
  }

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV')?.toLowerCase() === 'production';
  }

  private authError(body: unknown, code: number, message: string) {
    const id =
      body && typeof body === 'object' && 'id' in body
        ? (body as { id?: number | string | null }).id ?? null
        : null;

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
