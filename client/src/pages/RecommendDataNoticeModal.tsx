export type RecommendArchiveSignalCounts = {
  isLoading: boolean
  journalCount: number | null
  reviewCount: number | null
}

type RecommendDataNoticeModalProps = {
  archiveSignalCounts: RecommendArchiveSignalCounts
  isOpen: boolean
  onClose: () => void
}

const MINIMUM_SIGNAL_COUNT = 6
const RECOMMENDED_SIGNAL_COUNT = 10
const FULL_SIGNAL_COUNT = 15

const noticeRows = [
  ['MINIMUM', '리뷰/저널 합산 6개 이상'],
  ['RECOMMENDED', '리뷰/저널 합산 10-15개 이상'],
  ['VARIETY', '서로 다른 게임 3개 이상'],
  ['BALANCE', '좋았던 기록과 아쉬웠던 기록 모두 도움됨'],
] as const

function formatSignalCount(value: number | null, isLoading: boolean) {
  if (isLoading) {
    return 'LOADING'
  }

  return value === null ? 'UNKNOWN' : String(value)
}

function getSignalRatio(totalCount: number | null, target: number) {
  if (totalCount === null) {
    return 0
  }

  return Math.min(100, Math.round((totalCount / target) * 100))
}

function getSignalLabel(totalCount: number | null, isLoading: boolean) {
  if (isLoading) {
    return 'COUNTING_LOGS'
  }

  if (totalCount === null) {
    return 'SIGNAL_UNKNOWN'
  }

  if (totalCount < MINIMUM_SIGNAL_COUNT) {
    return 'NEED_MORE_LOGS'
  }

  if (totalCount < RECOMMENDED_SIGNAL_COUNT) {
    return 'ANALYSIS_READY'
  }

  if (totalCount < FULL_SIGNAL_COUNT) {
    return 'STRONG_SIGNAL'
  }

  return 'MAX_SIGNAL'
}

function getSignalHint(totalCount: number | null, isLoading: boolean) {
  if (isLoading) {
    return '현재 리뷰와 저널 기록 수를 확인하고 있습니다.'
  }

  if (totalCount === null) {
    return '기록 수를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.'
  }

  if (totalCount < MINIMUM_SIGNAL_COUNT) {
    return `분석 안정화까지 ${MINIMUM_SIGNAL_COUNT - totalCount}개 기록이 더 필요합니다.`
  }

  if (totalCount < RECOMMENDED_SIGNAL_COUNT) {
    return `추천 정확도를 높이려면 ${RECOMMENDED_SIGNAL_COUNT - totalCount}개 정도 더 쌓는 것이 좋습니다.`
  }

  return 'AI가 취향 패턴을 읽기에 충분한 기록이 쌓여 있습니다.'
}

