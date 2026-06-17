import { Injectable, Logger } from '@nestjs/common';
import { RagService } from './rag.service';

const ARCHIVE_EMBEDDING_BATCH_DELAY_MS = 1500;
const MAX_ARCHIVE_EMBEDDING_BATCH_POSTS = 64;

type PendingArchiveEmbeddingBatch = {
  postIds: Set<string>;
  timer: NodeJS.Timeout | null;
};

@Injectable()
export class ArchiveEmbeddingQueueService {
  private readonly logger = new Logger(ArchiveEmbeddingQueueService.name);
  private readonly pendingByUser = new Map<string, PendingArchiveEmbeddingBatch>();

  constructor(private readonly ragService: RagService) {}

  enqueue(userId: string, postId: string) {
    if (!userId || !postId) {
      return;
    }

    let batch = this.pendingByUser.get(userId);

    if (!batch) {
      batch = {
        postIds: new Set<string>(),
        timer: null,
      };
      this.pendingByUser.set(userId, batch);
    }

    batch.postIds.add(postId);

    if (batch.postIds.size >= MAX_ARCHIVE_EMBEDDING_BATCH_POSTS) {
      this.flush(userId);
      return;
    }

    if (!batch.timer) {
      batch.timer = setTimeout(
        () => this.flush(userId),
        ARCHIVE_EMBEDDING_BATCH_DELAY_MS,
      );
    }
  }

  private flush(userId: string) {
    const batch = this.pendingByUser.get(userId);

    if (!batch) {
      return;
    }

    if (batch.timer) {
      clearTimeout(batch.timer);
    }

    this.pendingByUser.delete(userId);

    const postIds = [...batch.postIds];

    if (postIds.length === 0) {
      return;
    }

    void this.embedPosts(userId, postIds);
  }

  private async embedPosts(userId: string, postIds: string[]) {
    try {
      const refreshedCount = await this.ragService.refreshArchiveEmbeddingsForPosts(
        userId,
        postIds,
      );

      if (refreshedCount > 0) {
        this.logger.log(
          `Refreshed ${refreshedCount} archive embedding(s) for user ${userId}.`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Archive embedding background job failed for user ${userId}: ${message}`,
      );
    }
  }
}
