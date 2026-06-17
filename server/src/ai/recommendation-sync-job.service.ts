import { Injectable, Logger } from '@nestjs/common';
import type { AiRecommendationSyncResponse } from './recommendation-contract';
import { AgentService, AgentSyncOptions } from './agent.service';

type RecommendationSyncJobStatus = 'completed' | 'failed' | 'pending' | 'running';

export type RecommendationSyncJobSnapshot = {
  completedAt: string | null;
  error: string | null;
  jobId: string;
  requestId: string;
  result: AiRecommendationSyncResponse | null;
  startedAt: string | null;
  status: RecommendationSyncJobStatus;
  userId: string;
};

type RecommendationSyncJob = RecommendationSyncJobSnapshot & {
  options: AgentSyncOptions;
};

const MAX_JOBS_PER_USER = 5;

@Injectable()
export class RecommendationSyncJobService {
  private readonly jobs = new Map<string, RecommendationSyncJob>();
  private readonly logger = new Logger(RecommendationSyncJobService.name);

  constructor(private readonly agentService: AgentService) {}

  startJob(userId: string, options: AgentSyncOptions = {}) {
    const activeJob = this.getLatestActiveJob(userId);

    if (activeJob) {
      return activeJob;
    }

    const requestId = options.requestId ?? `gjc-sync-${Date.now()}`;
    const jobId = `${requestId}-${Math.random().toString(36).slice(2, 10)}`;
    const job: RecommendationSyncJob = {
      completedAt: null,
      error: null,
      jobId,
      options: { ...options, requestId },
      requestId,
      result: null,
      startedAt: null,
      status: 'pending',
      userId,
    };

    this.jobs.set(jobId, job);
    this.pruneUserJobs(userId);

    void this.runJob(job);

    return this.toSnapshot(job);
  }

  getJob(userId: string, jobId: string): RecommendationSyncJobSnapshot | null {
    const job = this.jobs.get(jobId);

    if (!job || job.userId !== userId) {
      return null;
    }

    return this.toSnapshot(job);
  }

  getLatestActiveJob(userId: string): RecommendationSyncJobSnapshot | null {
    const jobs = [...this.jobs.values()]
      .filter(
        (job) =>
          job.userId === userId &&
          (job.status === 'pending' || job.status === 'running'),
      )
      .sort((left, right) => right.requestId.localeCompare(left.requestId));

    return jobs[0] ? this.toSnapshot(jobs[0]) : null;
  }

  private async runJob(job: RecommendationSyncJob) {
    job.status = 'running';
    job.startedAt = new Date().toISOString();

    try {
      job.result = await this.agentService.syncRecommendations(
        job.userId,
        job.options,
      );
      job.status = 'completed';
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown sync error';
      this.logger.error(
        `Recommendation sync job failed (${job.jobId}). ${job.error}`,
      );
    } finally {
      job.completedAt = new Date().toISOString();
    }
  }

  private pruneUserJobs(userId: string) {
    const jobs = [...this.jobs.values()]
      .filter((job) => job.userId === userId)
      .sort((left, right) => right.requestId.localeCompare(left.requestId));

    for (const job of jobs.slice(MAX_JOBS_PER_USER)) {
      this.jobs.delete(job.jobId);
    }
  }

  private toSnapshot(job: RecommendationSyncJob): RecommendationSyncJobSnapshot {
    return {
      completedAt: job.completedAt,
      error: job.error,
      jobId: job.jobId,
      requestId: job.requestId,
      result: job.result,
      startedAt: job.startedAt,
      status: job.status,
      userId: job.userId,
    };
  }
}
