import { useState } from 'react'
import { Link } from 'react-router-dom'
import DeleteJournalModal from './DeleteJournalModal'
import DeleteReviewModal from './DeleteReviewModal'
import EditJournalModal from './EditJournalModal'
import EditReviewModal from './EditReviewModal'
import PageChrome from './PageChrome'
import '../styles/Journals.css'

type JournalsModal = 'delete-journal' | 'delete-review' | 'edit-journal' | 'edit-review' | null

const reviews = [
  ['Cybernetic Drift', '4.5/5', 'A sharp arcade loop with an unexpectedly melancholic city.'],
  ['System Shock', '5.0/5', 'Still one of the cleanest examples of interface-driven tension.'],
  ['Ruin Quest', '4.0/5', 'Messy in the right places and stubbornly rewarding.'],
  ['Monolith X', '4.5/5', 'Heavy, cold, and completely committed to its mood.'],
]

const journals = [
  ['#GAME TITLE 18', 'JOURNAL ENTRY #18', 'Mapping the final sector before the next clear attempt.'],
  ['#GAME TITLE 17', 'BOSS PATTERN NOTES', 'Second phase punishes greed, but the tell is finally readable.'],
  ['#GAME TITLE 16', 'HIDDEN ROUTE FOUND', 'A fake wall opened into a whole optional region.'],
  ['#GAME TITLE 15', 'BUILD EXPERIMENT', 'Trying a fragile glass-cannon setup for the archive run.'],
  ['#GAME TITLE 14', 'ENDING THOUGHTS', 'The quiet ending worked better than the loud one.'],
]

