import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RagService } from './rag.service';

type AuthedRequest = Request & {
  user: {
    email: string;
    userId: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller('ai/rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Get('context')
  getContext(
    @Req() req: AuthedRequest,
    @Query('refreshEmbeddings') refreshEmbeddings?: string,
    @Query('topK') topK?: string,
  ) {
    // Agent and React callers use the same user-scoped RAG context, while JWT keeps userId out of the public query string.
    return this.ragService.analyzeForUser(req.user.userId, {
      refreshEmbeddings: refreshEmbeddings !== 'false',
      topK: this.parseTopK(topK),
    });
  }

  private parseTopK(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : undefined;
  }
}
