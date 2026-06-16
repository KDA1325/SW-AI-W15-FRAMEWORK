import { useEffect, useMemo, useRef, useState } from 'react'
import { api, getApiErrorMessage } from '../api'
import RecommendAnalyzingModal from './RecommendAnalyzingModal'
import RecommendDataNoticeModal, {
  type RecommendArchiveSignalCounts,
} from './RecommendDataNoticeModal'
import PageChrome from './PageChrome'
import type { PostListResponse } from './Journals'
import '../styles/Profile.css'
import '../styles/Recommend.css'

type AiPreferenceTag = {
  label: string
  sourceCount: number
  weight: number
}

type AiWordCloudTerm = AiPreferenceTag & {
  category: 'genre' | 'mood' | 'mechanic' | 'pace' | 'theme'
}

type AiRecommendationCard = {
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

type AiRecommendationSyncResponse = {
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

type JsonRecord = Record<string, unknown>

function normalizeLabel(label: string) {
  return label.replaceAll('_', ' ').toUpperCase()
}

function formatSyncTime(value: string | null) {
  if (!value) {
    return 'NOT_SYNCED'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'UNKNOWN'
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${year}. ${month}. ${day} ${hour}:${minute}`
}

function wordStyle(word: AiWordCloudTerm) {
  const fontSize = `${0.95 + Math.min(word.weight, 1) * 1.9}rem`
  const color =
    word.category === 'mood' ? 'var(--gjc-secondary)' : 'var(--gjc-primary)'

  return {
    color,
    fontSize,
  }
}

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

function normalizeSyncResponse(
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

  // Saved SYNC snapshots may come from an older schema, so the page normalizes them before rendering nested fields.
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

function Recommend() {
  const [isAnalyzingOpen, setIsAnalyzingOpen] = useState(false)
  const [isDataNoticeOpen, setIsDataNoticeOpen] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [archiveSignalCounts, setArchiveSignalCounts] =
    useState<RecommendArchiveSignalCounts>({
      isLoading: true,
      journalCount: null,
      reviewCount: null,
    })
  const [syncData, setSyncData] = useState<AiRecommendationSyncResponse | null>(
    null,
  )
  const [syncError, setSyncError] = useState<string | null>(null)
  const syncRequestIdRef = useRef(0)

  const visibleWords = useMemo(
    () => syncData?.wordCloud.slice(0, 16) ?? [],
    [syncData],
  )
  const visibleTags = useMemo(
    () => syncData?.preferenceTags.slice(0, 10) ?? [],
    [syncData],
  )

  useEffect(() => {
    let isMounted = true

    async function loadArchiveSignalCounts() {
      try {
        const countParams = {
          limit: '5',
          mine: 'true',
          page: '1',
          sort: 'latest',
        }
        const reviewParams = new URLSearchParams({
          ...countParams,
          type: 'REVIEW',
        })
        const journalParams = new URLSearchParams({
          ...countParams,
          type: 'JOURNAL',
        })
        const [reviewResponse, journalResponse] = await Promise.all([
          api.get<PostListResponse>(`/posts?${reviewParams.toString()}`),
          api.get<PostListResponse>(`/posts?${journalParams.toString()}`),
        ])

        if (isMounted) {
          setArchiveSignalCounts({
            isLoading: false,
            journalCount: journalResponse.data.total,
            reviewCount: reviewResponse.data.total,
          })
        }
      } catch {
        if (isMounted) {
          setArchiveSignalCounts({
            isLoading: false,
            journalCount: null,
            reviewCount: null,
          })
        }
      }
    }

    async function loadLatestSync() {
      try {
        const response = await api.get<unknown>('/ai/recommendations/latest')
        const latestSync = normalizeSyncResponse(response.data)

        // Page entry only restores the last saved snapshot; it never triggers a new AI analysis by itself.
        if (isMounted) {
          setSyncData(latestSync)

          if (response.data && !latestSync) {
            setSyncError('AI LAST SYNC DATA INVALID - PLEASE SYNC AGAIN')
          }
        }
      } catch (error) {
        if (isMounted) {
          setSyncError(getApiErrorMessage(error, 'AI LAST SYNC LOAD FAILED'))
        }
      }
    }

    void loadArchiveSignalCounts()
    void loadLatestSync()

    return () => {
      isMounted = false
    }
  }, [])

  const syncRecommendations = async () => {
    const requestOrder = syncRequestIdRef.current + 1
    syncRequestIdRef.current = requestOrder
    setIsSyncing(true)
    setIsAnalyzingOpen(true)
    setIsDataNoticeOpen(false)
    setSyncError(null)

    try {
      const response = await api.post<unknown>('/ai/recommendations/sync', {
        forceRefresh: true,
        requestId: `gjc-web-sync-${Date.now()}`,
        topK: 6,
      })
      const nextSync = normalizeSyncResponse(response.data)

      // 여러 번 빠르게 SYNC를 눌러도 가장 마지막 응답만 화면 상태를 바꾸게 합니다.
      if (requestOrder === syncRequestIdRef.current) {
        setSyncData(nextSync)
        setSyncError(nextSync ? null : 'AI SYNC RESPONSE INVALID')
      }
    } catch (error) {
      if (requestOrder === syncRequestIdRef.current) {
        setSyncError(getApiErrorMessage(error, 'AI SYNC FAILED'))
      }
    } finally {
      if (requestOrder === syncRequestIdRef.current) {
        setIsSyncing(false)
        setIsAnalyzingOpen(false)
      }
    }
  }

  return (
    <PageChrome active="recommend">
      <main className="recommend-page flex-grow w-full max-w-[1200px] mx-auto px-8 py-20 flex flex-col gap-[80px]">
        <div className="flex flex-col items-center gap-4 w-full mb-2">
          <div className="w-full flex flex-col items-center gap-4">
            <button
              className="w-full border-2 border-[var(--gjc-primary)] rounded-xl p-4 flex items-center justify-center gap-4 bg-white hover:bg-[var(--gjc-surface-container)] transition-colors group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSyncing}
              onClick={syncRecommendations}
              type="button"
            >
              <div className="border-2 border-[var(--gjc-primary)] p-1 flex items-center justify-center">
                <span
                  className={`material-symbols-outlined text-3xl font-bold transition-transform duration-500 ${
                    isSyncing ? 'syncing-icon' : 'group-hover:rotate-180'
                  }`}
                >
                  sync
                </span>
              </div>
              <span className="font-headline-lg text-headline-lg tracking-tighter">
                {isSyncing ? 'SYNCING_DATA' : 'SYNC_DATA'}
              </span>
            </button>

            <button
              className="border-2 border-[var(--gjc-primary)] bg-white px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest text-primary shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-colors hover:bg-primary hover:text-on-primary"
              onClick={() => setIsDataNoticeOpen(true)}
              type="button"
            >
              AI_DATA_GUIDE
            </button>

            <p className="font-label-caps text-label-caps text-[var(--gjc-secondary)] text-center leading-relaxed recommend-nowrap">
              {syncData?.playStyleSummary ??
                'Press sync to refresh recent ratings, journals, and play records so AI can analyze your data and recommend matching games.'}
            </p>

            {syncError ? (
              <div className="bg-[var(--gjc-on-error-fixed)] border border-[var(--gjc-on-error-container)] px-3 py-2">
                <span className="font-label-caps text-[10px] text-[var(--gjc-on-primary)] uppercase">
                  {syncError}
                </span>
              </div>
            ) : null}

            <div className="bg-white border border-[var(--gjc-outline-variant)] px-3 py-1">
              <span className="font-label-caps text-[10px] text-[var(--gjc-secondary)] uppercase">
                LAST_SYNC: {formatSyncTime(syncData?.lastSyncAt ?? null)}
              </span>
            </div>

            {syncData ? (
              <div className="bg-white border border-[var(--gjc-outline-variant)] px-3 py-1">
                <span className="font-label-caps text-[10px] text-[var(--gjc-secondary)] uppercase">
                  PIPELINE: RAG_{syncData.pipeline.rag.sourceCount} / MCP_
                  {syncData.pipeline.mcp.resultCount} / AGENT_
                  {syncData.pipeline.agent.stoppedReason}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <section className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 bg-[var(--gjc-surface-container-lowest)] p-8 border-2 border-[var(--gjc-primary)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile mb-2 text-[var(--gjc-primary)] uppercase">
              YOUR PLAY STYLE
            </h2>
            <p className="font-label-caps text-label-caps mb-8 text-[var(--gjc-secondary)]">
              (BASED ON ACHIEVEMENTS, RATINGS, AND JOURNAL LOGS)
            </p>
            <div className="bg-[var(--gjc-surface-container-lowest)] p-8 flex items-center justify-center min-h-[300px] border-2 border-[var(--gjc-primary)]">
              {visibleWords.length > 0 ? (
                // GJC-179: word cloud terms stay in flow, while source weight only changes visual emphasis.
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-4 text-center">
                  {visibleWords.map((word) => (
                  <span
                    className="font-headline-lg font-bold uppercase leading-none"
                    key={`${word.label}-${word.category}`}
                    style={wordStyle(word)}
                  >
                    {normalizeLabel(word.label)}
                  </span>
                  ))}
                </div>
              ) : (
                <span className="font-label-caps text-xs text-[var(--gjc-secondary)] uppercase">
                  NO_STYLE_DATA
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 bg-[var(--gjc-surface-container-lowest)] p-8 border-2 border-[var(--gjc-primary)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile mb-2 text-[var(--gjc-primary)] uppercase">
              GAMES YOU ENJOY
            </h2>
            <p className="font-label-caps text-label-caps mb-8 text-[var(--gjc-secondary)]">
              (BASED ON GAME RATINGS AND PLAY HISTORY)
            </p>
            <div className="min-h-[300px] content-center p-8">
              {visibleTags.length > 0 ? (
                // GJC-180: tags wrap in normal document flow so more than six analysis tags never overlap.
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {visibleTags.map((tag) => (
                  <span
                    className="text-base font-body-md text-[var(--gjc-primary)] border border-[var(--gjc-primary)] px-3 py-1 bg-[var(--gjc-surface-container-lowest)] md:text-xl"
                    key={tag.label}
                  >
                    #{tag.label}
                  </span>
                  ))}
                </div>
              ) : (
                <span className="font-label-caps text-xs text-[var(--gjc-secondary)] uppercase">
                  NO_TAGS
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="w-full">
          <h2 className="font-headline-lg text-headline-lg mb-12 text-[var(--gjc-primary)] uppercase">
            RECOMMENDED GAMES
          </h2>
          <div>
            <div>
              {syncData?.recommendations.length ? (
                /* Cards flow into the page so long AI reasons expand vertically without a section scrollbar. */
                <div className="recommend-card-grid">
                  {syncData.recommendations.map((card) => (
                    <article
                      className="recommend-card bg-[var(--gjc-surface-container-lowest)] flex flex-col border-2 border-[var(--gjc-primary)] transition-all group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px]"
                      key={`${card.externalId.provider}-${card.externalId.id}-${card.rank}`}
                    >
                      <div className="relative h-[250px] p-2">
                        {card.imageUrl ? (
                          <img
                            alt={`${card.title} cover`}
                            className="w-full h-full object-cover border-2 border-[var(--gjc-primary)] grayscale group-hover:grayscale-0 transition-all duration-300"
                            src={card.imageUrl}
                          />
                        ) : (
                          <div className="w-full h-full border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-variant)] flex items-center justify-center p-4 text-center">
                            <span className="font-headline-lg text-2xl text-[var(--gjc-primary)] uppercase">
                              {card.title}
                            </span>
                          </div>
                        )}
                        {[card.externalId.provider, ...card.platforms]
                          .slice(0, 2)
                          .map((badge, index) => (
                            <span
                              className={`absolute top-4 ${
                                index === 0 ? 'left-4' : 'left-20'
                              } bg-[var(--gjc-primary)] text-[var(--gjc-on-primary)] px-2 py-1 font-label-caps text-xs uppercase`}
                              key={`${card.title}-${badge}`}
                            >
                              {badge}
                            </span>
                          ))}
                      </div>
                      <div className="p-4 border-t-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] flex flex-1 flex-col gap-3">
                        <div>
                          <span className="font-label-caps text-[10px] text-[var(--gjc-secondary)] uppercase">
                            RANK_{card.rank} / MATCH_
                            {Math.round(card.matchScore * 100)}
                          </span>
                          <h3 className="font-headline-lg text-2xl text-[var(--gjc-primary)] uppercase leading-tight">
                            {card.title}
                          </h3>
                        </div>

                        <p className="font-label-caps text-[10px] text-[var(--gjc-primary)] uppercase">
                          {[...card.genres, ...card.platforms]
                            .slice(0, 3)
                            .join(' / ') || 'UNKNOWN_GENRE'}
                        </p>

                        <p className="recommend-card-reason font-body-md text-xs leading-relaxed text-[var(--gjc-secondary)]">
                          {card.reason}
                        </p>

                        <div className="mt-auto flex flex-wrap gap-2">
                          {card.matchedTags.slice(0, 3).map((tag) => (
                            <span
                              className="border border-[var(--gjc-primary)] px-2 py-1 font-label-caps text-[9px] text-[var(--gjc-primary)] uppercase"
                              key={`${card.title}-${tag}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        {card.sourceUrl ? (
                          <a
                            className="font-label-caps text-[10px] text-[var(--gjc-primary)] uppercase underline"
                            href={card.sourceUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            OPEN_SOURCE
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="min-h-[260px] border-2 border-dashed border-[var(--gjc-outline-variant)] flex items-center justify-center bg-[var(--gjc-surface-container-lowest)]">
                  <span className="font-label-caps text-xs text-[var(--gjc-secondary)] uppercase">
                    NO_RECOMMENDATIONS_SYNC_REQUIRED
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <RecommendAnalyzingModal
        isOpen={isAnalyzingOpen}
        onClose={() => setIsAnalyzingOpen(false)}
      />
      <RecommendDataNoticeModal
        archiveSignalCounts={archiveSignalCounts}
        isOpen={isDataNoticeOpen}
        onClose={() => setIsDataNoticeOpen(false)}
      />
    </PageChrome>
  )
}

export default Recommend
