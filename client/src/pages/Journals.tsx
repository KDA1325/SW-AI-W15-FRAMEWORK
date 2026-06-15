import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getApiErrorMessage } from '../api'
import DeleteJournalModal from './DeleteJournalModal'
import DeleteReviewModal from './DeleteReviewModal'
import EditJournalModal from './EditJournalModal'
import EditReviewModal from './EditReviewModal'
import PageChrome from './PageChrome'
import '../styles/Journals.css'

type JournalsModal = 'delete-journal' | 'delete-review' | 'edit-journal' | 'edit-review' | null

export type PostType = 'REVIEW' | 'JOURNAL'

export type JournalPost = {
  id: string
  type: PostType
  title: string
  content: string
  rating: number | null
  createdAt: string
  updatedAt: string
  userId: string
  canEdit?: boolean
  game: {
    id: string
    title: string
    imageUrl?: string | null
  }
  user: {
    id: string
    nickname: string
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR')
}

function Journals() {
  const [activeModal, setActiveModal] = useState<JournalsModal>(null)
  const [reviews, setReviews] = useState<JournalPost[]>([])
  const [journals, setJournals] = useState<JournalPost[]>([])
  const [message, setMessage] = useState('')
  const [selectedPost, setSelectedPost] = useState<JournalPost | null>(null)

  // Journals is a personal archive, so it requests only the signed-in user's posts.
  // Timeline should use /posts without mine=true when it needs every user's posts.
  const fetchPosts = useCallback(async () => {
    try {
      setMessage('')

      const [reviewResponse, journalResponse] = await Promise.all([
        api.get<JournalPost[]>('/posts?type=REVIEW&mine=true'),
        api.get<JournalPost[]>('/posts?type=JOURNAL&mine=true'),
      ])

      setReviews(reviewResponse.data)
      setJournals(journalResponse.data)
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'POSTS LOAD FAILED'))
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPosts()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchPosts])

  const closeModal = () => {
    setActiveModal(null)
    setSelectedPost(null)
  }

  const openModal = (modal: Exclude<JournalsModal, null>, post: JournalPost) => {
    setSelectedPost(post)
    setActiveModal(modal)
  }

  return (
    <PageChrome active="journals">
      <main className="journals-page flex-grow w-full max-w-[1200px] mx-auto px-8 py-20 flex flex-col gap-[80px]">
        <section className="flex flex-col gap-4">
          {/* Search is still visual-only; API filtering can be added after CRUD flows are stable. */}
          <input
            className="w-full bg-surface-container-low border-2 border-[var(--gjc-primary)] py-2 pl-12 pr-4 text-sm font-label-caps placeholder:text-secondary focus:outline-none focus:ring-0 uppercase tracking-wider"
            placeholder="SEARCH_QUERY: TITLE OR KEYWORD..."
            type="text"
          />
          {message ? <p className="font-label-caps text-xs uppercase text-primary">{message}</p> : null}
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
            <select className="bg-surface-container-low border-2 border-[var(--gjc-primary)] px-2 py-1 text-xs font-ui-button focus:outline-none cursor-pointer uppercase tracking-wider pr-12 transition-colors duration-200">
              <option value="rating">RATING</option>
              <option value="latest">LATEST</option>
              <option value="oldest">OLDEST</option>
            </select>
          </div>

          <div className="flex gap-8 overflow-x-auto pb-12" id="reviews-scroll-container">
            {reviews.map((post) => (
              <article className="group relative w-[320px] flex-shrink-0 cursor-crosshair" key={post.id}>
                <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden border-2 border-[var(--gjc-primary)] bg-surface-container-high grayscale transition-all duration-300 hover:grayscale-0">
                  <span className="font-headline-xl text-5xl">{post.title.slice(0, 2)}</span>
                  <div className="absolute inset-0 flex flex-col bg-[var(--gjc-primary)] p-6 text-[var(--gjc-on-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {post.canEdit ? (
                      <div className="absolute right-4 top-4 z-10 flex gap-2">
                        <button
                          className="border border-primary bg-surface-container-lowest px-3 py-1 font-label-caps text-[10px] font-bold uppercase text-primary transition-colors hover:bg-surface-variant"
                          onClick={() => openModal('edit-review', post)}
                          type="button"
                        >
                          EDIT
                        </button>
                        <button
                          className="border border-primary bg-[var(--gjc-on-error-fixed)] px-3 py-1 font-label-caps text-[10px] font-bold uppercase text-error transition-colors hover:bg-surface-variant"
                          onClick={() => openModal('delete-review', post)}
                          type="button"
                        >
                          DELETE
                        </button>
                      </div>
                    ) : null}

                    <div className="mb-4 border-b border-on-primary pb-4">
                      <p className="mb-2 font-[DotGothic16,sans-serif] text-[16px] uppercase text-secondary-fixed-dim">
                        NOW_VIEWING
                      </p>
                      <h3 className="font-headline-lg uppercase leading-tight">{post.title}</h3>
                    </div>
                    <span className="font-ui-button">GAME: {post.game.title}</span>
                    <span className="font-ui-button">RATING: {post.rating ?? '-'}/5</span>
                    <p className="mt-4 font-body-md text-sm leading-relaxed">{post.content}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
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
            <div className="flex flex-wrap items-center gap-4 font-label-caps text-xs tracking-wider">
              <div className="flex items-center gap-2">
                <span className="font-label-caps">SORT_BY:</span>
                <select className="bg-surface-container-low border-2 border-[var(--gjc-primary)] px-2 py-1 text-xs font-ui-button focus:outline-none cursor-pointer uppercase tracking-wider pr-12 transition-colors duration-200" id="sort-select">
                  <option value="latest">LATEST</option>
                  <option value="oldest">OLDEST</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-label-caps">SHOW:</span>
                <select className="bg-surface-container-low border-2 border-[var(--gjc-primary)] px-2 py-1 text-xs font-ui-button focus:outline-none cursor-pointer uppercase tracking-wider pr-12 transition-colors duration-200" id="per-page-select">
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {journals.map((post) => (
              <article className="flex flex-col overflow-hidden border-2 border-[var(--gjc-primary)] md:flex-row" key={post.id}>
                <div className="flex aspect-square w-full flex-shrink-0 items-center justify-center border-b-2 border-primary bg-surface-dim font-headline-lg text-4xl md:w-48 md:border-b-0 md:border-r-2">
                  {post.game.title.slice(0, 2)}
                </div>
                <div className="flex flex-grow flex-col bg-surface-container-lowest p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <span className="border border-[var(--gjc-primary)] bg-surface-variant px-3 py-1 font-label-caps text-[10px] font-bold uppercase tracking-widest">
                      {post.game.title}
                    </span>
                    {post.canEdit ? (
                      <div className="flex gap-2">
                        <button
                          className="border border-[var(--gjc-primary)] bg-surface-container-lowest px-4 py-1 font-label-caps text-[10px] font-bold uppercase transition-colors hover:bg-surface-variant"
                          onClick={() => openModal('edit-journal', post)}
                          type="button"
                        >
                          EDIT
                        </button>
                        <button
                          className="border border-[var(--gjc-primary)] bg-[var(--gjc-on-error-fixed)] px-4 py-1 font-label-caps text-[10px] font-bold uppercase text-[var(--gjc-surface)] transition-colors hover:bg-surface-variant"
                          onClick={() => openModal('delete-journal', post)}
                          type="button"
                        >
                          DELETE
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <h3 className="mb-2 font-headline-lg-mobile text-2xl uppercase leading-tight">{post.title}</h3>
                  <p className="mb-6 font-body-md text-body-md text-on-surface">{post.content}</p>
                  <Link className="mt-auto flex items-center justify-between" to={`/journal-detail/${post.id}`}>
                    <span className="font-label-caps text-xs tracking-wider text-secondary">
                      {formatDate(post.updatedAt)}
                    </span>
                    <span className="flex items-center gap-2 border-b-2 border-primary pb-0.5 font-ui-button text-xs uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-on-primary">
                      VIEW_LOG
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <EditReviewModal
        isOpen={activeModal === 'edit-review'}
        post={selectedPost}
        onClose={closeModal}
        onSaved={fetchPosts}
      />
      <EditJournalModal
        isOpen={activeModal === 'edit-journal'}
        post={selectedPost}
        onClose={closeModal}
        onSaved={fetchPosts}
      />
      <DeleteReviewModal
        isOpen={activeModal === 'delete-review'}
        post={selectedPost}
        onClose={closeModal}
        onDeleted={fetchPosts}
      />
      <DeleteJournalModal
        isOpen={activeModal === 'delete-journal'}
        post={selectedPost}
        onClose={closeModal}
        onDeleted={fetchPosts}
      />
    </PageChrome>
  )
}

export default Journals
