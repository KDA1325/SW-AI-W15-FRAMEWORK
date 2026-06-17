import { ArchiveEmbeddingQueueService } from './archive-embedding-queue.service';

describe('ArchiveEmbeddingQueueService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('batches post embedding requests for the same user', async () => {
    const ragService = {
      refreshArchiveEmbeddingsForPosts: jest.fn().mockResolvedValue(2),
    };
    const service = new ArchiveEmbeddingQueueService(ragService as never);

    service.enqueue('user-1', 'post-1');
    service.enqueue('user-1', 'post-2');
    service.enqueue('user-1', 'post-2');

    jest.advanceTimersByTime(1500);
    await Promise.resolve();

    expect(ragService.refreshArchiveEmbeddingsForPosts).toHaveBeenCalledTimes(1);
    expect(ragService.refreshArchiveEmbeddingsForPosts).toHaveBeenCalledWith(
      'user-1',
      ['post-1', 'post-2'],
    );
  });
});
