import { Module } from '@nestjs/common';
import { IgdbService } from './igdb.service';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  controllers: [McpController, RagController],
  exports: [IgdbService, McpService, RagService],
  providers: [IgdbService, McpService, RagService],
})
export class AiModule {}
