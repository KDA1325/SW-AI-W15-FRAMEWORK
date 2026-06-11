import { useState } from 'react'
import PageChrome from './PageChrome'
import RecommendAnalyzingModal from './RecommendAnalyzingModal'
import '../styles/Recommend.css'

const recommendations = [
  ['ELDRITCH_VOID', 'RPG / ROGUELIKE'],
  ['SYSTEM_CRITICAL', 'ACTION / PLATFORMER'],
  ['NEON_DRIFT_88', 'PUZZLE / ADVENTURE'],
  ['MONOLITH_X', 'SOULSLIKE / DARK'],
]

function Recommend() {
  const [isAnalyzingOpen, setIsAnalyzingOpen] = useState(false)

  const openAnalyzingModal = () => {
    setIsAnalyzingOpen(true)
    window.setTimeout(() => setIsAnalyzingOpen(false), 1800)
  }

  return (
    <PageChrome active="recommend">
      <main className="mx-auto flex w-full max-w-container-max flex-col gap-[80px] px-margin py-20">
        <section className="flex flex-col items-center gap-4">
          <button
            className="group flex w-full items-center justify-center gap-4 rounded-xl border-2 border-primary bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors hover:bg-surface-container active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            onClick={openAnalyzingModal}
            type="button"
          >
            {/* 원본 onclick이 없던 버튼을 React onClick으로 연결해 분석 모달을 띄웁니다. */}
            <div className="flex items-center justify-center border-2 border-primary p-1">
              <span className="material-symbols-outlined text-3xl font-bold transition-transform duration-500 group-hover:rotate-180">
                sync
              </span>
            </div>
            <span className="font-headline-lg text-headline-lg tracking-tighter">
              SYNC_DATA
            </span>
          </button>
          <p className="text-center font-label-caps text-label-caps leading-relaxed text-secondary">
            Sync recent game ratings, journals, and play records to refresh AI
            recommendations.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-4">
          {recommendations.map(([title, genre]) => (
            <article
              className="group flex min-h-[360px] flex-col overflow-hidden border-2 border-primary bg-surface-container-lowest"
              key={title}
            >
              <div className="flex flex-1 items-center justify-center bg-surface-container-high font-headline-lg text-4xl">
                {title.slice(0, 2)}
              </div>
              <div className="flex items-end justify-between border-t-2 border-primary bg-surface-container-lowest p-4">
                <span className="font-label-caps text-xs uppercase text-primary group-hover:hidden">
                  {title}
                </span>
                <span className="hidden font-label-caps text-xs uppercase text-primary group-hover:block">
                  {genre}
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="border-2 border-primary bg-surface-container-lowest p-8">
          <span className="mb-1 block animate-pulse text-[10px] font-bold text-[#5555FF]">
            AI RECOMMEND
          </span>
          <h1 className="font-headline-xl text-headline-xl uppercase">RECOMMEND</h1>
          <p className="mt-4 max-w-2xl font-body-md text-body-md text-on-surface">
            The recommendation screen was converted from static HTML cards into an array
            mapped JSX list, so future API data can replace the mock list without changing
            the layout.
          </p>
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
