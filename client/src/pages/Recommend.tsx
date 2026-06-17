import { useRecommendationSync } from '../features/recommendations/recommendationSyncContext'
import type {
  AiRecommendationCard,
  AiWordCloudTerm,
} from '../features/recommendations/types'
import RecommendDataNoticeModal from './RecommendDataNoticeModal'
import PageChrome from './PageChrome'
import '../styles/Profile.css'
import '../styles/Recommend.css'

function normalizeLabel(label: string) {
  return label.replaceAll('_', ' ').toUpperCase()
}

function analysisLabelKo(label: string) {
  const normalized = label.trim().replaceAll(' ', '_').toUpperCase()
  const labels: Record<string, string> = {
    AESTHETIC_EXPLORER: '심미적 탐험 성향',
    AESTHETIC_PRESENTATION: '아트와 분위기',
    ARCHIVE_BASED_PLAYER: '기록 기반 플레이 성향',
    ATMOSPHERE: '분위기',
    COOP_TEAMPLAYER: '협동 플레이 성향',
    COLLECTION: '수집 요소',
    COLLECTION_COMPLETIONIST: '수집 완성형 플레이',
    COZY_SIM: '편안한 시뮬레이션 감성',
    CRAFTING: '제작과 장비 성장',
    DEDUCTION: '추리 요소',
    DELIBERATE_PLANNER: '신중한 계획형 플레이',
    EUREKA_MOMENTS: '깨달음이 있는 퍼즐',
    FARMING_LOOP: '파밍 루프',
    GAME_ELEMENTS: '선호 게임 요소',
    HORROR_ATMOSPHERE: '공포 분위기',
    HUNTING_LOOP: '사냥과 보스 공략',
    LOW_PRESSURE_ROUTINE: '부담 없는 반복 플레이',
    NARRATIVE_ROLEPLAYER: '서사 몰입형 플레이',
    OPTIMIZATION: '최적화 요소',
    PIXEL_ART: '픽셀 아트',
    PROGRAMMING_PUZZLE: '프로그래밍 퍼즐',
    PUZZLE_SYSTEMS: '퍼즐 시스템',
    SOLO_PROBLEM_SOLVER: '혼자 문제를 푸는 성향',
    SPATIAL_REASONING: '공간 추론',
    STORY_DRIVEN: '스토리 중심 구성',
    SYSTEM_OPTIMIZER: '시스템 최적화 성향',
    TACTICAL_COMBAT: '전술 전투',
    TACTICAL_RPG: '전술 RPG',
    TANK_ROLE: '탱커 역할 선호',
  }

  return labels[normalized] ?? normalizeLabel(label)
}

function recommendationCardTags(card: AiRecommendationCard) {
  const labels =
    card.matchedTags.length > 0
      ? card.matchedTags
      : [...card.tags, ...card.genres]

  return [...new Set(labels)].slice(0, 3)
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

function Recommend() {
  const {
    archiveSignalCounts,
    isDataNoticeOpen,
    isSyncing,
    setIsDataNoticeOpen,
    syncData,
    syncError,
    syncRecommendations,
    visibleTags,
    visibleWords,
  } = useRecommendationSync()

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
                    {analysisLabelKo(word.label)}
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
                    #{analysisLabelKo(tag.label)}
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
                          {recommendationCardTags(card).map((tag) => (
                            <span
                              className="border border-[var(--gjc-primary)] px-2 py-1 font-label-caps text-[9px] text-[var(--gjc-primary)] uppercase"
                              key={`${card.title}-${tag}`}
                            >
                              {analysisLabelKo(tag)}
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

      <RecommendDataNoticeModal
        archiveSignalCounts={archiveSignalCounts}
        isOpen={isDataNoticeOpen}
        onClose={() => setIsDataNoticeOpen(false)}
      />
    </PageChrome>
  )
}

export default Recommend