function Journals() {
  const [activeModal, setActiveModal] = useState<JournalsModal>(null)

  const closeModal = () => setActiveModal(null)

  return (
    <PageChrome active="journals">
      <main className="journals-page flex-grow w-full max-w-[1200px] mx-auto px-8 py-20 flex flex-col gap-[80px]">
        <section className="flex flex-col gap-4">
          {/* TODO: 검색 아이콘 추가 */}
          {/* TODO: 검색 기능 구현 */}
          <input className="w-full bg-surface-container-low border-2 border-[var(--gjc-primary)] py-2 pl-12 pr-4 text-sm font-label-caps placeholder:text-secondary focus:outline-none focus:ring-0 uppercase tracking-wider" placeholder="SEARCH_QUERY: TITLE OR KEYWORD..." type="text"></input>
          {/* <div className="flex items-center justify-between border-b-2 border-primary pb-3" /> */}
        </section>

        <section className="mb-20">
          <div className="mb-6 flex items-center justify-between border-b-2 border-[var(--gjc-primary)] pb-3">
            <h2 className="flex items-center gap-3 font-headline-lg text-headline-lg uppercase">
              <div className="w-2 h-8 bg-[var(--gjc-primary)]"></div>
              REVIEW_LOGS
              <Link
                className="ml-4 flex items-center gap-2 border-2 border-[var(--gjc-primary)] bg-surface-container-lowest px-4 py-1 font-ui-button text-xs uppercase tracking-widest hover:bg-[var(--gjc-surface-container)] hover:text-on-primary"
                to="/write-review"
              >
                WRITE <span className="material-symbols-outlined text-sm">add</span>
              </Link>
            </h2>
          </div>

          {/* TODO: 카드 클릭 후 드래그로 스크롤 가능하게 처리 */}
          {/* TODO: 정렬 옵션 */}
          <div className="flex gap-8 overflow-x-auto pb-12" id="reviews-scroll-container">
            {reviews.map(([title, rating, copy]) => (
              <article className="group relative w-[320px] flex-shrink-0 cursor-crosshair" key={title}>
                <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden border-2 border-primary bg-surface-container-high grayscale transition-all duration-300 hover:grayscale-0">
                  <span className="font-headline-xl text-5xl">{title.slice(0, 2)}</span>
                  <div className="absolute inset-0 flex flex-col bg-[var(--gjc-primary)] p-6 text-[var(--gjc-on-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="absolute right-4 top-4 z-10 flex gap-2">  
                      <button
                        className="border border-primary bg-surface-container-lowest px-3 py-1 font-label-caps text-[10px] font-bold uppercase text-primary transition-colors hover:bg-surface-variant"
                        onClick={() => setActiveModal('edit-review')}
                        type="button"
                      >
                        EDIT
                      </button>
                      <button
                        className="border border-primary bg-[var(--gjc-on-error-fixed)] px-3 py-1 font-label-caps text-[10px] font-bold uppercase text-error transition-colors hover:bg-surface-variant"
                        onClick={() => setActiveModal('delete-review')}
                        type="button"
                      >
                        DELETE
                      </button>
                    </div>
                    <div className="mb-4 border-b border-on-primary pb-4">
                      <p className="mb-2 font-[DotGothic16,sans-serif] text-[16px] uppercase text-secondary-fixed-dim">
                        NOW_VIEWING
                      </p>
                      <h3 className="font-headline-lg uppercase leading-tight">{title}</h3>
                    </div>
                    <span className="font-ui-button">RATING: {rating}</span>
                    <p className="mt-4 font-body-md text-sm leading-relaxed">{copy}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          {/* TODO: 페이지네이션, 정렬, 보기 개수 선택 옵션 */}
          <div className="mb-6 flex items-center justify-between border-b-2 border-[var(--gjc-primary)] pb-3">
            <h2 className="flex items-center gap-3 font-headline-lg text-headline-lg uppercase">
              <div className="w-2 h-8 bg-[var(--gjc-primary)]"></div>
              JOURNAL_LOGS
              <Link
                className="ml-4 flex items-center gap-2 border-2 border-[var(--gjc-primary)] bg-surface-container-lowest px-4 py-1 font-ui-button text-xs uppercase tracking-widest hover:bg-[var(--gjc-surface-container)] hover:text-on-primary"
                to="/write-journal"
              >
                WRITE <span className="material-symbols-outlined text-sm">add</span>
              </Link>
            </h2>
          </div>

          <div className="flex flex-col gap-6">
            {journals.map(([game, title, copy]) => (
              <article className="flex flex-col overflow-hidden border-2 border-[var(--gjc-primary)] md:flex-row" key={title}>
                <div className="flex aspect-square w-full flex-shrink-0 items-center justify-center border-b-2 border-primary bg-surface-dim font-headline-lg text-4xl md:w-48 md:border-b-0 md:border-r-2">
                  {game.slice(-2)}
                </div>
                <div className="flex flex-grow flex-col bg-surface-container-lowest p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <span className="border border-[var(--gjc-primary)] bg-surface-variant px-3 py-1 font-label-caps text-[10px] font-bold uppercase tracking-widest">
                      {game}
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="border border-[var(--gjc-primary)] bg-surface-container-lowest px-4 py-1 font-label-caps text-[10px] font-bold uppercase transition-colors hover:bg-surface-variant"
                        onClick={() => setActiveModal('edit-journal')}
                        type="button"
                      >
                        EDIT
                      </button>
                      <button
                        className="border border-[var(--gjc-primary)] bg-[var(--gjc-on-error-fixed)] px-4 py-1 font-label-caps text-[10px] font-bold uppercase text-[var(--gjc-surface)]  transition-colors hover:bg-surface-variant"
                        onClick={() => setActiveModal('delete-journal')}
                        type="button"
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                  <h3 className="mb-2 font-headline-lg-mobile text-2xl uppercase leading-tight">
                    {title}
                  </h3>
                  <p className="mb-6 font-body-md text-body-md text-on-surface">{copy}</p>
                  <Link
                    className="mt-auto flex w-fit items-center gap-2 border-b-2 border-[var(--gjc-primary)] pb-0.5 font-ui-button text-xs uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-on-primary"
                    to="/journal-detail"
                  >
                    VIEW_LOG <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <EditReviewModal isOpen={activeModal === 'edit-review'} onClose={closeModal} />
      <EditJournalModal isOpen={activeModal === 'edit-journal'} onClose={closeModal} />
      <DeleteReviewModal isOpen={activeModal === 'delete-review'} onClose={closeModal} />
      <DeleteJournalModal isOpen={activeModal === 'delete-journal'} onClose={closeModal} />
    </PageChrome>
  )
}

export default Journals
