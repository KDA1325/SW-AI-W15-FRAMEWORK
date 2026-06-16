import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AgentService } from './agent.service';

type AuthedRequest = Request & {
  user: {
    email: string;
    userId: string;
  };
};

type SyncRecommendationBody = {
  forceRefresh?: boolean;
  requestId?: string;
  topK?: number;
};

@UseGuards(JwtAuthGuard)
@Controller('ai/recommendations')
export class RecommendationsController {
  constructor(private readonly agentService: AgentService) {}

  @Post('sync')
  sync(@Req() req: AuthedRequest, @Body() body: SyncRecommendationBody) {
    return this.agentService.syncRecommendations(req.user.userId, {
      forceRefresh: body?.forceRefresh,
      requestId: body?.requestId,
      topK: body?.topK,
    });
  }
}
