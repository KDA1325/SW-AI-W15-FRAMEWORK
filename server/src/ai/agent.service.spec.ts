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
      query: jest.fn().mockResolvedValue([
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
    const [query, params] = dataSource.query.mock.calls[0];

    expect(ragService.analyzeForUser).toHaveBeenCalledWith(
      'current-user-id',
      expect.any(Object),
    );
    expect(query).toContain('post."userId" = $1');
    expect(query).toContain('user_game."userId" = $1');
    expect(params).toEqual(['current-user-id']);
    expect(result.recommendations[0].reason).toContain(
      "this user's own journal, review, and Steam play signals",
    );
    expect(aiProfileRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lastRecommendationSync: result,
        userId: 'current-user-id',
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
