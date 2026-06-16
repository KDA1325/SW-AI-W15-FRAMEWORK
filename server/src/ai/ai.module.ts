import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AiComputeClient } from './ai-compute.client';
import { IgdbService } from './igdb.service';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { RecommendationsController } from './recommendations.controller';

@Module({
  controllers: [McpController, RagController, RecommendationsController],
  exports: [AgentService, AiComputeClient, IgdbService, McpService, RagService],
  providers: [AgentService, AiComputeClient, IgdbService, McpService, RagService],
})
export class AiModule {}
