export const AI_RECOMMENDATION_DEMO_USER_ID =
  '00000000-0000-4000-8000-000000000001';

export type AiSourceType = 'ARCHIVE_POST' | 'GAME' | 'AI_PROFILE';

export type AiExternalProvider = 'steam' | 'rawg' | 'igdb';

export type AiAgentStoppedReason =
  | 'completed'
  | 'max_iterations'
  | 'timeout'
  | 'fallback';

export type AiRecommendationSyncRequest = {
  // React does not send userId. NestJS should derive it from the JWT cookie and pass it to FastAPI.
  forceRefresh?: boolean;
  topK?: number;
};

export type AiRecommendationAgentRequest = AiRecommendationSyncRequest & {
  // This internal request is sent from NestJS BFF to FastAPI so the agent can load DB/RAG state.
  userId: string;
  requestId: string;
};

export type AiPreferenceTag = {
  label: string;
  weight: number;
  sourceCount: number;
};

export type AiWordCloudTerm = AiPreferenceTag & {
  category: 'genre' | 'mood' | 'mechanic' | 'pace' | 'theme';
};

export type AiRecommendationCard = {
  rank: number;
  gameId: string | null;
  externalId: {
    provider: AiExternalProvider;
    id: string;
  };
  title: string;
  imageUrl: string | null;
  genres: string[];
  platforms: string[];
  tags: string[];
  matchScore: number;
  matchedTags: string[];
  reason: string;
  sourceUrl: string | null;
};

export type AiRagContextSource = {
  sourceType: AiSourceType;
  sourceId: string;
  title: string;
  gameTitle: string | null;
  excerpt: string;
  similarity: number;
};

export type AiPipelineTrace = {
  // The trace lets the demo prove that RAG, MCP, and the agent loop all ran during one SYNC.
  rag: {
    topK: number;
    sourceCount: number;
  };
  mcp: {
    toolName: 'search_games';
    provider: AiExternalProvider;
    resultCount: number;
  };
  agent: {
    maxIterations: number;
    iterations: number;
    stoppedReason: AiAgentStoppedReason;
  };
};

export type AiRecommendationSyncResponse = {
  requestId: string;
  userId: string;
  generatedAt: string;
  lastSyncAt: string;
  preferenceTags: AiPreferenceTag[];
  playStyleSummary: string;
  wordCloud: AiWordCloudTerm[];
  recommendations: AiRecommendationCard[];
  contextSources: AiRagContextSource[];
  pipeline: AiPipelineTrace;
};

export type AiRecommendationErrorResponse = {
  requestId: string;
  message: string;
  fallbackAvailable: boolean;
};

export type AiRagEmbeddingProvider = 'openai' | 'demo';

export type AiRagAnalysisResponse = {
  userId: string;
  generatedAt: string;
  preferenceTags: AiPreferenceTag[];
  playStyleSummary: string;
  wordCloud: AiWordCloudTerm[];
  contextSources: AiRagContextSource[];
  embedding: {
    provider: AiRagEmbeddingProvider;
    model: string;
    dimensions: number;
    refreshedDocuments: number;
  };
};

export const AI_RECOMMENDATION_SYNC_SAMPLE = {
  requestId: 'gjc-demo-sync-001',
  userId: AI_RECOMMENDATION_DEMO_USER_ID,
  generatedAt: '2026-06-16T12:00:00.000+09:00',
  lastSyncAt: '2026-06-16T12:00:00.000+09:00',
  preferenceTags: [
    { label: 'TACTICAL_RPG', weight: 0.95, sourceCount: 4 },
    { label: 'STORY_DRIVEN', weight: 0.91, sourceCount: 5 },
    { label: 'RETRO_PIXEL', weight: 0.86, sourceCount: 3 },
    { label: 'HIGH_DIFFICULTY', weight: 0.78, sourceCount: 2 },
  ],
  playStyleSummary:
    'You favor deliberate combat, readable systems, and games where repeated failure reveals better strategy rather than pure grind.',
  wordCloud: [
    {
      label: 'TACTICAL',
      weight: 0.95,
      sourceCount: 4,
      category: 'mechanic',
    },
    {
      label: 'NARRATIVE',
      weight: 0.91,
      sourceCount: 5,
      category: 'theme',
    },
    {
      label: 'RETRO',
      weight: 0.86,
      sourceCount: 3,
      category: 'mood',
    },
    {
      label: 'FOCUS',
      weight: 0.76,
      sourceCount: 2,
      category: 'pace',
    },
  ],
  recommendations: [
    {
      rank: 1,
      gameId: null,
      externalId: {
        provider: 'steam',
        id: '368340',
      },
      title: 'CrossCode',
      imageUrl:
        'https://cdn.akamai.steamstatic.com/steam/apps/368340/header.jpg',
      genres: ['Action RPG', 'Puzzle'],
      platforms: ['PC', 'Steam'],
      tags: ['Pixel Graphics', 'Story Rich', 'Action RPG'],
      matchScore: 0.93,
      matchedTags: ['RETRO_PIXEL', 'STORY_DRIVEN', 'TACTICAL_RPG'],
      reason:
        'Your journals emphasize precise combat and puzzle-like encounters, which match the action RPG structure and pixel presentation of CrossCode.',
      sourceUrl: 'https://store.steampowered.com/app/368340',
    },
  ],
  contextSources: [
    {
      sourceType: 'ARCHIVE_POST',
      sourceId: '11111111-1111-4111-8111-111111111111',
      title: 'Boss patterns feel fair when the rules are visible',
      gameTitle: 'Into the Breach',
      excerpt:
        'I enjoyed how every loss taught me a clearer tactical rule instead of asking for more grinding.',
      similarity: 0.89,
    },
  ],
  pipeline: {
    rag: {
      topK: 6,
      sourceCount: 6,
    },
    mcp: {
      toolName: 'search_games',
      provider: 'steam',
      resultCount: 10,
    },
    agent: {
      maxIterations: 4,
      iterations: 3,
      stoppedReason: 'completed',
    },
  },
} as const satisfies AiRecommendationSyncResponse;
