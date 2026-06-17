import axios from 'axios';
import { RagService } from './rag.service';

type TestArchivePost = {
  id: string;
  type: 'REVIEW' | 'JOURNAL';
  title: string;
  content: string;
  rating: number | null;
  gameTitle: string;
  gameGenres: string[];
  gamePlatforms: string[];
  gameTags: string[];
  updatedAt: Date;
};

function makeArchivePost(
  overrides: Partial<TestArchivePost> = {},
): TestArchivePost {
  return {
    content: 'Readable combat notes and careful route planning.',
    gameGenres: ['RPG'],
    gamePlatforms: ['PC'],
    gameTags: ['Strategy'],
    gameTitle: 'CrossCode',
    id: 'post-1',
    rating: 4.5,
    title: 'Puzzle combat',
    type: 'REVIEW',
    updatedAt: new Date('2026-06-17T00:00:00.000Z'),
    ...overrides,
  };
}

function archiveEmbeddingContent(post: TestArchivePost): string {
  return [
    `Post type: ${post.type}`,
    `Game: ${post.gameTitle}`,
    `Title: ${post.title}`,
    `Content: ${post.content}`,
    `Rating: ${post.rating ?? 'none'}`,
    `Genres: ${post.gameGenres.join(', ')}`,
    `Tags: ${post.gameTags.join(', ')}`,
    `Platforms: ${post.gamePlatforms.join(', ')}`,
  ].join('\n');
}

