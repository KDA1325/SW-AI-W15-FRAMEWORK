import { useEffect, useMemo, useRef, useState } from 'react'
import { api, getApiErrorMessage } from '../api'
import RecommendAnalyzingModal from './RecommendAnalyzingModal'
import PageChrome from './PageChrome'
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

const wordPositions = [
  { left: '13%', top: '18%' },
  { left: '35%', top: '24%' },
  { right: '15%', top: '17%' },
  { left: '17%', top: '42%' },
  { right: '17%', top: '43%' },
  { left: '37%', top: '58%' },
  { left: '14%', top: '70%' },
  { right: '23%', top: '72%' },
  { left: '44%', top: '78%' },
]

const tagPositions = [
  { left: '16%', top: '18%' },
  { right: '14%', top: '16%' },
  { left: '50%', top: '45%', transform: 'translate(-50%, -50%)' },
  { left: '12%', top: '66%' },
  { right: '20%', top: '72%' },
  { left: '36%', top: '80%' },
]

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

function wordStyle(word: AiWordCloudTerm, index: number) {
  const position = wordPositions[index % wordPositions.length]
  const fontSize = `${1.15 + Math.min(word.weight, 1) * 2.5}rem`
  const color =
    word.category === 'mood' ? 'var(--gjc-secondary)' : 'var(--gjc-primary)'

  return {
    ...position,
    color,
    fontSize,
  }
}

function tagStyle(index: number) {
  return tagPositions[index % tagPositions.length]
}

function Recommend() {
  const [isAnalyzingOpen, setIsAnalyzingOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncData, setSyncData] = useState<AiRecommendationSyncResponse | null>(
    null,
  )
  const [syncError, setSyncError] = useState<string | null>(null)
  const syncRequestIdRef = useRef(0)

  const visibleWords = useMemo(
    () => syncData?.wordCloud.slice(0, wordPositions.length) ?? [],
    [syncData],
  )
  const visibleTags = useMemo(
    () => syncData?.preferenceTags.slice(0, tagPositions.length) ?? [],
    [syncData],
  )

  useEffect(() => {
    let isMounted = true

    async function loadLatestSync() {
      try {
        const response = await api.get<AiRecommendationSyncResponse | null>(
          '/ai/recommendations/latest',
        )

        // Page entry only restores the last saved snapshot; it never triggers a new AI analysis by itself.
        if (isMounted) {
          setSyncData(response.data)
        }
      } catch (error) {
        if (isMounted) {
          setSyncError(getApiErrorMessage(error, 'AI LAST SYNC LOAD FAILED'))
        }
      }
    }

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
    setSyncError(null)

    try {
      const response = await api.post<AiRecommendationSyncResponse>(
        '/ai/recommendations/sync',
        {
          forceRefresh: true,
          requestId: `gjc-web-sync-${Date.now()}`,
          topK: 6,
        },
      )

      // 여러 번 빠르게 SYNC를 눌러도 가장 마지막 응답만 화면 상태를 바꾸게 합니다.
      if (requestOrder === syncRequestIdRef.current) {
        setSyncData(response.data)
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
            <div className="bg-[var(--gjc-surface-container-lowest)] p-8 flex items-center justify-center min-h-[300px] relative overflow-hidden border-2 border-[var(--gjc-primary)]">
              {visibleWords.length > 0 ? (
                visibleWords.map((word, index) => (
                  <span
                    className="absolute font-headline-lg font-bold uppercase leading-none"
                    key={`${word.label}-${word.category}`}
                    style={wordStyle(word, index)}
                  >
                    {normalizeLabel(word.label)}
                  </span>
                ))
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
            <div className="relative min-h-[300px] flex items-center justify-center p-8">
              {visibleTags.length > 0 ? (
                visibleTags.map((tag, index) => (
                  <span
                    className="absolute text-xl font-body-md text-[var(--gjc-primary)] border border-[var(--gjc-primary)] px-3 py-1 bg-[var(--gjc-surface-container-lowest)]"
                    key={tag.label}
                    style={tagStyle(index)}
                  >
                    #{tag.label}
                  </span>
                ))
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
    </PageChrome>
  )
}

export default Recommend