function RecommendDataNoticeModal({
  archiveSignalCounts,
  isOpen,
  onClose,
}: RecommendDataNoticeModalProps) {
  if (!isOpen) {
    return null
  }

  const { isLoading, journalCount, reviewCount } = archiveSignalCounts
  const totalCount =
    reviewCount === null || journalCount === null
      ? null
      : reviewCount + journalCount
  const signalRows = [
    ['REVIEW_LOGS', formatSignalCount(reviewCount, isLoading)],
    ['JOURNAL_LOGS', formatSignalCount(journalCount, isLoading)],
    ['TOTAL_DATA', formatSignalCount(totalCount, isLoading)],
  ] as const
  const signalBars = [
    ['MIN_6', getSignalRatio(totalCount, MINIMUM_SIGNAL_COUNT)],
    ['REC_10', getSignalRatio(totalCount, RECOMMENDED_SIGNAL_COUNT)],
    ['FULL_15', getSignalRatio(totalCount, FULL_SIGNAL_COUNT)],
  ] as const
  const signalLabel = getSignalLabel(totalCount, isLoading)
  const signalHint = getSignalHint(totalCount, isLoading)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/85 px-4 backdrop-blur-[2px]">
      <div className="recommend-data-notice-panel w-full max-w-4xl border-4 border-primary bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-start justify-between gap-6 border-b-4 border-primary p-7">
          <div>
            <p className="mb-2 font-label-caps text-[10px] uppercase tracking-widest text-secondary">
              AI_ANALYSIS_NOTICE
            </p>
            <h2 className="font-headline-lg uppercase leading-tight text-primary">
              DATA_REQUIREMENTS
            </h2>
          </div>
          <button
            aria-label="Close recommendation data notice"
            className="flex h-9 w-9 items-center justify-center border-2 border-primary bg-white text-primary transition-colors hover:bg-primary hover:text-on-primary"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="grid gap-7 p-7 md:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            <p className="font-body-md text-sm leading-relaxed text-[var(--gjc-on-surface)]">
              AI가 플레이 스타일을 안정적으로 분석하려면 리뷰와 저널에
              반복되는 취향 신호가 필요합니다.
            </p>

            <div className="grid gap-2">
              {noticeRows.map(([label, value]) => (
                <div
                  className="grid grid-cols-[120px_1fr] border-2 border-primary bg-[var(--gjc-surface-container-lowest)]"
                  key={label}
                >
                  <div className="border-r-2 border-primary bg-primary px-3 py-2 font-label-caps text-[10px] uppercase text-on-primary">
                    {label}
                  </div>
                  <div className="px-3 py-2 font-label-caps text-[11px] uppercase leading-relaxed text-primary">
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <p className="font-label-caps text-[10px] uppercase leading-relaxed text-secondary">
              데이터가 적어도 추천은 가능하지만, 6개 미만이면 결과가 특정 게임
              하나에 과하게 끌릴 수 있습니다.
            </p>
          </div>

          <div className="recommend-data-notice-meter flex flex-col justify-between border-2 border-primary bg-[var(--gjc-surface-container-lowest)] p-5">
            <div>
              <p className="mb-2 font-label-caps text-[10px] uppercase tracking-widest text-secondary">
                SIGNAL_LEVEL
              </p>
              <p className="mb-4 font-headline-lg text-2xl uppercase leading-none text-primary">
                {signalLabel}
              </p>
              <div className="space-y-3">
                {signalBars.map(([label, ratio]) => (
                  <div className="grid grid-cols-[52px_1fr] items-center gap-2" key={label}>
                    <span className="font-label-caps text-[9px] uppercase text-secondary">
                      {label}
                    </span>
                    <div className="h-4 border-2 border-primary p-1">
                      <div
                        className="h-full bg-primary transition-[width] duration-300"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-2">
                {signalRows.map(([label, value]) => (
                  <div
                    className="flex items-center justify-between border border-primary bg-white px-2 py-1"
                    key={label}
                  >
                    <span className="font-label-caps text-[9px] uppercase text-secondary">
                      {label}
                    </span>
                    <span className="font-label-caps text-[11px] uppercase text-primary">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-2 border-primary bg-white p-2">
                <p className="font-label-caps text-[10px] uppercase leading-relaxed text-primary">
                  {signalHint}
                </p>
                {totalCount !== null ? (
                  <div className="mt-2 font-label-caps text-[9px] uppercase text-secondary">
                    CURRENT: {totalCount}/{FULL_SIGNAL_COUNT}
                  </div>
                ) : null}
              </div>
            </div>
            <button
              className="mt-6 border-2 border-primary bg-primary px-4 py-3 font-ui-button text-xs uppercase tracking-widest text-on-primary transition-colors hover:bg-white hover:text-primary"
              onClick={onClose}
              type="button"
            >
              {totalCount !== null && totalCount < MINIMUM_SIGNAL_COUNT
                ? 'OK_ADD_LOGS'
                : 'OK_SYNC_READY'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecommendDataNoticeModal
