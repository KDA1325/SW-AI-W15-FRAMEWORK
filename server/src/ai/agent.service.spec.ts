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
  });
});
