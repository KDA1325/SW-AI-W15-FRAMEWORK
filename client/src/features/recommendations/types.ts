export type AiPreferenceTag = {
  label: string
  sourceCount: number
  weight: number
}

export type AiWordCloudTerm = AiPreferenceTag & {
  category: 'genre' | 'mood' | 'mechanic' | 'pace' | 'theme'
}

export type AiRecommendationCard = {
  externalId: {
    id: string
    provider: 'steam' | 'rawg' | 'igdb'
  }
  gameId: string | null
  genres: string[]
  imageUrl: string | null
  matchedTags: string[]
  matchScore: number
  platforms: string[]
  rank: number
  reason: string
  sourceUrl: string | null
  tags: string[]
  title: string
}

export type AiRecommendationSyncResponse = {
  contextSources: Array<{
    sourceId: string
    sourceType: 'ARCHIVE_POST' | 'GAME' | 'AI_PROFILE'
  }>
  generatedAt: string
  lastSyncAt: string
  pipeline: {
    agent: {
      iterations: number
      maxIterations: number
      stoppedReason: 'completed' | 'fallback' | 'max_iterations' | 'timeout'
    }
    mcp: {
      resultCount: number
      toolName: 'search_games'
    }
    rag: {
      sourceCount: number
      topK: number
    }
  }
  playStyleSummary: string
  preferenceTags: AiPreferenceTag[]
  recommendations: AiRecommendationCard[]
  requestId: string
  userId: string
  wordCloud: AiWordCloudTerm[]
}