describe('RagService taste analysis fallback', () => {
  it('delegates embedding generation to the FastAPI compute client first', async () => {
    const aiComputeClient = {
      createEmbedding: jest.fn().mockResolvedValue({
        dimensions: 1536,
        model: 'demo-hash-embedding-v1',
        provider: 'demo',
        values: [0.1, -0.2, 0.3],
      }),
    };
    const service = new RagService(
      { query: jest.fn(), getRepository: jest.fn() } as never,
      { get: jest.fn() } as never,
      aiComputeClient as never,
    );

    const embedding = await (
      service as unknown as {
        createEmbedding: (text: string) => Promise<{
          dimensions: number;
          model: string;
          provider: string;
          values: number[];
        }>;
      }
    ).createEmbedding('hello gjc');

    expect(aiComputeClient.createEmbedding).toHaveBeenCalledWith({
      dimensions: 1536,
      input: 'hello gjc',
      model: 'text-embedding-3-small',
    });
    expect(embedding).toEqual({
      dimensions: 1536,
      model: 'demo-hash-embedding-v1',
      provider: 'demo',
      values: [0.1, -0.2, 0.3],
    });
  });

  it('creates OpenAI embeddings in one batch when an API key is configured', async () => {
    const axiosPost = jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        data: [
          { embedding: [0.1, 0.2], index: 0 },
          { embedding: [0.3, 0.4], index: 1 },
        ],
        model: 'text-embedding-3-small',
      },
    });
    const service = new RagService(
      { query: jest.fn(), getRepository: jest.fn() } as never,
      {
        get: jest.fn((key: string) => {
          const values: Record<string, string> = {
            OPENAI_API_KEY: 'test-api-key',
            OPENAI_EMBEDDING_DIMENSIONS: '1536',
            OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
          };

          return values[key];
        }),
      } as never,
    );

    const embeddings = await (
      service as unknown as {
        createEmbeddings: (texts: string[]) => Promise<
          Array<{
            provider: string;
            values: number[];
          }>
        >;
      }
    ).createEmbeddings(['first document', 'second document']);

    expect(axiosPost).toHaveBeenCalledTimes(1);
    expect(axiosPost.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        input: ['first document', 'second document'],
      }),
    );
    expect(embeddings).toEqual([
      { dimensions: 2, model: 'text-embedding-3-small', provider: 'openai', values: [0.1, 0.2] },
      { dimensions: 2, model: 'text-embedding-3-small', provider: 'openai', values: [0.3, 0.4] },
    ]);

    axiosPost.mockRestore();
  });

  it('refreshes only missing or stale archive embeddings', async () => {
    const freshPost = makeArchivePost({ id: 'fresh-post' });
    const stalePost = makeArchivePost({
      id: 'stale-post',
      title: 'Updated tactics',
      updatedAt: new Date('2026-06-17T01:00:00.000Z'),
    });
    const newPost = makeArchivePost({
      id: 'new-post',
      title: 'Brand new journal',
      type: 'JOURNAL',
      updatedAt: new Date('2026-06-17T02:00:00.000Z'),
    });
    const existingDocuments = new Map([
      [
        freshPost.id,
        {
          content: archiveEmbeddingContent(freshPost),
          id: 'embedding-fresh',
          metadata: {
            dimensions: 1536,
            model: 'text-embedding-3-small',
            provider: 'demo',
            updatedAt: freshPost.updatedAt.toISOString(),
          },
          sourceId: freshPost.id,
          sourceType: 'ARCHIVE_POST',
        },
      ],
      [
        stalePost.id,
        {
          content: archiveEmbeddingContent(stalePost),
          id: 'embedding-stale',
          metadata: {
            dimensions: 1536,
            model: 'text-embedding-3-small',
            provider: 'demo',
            updatedAt: '2026-06-16T23:00:00.000Z',
          },
          sourceId: stalePost.id,
          sourceType: 'ARCHIVE_POST',
        },
      ],
    ]);
    const repository = {
      create: jest.fn(() => ({})),
      findOne: jest.fn(
        async (options: { where: { sourceId: string } }) =>
          existingDocuments.get(options.where.sourceId) ?? null,
      ),
      save: jest.fn(
        async (document: { id?: string; sourceId: string }) => ({
          ...document,
          id: document.id ?? `embedding-${document.sourceId}`,
        }),
      ),
    };
    const dataSource = {
      getRepository: jest.fn(() => repository),
      query: jest.fn().mockResolvedValue([]),
    };
    const aiComputeClient = {
      createEmbedding: jest.fn().mockResolvedValue({
        dimensions: 1536,
        model: 'demo-hash-embedding-v1',
        provider: 'demo',
        values: [0.1, -0.2, 0.3],
      }),
    };
    const service = new RagService(
      dataSource as never,
      { get: jest.fn() } as never,
      aiComputeClient as never,
    );

    const refreshed = await (
      service as unknown as {
        refreshArchiveEmbeddings: (
          posts: TestArchivePost[],
        ) => Promise<number>;
      }
    ).refreshArchiveEmbeddings([freshPost, stalePost, newPost]);

    expect(refreshed).toBe(2);
    expect(aiComputeClient.createEmbedding).toHaveBeenCalledTimes(2);
    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(dataSource.query).toHaveBeenCalledTimes(2);
    expect(repository.save.mock.calls.map(([document]) => document.sourceId))
      .toEqual(['stale-post', 'new-post']);
  });

  it('refreshes old demo embeddings when OpenAI embeddings are configured', async () => {
    const axiosPost = jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        data: [{ embedding: [0.1, -0.2, 0.3], index: 0 }],
        model: 'text-embedding-3-small',
      },
    });
    const post = makeArchivePost({ id: 'demo-post' });
    const repository = {
      create: jest.fn(() => ({})),
      findOne: jest.fn().mockResolvedValue({
        content: archiveEmbeddingContent(post),
        id: 'embedding-demo',
        metadata: {
          dimensions: 1536,
          model: 'demo-hash-embedding-v1',
          provider: 'demo',
          updatedAt: post.updatedAt.toISOString(),
        },
        sourceId: post.id,
        sourceType: 'ARCHIVE_POST',
      }),
      save: jest.fn(async (document: { id?: string; sourceId: string }) => ({
        ...document,
        id: document.id ?? `embedding-${document.sourceId}`,
      })),
    };
    const dataSource = {
      getRepository: jest.fn(() => repository),
      query: jest.fn().mockResolvedValue([]),
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'OPENAI_API_KEY' ? 'test-key' : undefined,
      ),
    };
    const service = new RagService(
      dataSource as never,
      config as never,
    );

    const refreshed = await (
      service as unknown as {
        refreshArchiveEmbeddings: (
          posts: TestArchivePost[],
        ) => Promise<number>;
      }
    ).refreshArchiveEmbeddings([post]);

    expect(refreshed).toBe(1);
    expect(axiosPost).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
    axiosPost.mockRestore();
  });

  it('delegates pgvector retrieval to the FastAPI LangChain retriever first', async () => {
    const dataSource = { query: jest.fn(), getRepository: jest.fn() };
    const aiComputeClient = {
      searchRagContext: jest.fn().mockResolvedValue([
        {
          content: 'Post type: REVIEW\nGame: CrossCode',
          metadata: { gameTitle: 'CrossCode', title: 'Puzzle combat' },
          similarity: 0.91,
          sourceId: 'post-1',
          sourceType: 'ARCHIVE_POST',
        },
      ]),
    };
    const service = new RagService(
      dataSource as never,
      { get: jest.fn() } as never,
      aiComputeClient as never,
    );

    const rows = await (
      service as unknown as {
        searchContextRows: (
          userId: string,
          queryEmbedding: number[],
          topK: number,
        ) => Promise<unknown[]>;
      }
    ).searchContextRows('user-1', [0.1, -0.2, 0.3], 6);

    expect(aiComputeClient.searchRagContext).toHaveBeenCalledWith({
      queryEmbedding: [0.1, -0.2, 0.3],
      topK: 6,
      userId: 'user-1',
    });
    expect(dataSource.query).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
  });

  it('falls back to local pgvector SQL when FastAPI retrieval is unavailable', async () => {
    const dataSource = {
      getRepository: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
    };
    const aiComputeClient = {
      searchRagContext: jest.fn().mockResolvedValue(null),
    };
    const service = new RagService(
      dataSource as never,
      { get: jest.fn() } as never,
      aiComputeClient as never,
    );

    await (
      service as unknown as {
        searchContextRows: (
          userId: string,
          queryEmbedding: number[],
          topK: number,
        ) => Promise<unknown[]>;
      }
    ).searchContextRows('user-1', [0.1, -0.2, 0.3], 6);

    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE post."userId" = $2'),
      [expect.stringContaining('['), 'user-1', 6],
    );
  });

  it('separates play-style terms from enjoyed game element tags', () => {
    const service = new RagService(
      { query: jest.fn(), getRepository: jest.fn() } as never,
      { get: jest.fn() } as never,
    );
    const analysis = (
      service as unknown as {
        createFallbackAnalysis: (rows: unknown[]) => {
          preferenceTags: Array<{ label: string }>;
          wordCloud: Array<{ label: string }>;
        };
      }
    ).createFallbackAnalysis([
      {
        content:
          'Post type: REVIEW\nGame: Monster Hunter: World\nContent: I like hunting monsters, reading boss patterns, crafting gear, and repeating the farming loop.\nRating: 4.5\nTags: Crafting, Boss Hunt, Gear Progression',
        metadata: {
          gameTitle: 'Monster Hunter: World',
          title: 'Gear farming feels good',
        },
        similarity: 0.94,
        sourceId: 'post-1',
        sourceType: 'ARCHIVE_POST',
      },
      {
        content:
          'Post type: JOURNAL\nGame: Journey\nContent: The art, music, atmosphere, and exploration made me play slowly as an aesthetic explorer.\nTags: Atmospheric, Exploration',
        metadata: {
          gameTitle: 'Journey',
          title: 'Quiet exploration',
        },
        similarity: 0.9,
        sourceId: 'post-2',
        sourceType: 'ARCHIVE_POST',
      },
    ]);

    const preferenceLabels = analysis.preferenceTags.map((tag) => tag.label);
    const styleLabels = analysis.wordCloud.map((term) =>
      term.label.replaceAll(' ', '_'),
    );

    expect(preferenceLabels).toEqual(
      expect.arrayContaining(['CRAFTING', 'AESTHETIC_PRESENTATION']),
    );
    expect(styleLabels).toEqual(
      expect.arrayContaining(['HUNTING_LOOP', 'AESTHETIC_EXPLORER']),
    );
    expect(styleLabels.some((label) => preferenceLabels.includes(label))).toBe(
      false,
    );
  });

  it('summarizes every archive post into a profile digest for analysis', () => {
    const service = new RagService(
      { query: jest.fn(), getRepository: jest.fn() } as never,
      { get: jest.fn() } as never,
    );
    const row = (
      service as unknown as {
        toArchiveProfileContextRow: (
          userId: string,
          posts: TestArchivePost[],
        ) => {
          content: string;
          sourceId: string;
          sourceType: string;
        } | null;
      }
    ).toArchiveProfileContextRow('user-1', [
      makeArchivePost({
        content: '파밍 반복과 장비 성장이 좋아서 계속 사냥했다.',
        gameTags: ['Crafting', 'Hunting'],
        gameTitle: 'Monster Hunter',
        id: 'post-1',
        rating: 4.5,
      }),
      makeArchivePost({
        content: '스토리와 선택지가 마음에 들어 저널을 남겼다.',
        gameGenres: ['RPG'],
        gameTags: ['Story Rich'],
        gameTitle: 'Disco Elysium',
        id: 'post-2',
        rating: null,
        type: 'JOURNAL',
      }),
    ]);

    expect(row).not.toBeNull();
    expect(row?.sourceType).toBe('AI_PROFILE');
    expect(row?.sourceId).toBe('user-1');
    expect(row?.content).toContain('ARCHIVE_PROFILE_DIGEST');
    expect(row?.content).toContain('Total archive posts: 2');
    expect(row?.content).toContain('Monster Hunter');
    expect(row?.content).toContain('Disco Elysium');
  });

  it('uses Korean review wording in deterministic fallback analysis', () => {
    const service = new RagService(
      { query: jest.fn(), getRepository: jest.fn() } as never,
      { get: jest.fn() } as never,
    );
    const analysis = (
      service as unknown as {
        createFallbackAnalysis: (rows: unknown[]) => {
          preferenceTags: Array<{ label: string }>;
          wordCloud: Array<{ label: string }>;
        };
      }
    ).createFallbackAnalysis([
      {
        content:
          'ARCHIVE_PROFILE_DIGEST\nMonster Hunter 리뷰: 파밍 반복, 보스 사냥, 몬스터 패턴 읽기, 장비 성장이 좋았다.\nTags: Crafting, Hunting',
        metadata: {
          title: 'Archive profile digest',
        },
        similarity: 1,
        sourceId: 'user-1',
        sourceType: 'AI_PROFILE',
      },
    ]);

    const preferenceLabels = analysis.preferenceTags.map((tag) => tag.label);
    const styleLabels = analysis.wordCloud.map((term) =>
      term.label.replaceAll(' ', '_'),
    );

    expect(preferenceLabels).toEqual(expect.arrayContaining(['CRAFTING']));
    expect(styleLabels).toEqual(
      expect.arrayContaining(['FARMING_LOOP', 'HUNTING_LOOP']),
    );
  });
});
