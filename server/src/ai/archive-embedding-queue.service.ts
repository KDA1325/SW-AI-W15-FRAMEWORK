import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmbeddingSourceType } from '../auth/entities/embeddingDocument.entity';
import { EmbeddingJobStatus } from './entities/embeddingJob.entity';
import { RagService } from './rag.service';

const ARCHIVE_EMBEDDING_BATCH_INTERVAL_MS = 60_000;
const MAX_ARCHIVE_EMBEDDING_BATCH_POSTS = 64;

type ClaimedEmbeddingJob = {
  id: string;
  sourceId: string;
  userId: string;
};

@Injectable()
export class ArchiveEmbeddingQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArchiveEmbeddingQueueService.name);
  private interval: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly ragService: RagService,
  ) {}

  onModuleInit() {
    this.interval = setInterval(
      () => void this.flushPendingJobs(),
      ARCHIVE_EMBEDDING_BATCH_INTERVAL_MS,
    );
    this.interval.unref?.();
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  async enqueue(userId: string, postId: string) {
    if (!userId || !postId) {
      return;
    }

    await this.dataSource.query(
      `
        INSERT INTO "EmbeddingJob"
          ("userId", "sourceType", "sourceId", "status", "attempts", "lastError", "scheduledAt", "processingStartedAt")
        VALUES
          ($1, $2, $3, $4, 0, NULL, now(), NULL)
        ON CONFLICT ("sourceType", "sourceId")
        DO UPDATE SET
          "userId" = EXCLUDED."userId",
          "status" = $4,
          "attempts" = 0,
          "lastError" = NULL,
          "scheduledAt" = now(),
          "processingStartedAt" = NULL,
          "updatedAt" = now()
      `,
      [
        userId,
        EmbeddingSourceType.ARCHIVE_POST,
        postId,
        EmbeddingJobStatus.PENDING,
      ],
    );
  }

  async flushPendingForUser(userId: string): Promise<number> {
    return this.flushPendingJobs(userId);
  }

  private async flushPendingJobs(userId?: string): Promise<number> {
    await this.recoverStaleProcessingJobs(userId);

    const jobs = await this.claimPendingJobs(userId);

    if (jobs.length === 0) {
      return 0;
    }

    return this.embedClaimedJobs(jobs);
  }

  private async recoverStaleProcessingJobs(userId?: string) {
    await this.dataSource.query(
      `
        UPDATE "EmbeddingJob"
        SET
          "status" = $1,
          "processingStartedAt" = NULL,
          "updatedAt" = now()
        WHERE "status" = $2
          AND "processingStartedAt" < now() - interval '10 minutes'
          AND ($3::uuid IS NULL OR "userId" = $3::uuid)
      `,
      [EmbeddingJobStatus.PENDING, EmbeddingJobStatus.PROCESSING, userId ?? null],
    );
  }

  private async claimPendingJobs(userId?: string): Promise<ClaimedEmbeddingJob[]> {
    return this.dataSource.query<ClaimedEmbeddingJob[]>(
      `
        WITH picked AS (
          SELECT "id"
          FROM "EmbeddingJob"
          WHERE "status" = $4
            AND "sourceType" = $5
            AND "scheduledAt" <= now()
            AND ($2::uuid IS NULL OR "userId" = $2::uuid)
          ORDER BY "scheduledAt" ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "EmbeddingJob"
        SET
          "status" = $3,
          "attempts" = "attempts" + 1,
          "processingStartedAt" = now(),
          "updatedAt" = now()
        FROM picked
        WHERE "EmbeddingJob"."id" = picked."id"
        RETURNING "EmbeddingJob"."id", "EmbeddingJob"."userId", "EmbeddingJob"."sourceId"
      `,
      [
        MAX_ARCHIVE_EMBEDDING_BATCH_POSTS,
        userId ?? null,
        EmbeddingJobStatus.PROCESSING,
        EmbeddingJobStatus.PENDING,
        EmbeddingSourceType.ARCHIVE_POST,
      ],
    );
  }

  private async embedClaimedJobs(jobs: ClaimedEmbeddingJob[]): Promise<number> {
    let refreshedTotal = 0;
    const jobsByUser = new Map<string, ClaimedEmbeddingJob[]>();

    for (const job of jobs) {
      jobsByUser.set(job.userId, [...(jobsByUser.get(job.userId) ?? []), job]);
    }

    for (const [userId, userJobs] of jobsByUser) {
      try {
        const refreshedCount = await this.ragService.refreshArchiveEmbeddingsForPosts(
          userId,
          userJobs.map((job) => job.sourceId),
        );
        refreshedTotal += refreshedCount;

        await this.markJobsCompleted(userJobs.map((job) => job.id));

        if (refreshedCount > 0) {
          this.logger.log(
            `Refreshed ${refreshedCount} archive embedding(s) for user ${userId}.`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        await this.markJobsFailed(
          userJobs.map((job) => job.id),
          message,
        );
        this.logger.warn(
          `Archive embedding background job failed for user ${userId}: ${message}`,
        );
      }
    }

    return refreshedTotal;
  }

  private async markJobsCompleted(jobIds: string[]) {
    await this.updateJobStatus(jobIds, EmbeddingJobStatus.COMPLETED, null);
  }

  private async markJobsFailed(jobIds: string[], error: string) {
    await this.updateJobStatus(jobIds, EmbeddingJobStatus.FAILED, error);
  }

  private async updateJobStatus(
    jobIds: string[],
    status: EmbeddingJobStatus,
    error: string | null,
  ) {
    if (jobIds.length === 0) {
      return;
    }

    await this.dataSource.query(
      `
        UPDATE "EmbeddingJob"
        SET
          "status" = $1,
          "lastError" = $2,
          "processingStartedAt" = NULL,
          "updatedAt" = now()
        WHERE "id" = ANY($3::uuid[])
      `,
      [status, error, jobIds],
    );
  }
}
