import type {
  AiPreferenceTag,
  AiRecommendationCard,
  AiRecommendationSyncResponse,
  AiWordCloudTerm,
} from './types'

type JsonRecord = Record<string, unknown>

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function normalizePreferenceTags(value: unknown): AiPreferenceTag[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isJsonRecord).map((tag) => ({
    label: readString(tag.label, 'UNKNOWN'),
    sourceCount: readNumber(tag.sourceCount),
    weight: readNumber(tag.weight),
  }))
}

function normalizeWordCloud(value: unknown): AiWordCloudTerm[] {
  const categories = new Set<AiWordCloudTerm['category']>([
    'genre',
    'mood',
    'mechanic',
    'pace',
    'theme',
  ])

  return normalizePreferenceTags(value).map((tag, index) => {
    const rawTerm = Array.isArray(value) ? value[index] : null
    const rawCategory = isJsonRecord(rawTerm) ? rawTerm.category : null
    const category = categories.has(rawCategory as AiWordCloudTerm['category'])
      ? (rawCategory as AiWordCloudTerm['category'])
      : 'theme'

    return {
      ...tag,
      category,
    }
  })
}

function normalizeRecommendations(value: unknown): AiRecommendationCard[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isJsonRecord).map((card, index) => {
    const externalId = isJsonRecord(card.externalId) ? card.externalId : {}

    return {
      externalId: {
        id: readString(externalId.id, `unknown-${index + 1}`),
        provider:
          readString(externalId.provider, 'igdb') === 'steam'
            ? 'steam'
            : readString(externalId.provider, 'igdb') === 'rawg'
              ? 'rawg'
              : 'igdb',
      },
      gameId: typeof card.gameId === 'string' ? card.gameId : null,
      genres: readStringArray(card.genres),
      imageUrl: typeof card.imageUrl === 'string' ? card.imageUrl : null,
      matchedTags: readStringArray(card.matchedTags),
      matchScore: readNumber(card.matchScore),
      platforms: readStringArray(card.platforms),
      rank: readNumber(card.rank, index + 1),
      reason: readString(card.reason, 'No recommendation reason saved yet.'),
      sourceUrl: typeof card.sourceUrl === 'string' ? card.sourceUrl : null,
      tags: readStringArray(card.tags),
      title: readString(card.title, 'UNKNOWN_GAME'),
    }
  })
}

export function normalizeSyncResponse(
  value: unknown,
): AiRecommendationSyncResponse | null {
  if (!isJsonRecord(value)) {
    return null
  }

  const preferenceTags = normalizePreferenceTags(value.preferenceTags)
  const wordCloud = normalizeWordCloud(value.wordCloud)
  const recommendations = normalizeRecommendations(value.recommendations)
  const playStyleSummary = readString(value.playStyleSummary)

  if (
    !playStyleSummary &&
    preferenceTags.length === 0 &&
    wordCloud.length === 0 &&
    recommendations.length === 0
  ) {
    return null
  }

  const pipeline = isJsonRecord(value.pipeline) ? value.pipeline : {}
  const rag = isJsonRecord(pipeline.rag) ? pipeline.rag : {}
  const mcp = isJsonRecord(pipeline.mcp) ? pipeline.mcp : {}
  const agent = isJsonRecord(pipeline.agent) ? pipeline.agent : {}

  return {
    contextSources: [],
    generatedAt: readString(value.generatedAt),
    lastSyncAt: readString(value.lastSyncAt),
    pipeline: {
      agent: {
        iterations: readNumber(agent.iterations),
        maxIterations: readNumber(agent.maxIterations),
        stoppedReason:
          readString(agent.stoppedReason, 'fallback') === 'completed'
            ? 'completed'
            : readString(agent.stoppedReason, 'fallback') === 'max_iterations'
              ? 'max_iterations'
              : readString(agent.stoppedReason, 'fallback') === 'timeout'
                ? 'timeout'
                : 'fallback',
      },
      mcp: {
        resultCount: readNumber(mcp.resultCount),
        toolName: 'search_games',
      },
      rag: {
        sourceCount: readNumber(rag.sourceCount),
        topK: readNumber(rag.topK),
      },
    },
    playStyleSummary,
    preferenceTags,
    recommendations,
    requestId: readString(value.requestId, 'saved-sync'),
    userId: readString(value.userId),
    wordCloud,
  }
}
