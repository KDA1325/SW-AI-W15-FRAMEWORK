import { AgentService } from './agent.service';
import type { AiRagAnalysisResponse } from './recommendation-contract';

describe('AgentService user-scoped recommendations', () => {
  it('limits local fallback recommendations to the current user signals', async () => {
    const ragContext: AiRagAnalysisResponse = {
      contextSources: [],
      embedding: {
        dimensions: 1536,
        model: 'demo-hash-embedding-v1',
        provider: 'demo',
        refreshedDocuments: 0,
      },
      generatedAt: '2026-06-16T00:00:00.000Z',
      playStyleSummary: 'Current user likes tactical RPGs.',
      preferenceTags: [{ label: 'TACTICAL_RPG', sourceCount: 1, weight: 0.9 }],
      userId: 'current-user-id',
      wordCloud: [
        {
          category: 'mechanic',
          label: 'TACTICAL',
          sourceCount: 1,
          weight: 0.9,
        },
      ],
    };
    const dataSource = {
      getRepository: jest.fn(),
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            genres: ['Strategy'],
            id: 'game-id',
            imageUrl: null,
            platforms: ['PC'],
            signalScore: 2,
            steamAppId: '12345',
            tags: ['Tactical'],
            title: 'Scoped Strategy Game',
          },
        ]),
    };
    const config = { get: jest.fn() };
    const mcpService = {
      handle: jest.fn().mockResolvedValue({
        result: {
          structuredContent: {
            error: 'IGDB credentials are missing.',
            errorCode: 'missing_credentials',
            games: [],
            provider: 'igdb',
          },
        },
      }),
    };
    const ragService = {
      analyzeForUser: jest.fn().mockResolvedValue(ragContext),
    };
    const aiProfileRepository = {
      create: jest.fn((value) => ({ ...value })),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    dataSource.getRepository.mockReturnValue(aiProfileRepository);
    const service = new AgentService(
      dataSource as never,
      config as never,
      mcpService as never,
      ragService as never,
    );

    const result = await service.syncRecommendations('current-user-id');
    const [query, params] = dataSource.query.mock.calls[1];

    expect(ragService.analyzeForUser).toHaveBeenCalledWith(
      'current-user-id',
      expect.any(Object),
    );
    expect(query).toContain('post."userId" = $1');
    expect(query).toContain('user_game."userId" = $1');
    expect(params).toEqual(['current-user-id']);
    expect(query).toContain('played_post."userId" = $1');
    expect(query).toContain('played_game."userId" = $1');
    expect(result.recommendations[0].reason).toContain(
      '현재 사용자의 저널, 리뷰, Steam 플레이 신호',
    );
    expect(aiProfileRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lastRecommendationSync: result,
        userId: 'current-user-id',
      }),
    );
  });

  it('filters already recorded games and low-confidence IGDB title matches', async () => {
    const ragContext: AiRagAnalysisResponse = {
      contextSources: [
        {
          excerpt: 'I already wrote about Opus Magnum.',
          gameTitle: 'Opus Magnum',
          similarity: 0.91,
          sourceId: 'post-1',
          sourceType: 'ARCHIVE_POST',
          title: 'Optimizing machines',
        },
      ],
      embedding: {
        dimensions: 1536,
        model: 'demo-hash-embedding-v1',
        provider: 'demo',
        refreshedDocuments: 0,
      },
      generatedAt: '2026-06-16T00:00:00.000Z',
      playStyleSummary: 'Current user likes optimization puzzles.',
      preferenceTags: [{ label: 'PUZZLE_SYSTEMS', sourceCount: 3, weight: 0.9 }],
      userId: 'current-user-id',
      wordCloud: [],
    };
    const dataSource = {
      getRepository: jest.fn(),
      query: jest
        .fn()
        .mockResolvedValueOnce([
          {
            gameId: 'played-game-id',
            igdbId: '100',
            steamAppId: null,
            title: 'Opus Magnum',
          },
        ])
        .mockResolvedValueOnce([]),
    };
    const config = { get: jest.fn() };
    const mcpService = {
      handle: jest.fn().mockResolvedValue({
        result: {
          structuredContent: {
            error: null,
            errorCode: null,
            games: [
              {
                aliases: [],
                externalId: { id: '100', provider: 'igdb' },
                genres: ['Puzzle'],
                imageUrl: null,
                platforms: ['PC'],
                releaseDate: null,
                sourceUrl: 'https://www.igdb.com/games/opus-magnum',
                summary: 'Build puzzle machines.',
                tags: ['Puzzle'],
                title: 'Opus Magnum',
              },
              {
                aliases: [],
                externalId: { id: '200', provider: 'igdb' },
                genres: ['RPG'],
                imageUrl: null,
                platforms: ['PC'],
                releaseDate: null,
                sourceUrl: 'https://www.igdb.com/games/magnum-opus',
                summary: 'A fantasy RPG.',
                tags: ['Fantasy'],
                title: 'Magnum Opus',
              },
              {
                aliases: [],
                externalId: { id: '300', provider: 'igdb' },
                genres: ['Puzzle'],
                imageUrl: null,
                platforms: ['PC'],
                releaseDate: null,
                sourceUrl: 'https://www.igdb.com/games/baba-is-you',
                summary: 'A puzzle game about changing rules.',
                tags: ['Puzzle'],
                title: 'Baba Is You',
              },
            ],
            provider: 'igdb',
          },
        },
      }),
    };
    const ragService = {
      analyzeForUser: jest.fn().mockResolvedValue(ragContext),
    };
    const aiProfileRepository = {
      create: jest.fn((value) => ({ ...value })),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
    };
    dataSource.getRepository.mockReturnValue(aiProfileRepository);
    const service = new AgentService(
      dataSource as never,
      config as never,
      mcpService as never,
      ragService as never,
    );

    const result = await service.syncRecommendations('current-user-id');
    const titles = result.recommendations.map((recommendation) => recommendation.title);

    expect(titles).not.toContain('Opus Magnum');
    expect(titles).not.toContain('Magnum Opus');
    expect(titles).toContain('Baba Is You');
    expect(result.recommendations[0].matchedTags).toEqual(['PUZZLE_SYSTEMS']);
    expect(mcpService.handle).not.toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          arguments: expect.objectContaining({ query: 'Opus Magnum' }),
        }),
      }),
    );
  });

  it('returns the latest saved recommendation snapshot without running sync', async () => {
    const latestSync = {
      contextSources: [],
      generatedAt: '2026-06-16T00:00:00.000Z',
      lastSyncAt: '2026-06-16T00:00:00.000Z',
      pipeline: {
        agent: {
          iterations: 0,
          maxIterations: 4,
          stoppedReason: 'completed',
        },
        mcp: {
          provider: 'igdb',
          resultCount: 0,
          toolName: 'search_games',
        },
        rag: {
          sourceCount: 0,
          topK: 6,
        },
      },
      playStyleSummary: 'Saved summary',
      preferenceTags: [],
      recommendations: [],
      requestId: 'saved-request',
      userId: 'current-user-id',
      wordCloud: [],
    };
    const aiProfileRepository = {
      findOne: jest.fn().mockResolvedValue({
        lastRecommendationSync: latestSync,
      }),
    };
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(aiProfileRepository),
    };
    const service = new AgentService(
      dataSource as never,
      { get: jest.fn() } as never,
      { handle: jest.fn() } as never,
      { analyzeForUser: jest.fn() } as never,
    );

    await expect(
      service.getLatestRecommendations('current-user-id'),
    ).resolves.toBe(latestSync);
    expect(aiProfileRepository.findOne).toHaveBeenCalledWith({
      where: { userId: 'current-user-id' },
    });
  });
});
