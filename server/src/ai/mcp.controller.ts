import { Body, Controller, Post } from '@nestjs/common';
import { McpService } from './mcp.service';

@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post()
  handle(@Body() body: unknown) {
    return this.mcpService.handle(body as Parameters<McpService['handle']>[0]);
  }
}
