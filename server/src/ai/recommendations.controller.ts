import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AgentService } from './agent.service';
import { RecommendationSyncJobService } from './recommendation-sync-job.service';

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
  constructor(
    private readonly agentService: AgentService,
    private readonly syncJobs: RecommendationSyncJobService,
  ) {}

  @Get('latest')
  latest(@Req() req: AuthedRequest) {
    return this.agentService.getLatestRecommendations(req.user.userId);
  }

  @Post('sync')
  sync(@Req() req: AuthedRequest, @Body() body: SyncRecommendationBody) {
    return this.syncJobs.startJob(req.user.userId, {
      forceRefresh: body?.forceRefresh,
      requestId: body?.requestId,
      topK: body?.topK,
    });
  }

  @Get('sync/active')
  activeSync(@Req() req: AuthedRequest) {
    return this.syncJobs.getLatestActiveJob(req.user.userId);
  }

  @Get('sync/:jobId')
  syncStatus(@Req() req: AuthedRequest, @Param('jobId') jobId: string) {
    const job = this.syncJobs.getJob(req.user.userId, jobId);

    if (!job) {
      throw new NotFoundException('Recommendation sync job not found.');
    }

    return job;
  }
}
