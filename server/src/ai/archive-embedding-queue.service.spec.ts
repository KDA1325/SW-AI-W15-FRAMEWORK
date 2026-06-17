import { ArchiveEmbeddingQueueService } from './archive-embedding-queue.service';

describe('ArchiveEmbeddingQueueService', () => {
  it('stores post embedding requests as pending database jobs', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([]),
    };
    const ragService = {
      refreshArchiveEmbeddingsForPosts: jest.fn().mockResolvedValue(2),
    };
    const service = new ArchiveEmbeddingQueueService(
      dataSource as never,
      ragService as never,
    );

    await service.enqueue('user-1', 'post-1');

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "EmbeddingJob"'),
      ['user-1', 'ARCHIVE_POST', 'post-1', 'PENDING'],
    );
  });

  it('flushes pending jobs for a user before recommendation sync', async () => {
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'job-1', sourceId: 'post-1', userId: 'user-1' },
          { id: 'job-2', sourceId: 'post-2', userId: 'user-1' },
        ])
        .mockResolvedValueOnce([]),
    };
    const ragService = {
      refreshArchiveEmbeddingsForPosts: jest.fn().mockResolvedValue(2),
    };
    const service = new ArchiveEmbeddingQueueService(
      dataSource as never,
      ragService as never,
    );

    const refreshed = await service.flushPendingForUser('user-1');

    expect(ragService.refreshArchiveEmbeddingsForPosts).toHaveBeenCalledWith(
      'user-1',
      ['post-1', 'post-2'],
    );
    expect(dataSource.query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE "EmbeddingJob"'),
      ['COMPLETED', null, ['job-1', 'job-2']],
    );
    expect(refreshed).toBe(2);
  });
});
