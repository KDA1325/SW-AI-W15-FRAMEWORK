import { Link } from 'react-router-dom'
import {
  type JournalLimit,
  useJournalsPage,
} from '../features/journals/useJournalsPage'
import type { PostSort } from '../types/posts'
import DeleteJournalModal from './DeleteJournalModal'
import DeleteReviewModal from './DeleteReviewModal'
import EditJournalModal from './EditJournalModal'
import EditReviewModal from './EditReviewModal'
import PageChrome from './PageChrome'
import '../styles/Journals.css'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR')
}

function gameInitials(title: string) {
  return title.slice(0, 2).toUpperCase()
}

function Journals() {
  const {
    activeModal,
    closeModal,
    fetchPosts,
    handleSearch,
    journalLimit,
    journalPage,
    journalPageInfo,
    journalPageNumbers,
    journalSort,
    journals,
    message,
    openModal,
    resetFilters,
    reviewPage,
    reviewPageInfo,
    reviewSort,
    reviews,
    searchInput,
    searchQuery,
    selectedPost,
    setJournalLimit,
    setJournalPage,
    setJournalSort,
    setReviewPage,
    setReviewSort,
    setSearchInput,
  } = useJournalsPage()

  return (
    <PageChrome active="journals">
      <main className="journals-page flex-grow w-full max-w-[1200px] mx-auto px-8 py-20 flex flex-col gap-[80px]">
        <section className="flex flex-col gap-4">
          <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleSearch}>
            <div className="relative flex-1">
              <span className="material-symbols-outlined pointer-events-none absolute left-4 top-8 -translate-y-1/2 text-lg text-secondary">
                search
              </span>
              <input
                className="w-full border-2 border-[var(--gjc-primary)] bg-surface-container-low py-2 pl-12 pr-4 font-label-caps text-sm uppercase tracking-wider placeholder:text-secondary focus:outline-none focus:ring-0"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="SEARCH_QUERY: GAME TITLE OR KEYWORD..."
                type="text"
                value={searchInput}
              />
            </div>
            <button
              className="flex items-center justify-center gap-2 border-2 border-[var(--gjc-primary)] bg-[var(--gjc-primary)] px-6 py-2 font-ui-button text-xs uppercase tracking-widest text-[var(--gjc-on-primary)] transition-colors hover:bg-[var(--gjc-surface-container-lowest)] hover:text-[var(--gjc-primary)]"
              type="submit"
            >
              SEARCH
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
            <button
              className="flex items-center justify-center gap-2 border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] px-6 py-2 font-ui-button text-xs uppercase tracking-widest text-primary transition-colors hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)]"
              onClick={resetFilters}
              type="button"
            >
              RESET
              <span className="material-symbols-outlined text-sm">restart_alt</span>
            </button>
          </form>
          {message ? <p className="font-label-caps text-xs uppercase text-primary">{message}</p> : null}
          {searchQuery ? (
            <p className="font-label-caps text-xs uppercase tracking-wider text-secondary">
              SEARCHING: {searchQuery}
            </p>
          ) : null}
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
            <div className="flex items-center gap-2">
              <span className="font-label-caps">SORT_BY:</span>
              <select
                className="bg-surface-container-low border-2 border-[var(--gjc-primary)] px-2 py-1 text-xs font-ui-button focus:outline-none cursor-pointer uppercase tracking-wider pr-12 transition-colors duration-200"
                id="review-sort-select"
                onChange={(event) => {
                  setReviewPage(1)
                  setReviewSort(event.target.value as PostSort)
                }}
                value={reviewSort}
              >
                <option value="rating">RATING</option>
                <option value="latest">LATEST</option>
                <option value="oldest">OLDEST</option>
              </select>
            </div>
          </div>

          <div className="flex gap-8 overflow-x-auto pb-12" id="reviews-scroll-container">
            {reviews.length === 0 ? (
              <p className="w-full border-2 border-dashed border-primary bg-surface-container-lowest p-6 text-center font-label-caps text-xs uppercase tracking-widest text-secondary">
                NO_REVIEW_RESULTS
              </p>
            ) : null}
            {reviews.map((post) => (
              <article className="group relative w-[320px] flex-shrink-0 cursor-crosshair" key={post.id}>
                <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden border-2 border-[var(--gjc-primary)] bg-surface-container-high transition-all duration-300 hover:grayscale-0">
                  {post.game.imageUrl ? (
                    <img
                      alt={`${post.game.title} cover`}
                      className="h-full w-full object-cover contrast-125"
                      src={post.game.imageUrl}
                    />
                  ) : (
                    <span className="font-headline-xl text-5xl">
                      {gameInitials(post.game.title)}
                    </span>
                  )}
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
                    <p className="mt-4 max-h-32 overflow-hidden font-body-md text-sm leading-relaxed">
                      {post.content}
                    </p>
                    <Link
                      className="mt-auto self-end flex items-center gap-2 border-b-2 border-on-primary pb-0.5 font-ui-button text-xs uppercase tracking-widest text-on-primary transition-colors hover:bg-on-primary hover:text-primary"
                      to={`/review-detail/${post.id}`}
                    >
                      VIEW_LOG
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <nav
            aria-label="Review pagination"
            className="mt-2 flex flex-col items-center justify-between gap-4 border-t-2 border-[var(--gjc-primary)] pt-6 font-label-caps text-xs uppercase tracking-widest md:flex-row"
          >
            <span className="text-secondary">
              REVIEW_PAGE: {reviewPage} / {Math.max(1, reviewPageInfo.totalPages)} // TOTAL:{' '}
              {reviewPageInfo.total}
            </span>
            <div className="flex items-center gap-3">
              <button
                className="border-2 border-[var(--gjc-primary)] bg-surface-container-lowest px-4 py-2 transition-colors enabled:hover:bg-[var(--gjc-primary)] enabled:hover:text-[var(--gjc-on-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!reviewPageInfo.hasPreviousPage}
                onClick={() => setReviewPage((page) => Math.max(1, page - 1))}
                type="button"
              >
                PREV
              </button>
              <span className="border-2 border-[var(--gjc-primary)] bg-surface-container-low px-4 py-2 text-primary">
                {reviewPage}
              </span>
              <button
                className="border-2 border-[var(--gjc-primary)] bg-surface-container-lowest px-4 py-2 transition-colors enabled:hover:bg-[var(--gjc-primary)] enabled:hover:text-[var(--gjc-on-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!reviewPageInfo.hasNextPage}
                onClick={() => setReviewPage((page) => page + 1)}
                type="button"
              >
                NEXT
              </button>
            </div>
          </nav>
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
                <select
                  className="bg-surface-container-low border-2 border-[var(--gjc-primary)] px-2 py-1 text-xs font-ui-button focus:outline-none cursor-pointer uppercase tracking-wider pr-12 transition-colors duration-200"
                  id="journal-sort-select"
                  onChange={(event) => {
                    setJournalPage(1)
                    setJournalSort(event.target.value as PostSort)
                  }}
                  value={journalSort}
                >
                  <option value="latest">LATEST</option>
                  <option value="oldest">OLDEST</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-label-caps">SHOW:</span>
                <select
                  className="bg-surface-container-low border-2 border-[var(--gjc-primary)] px-2 py-1 text-xs font-ui-button focus:outline-none cursor-pointer uppercase tracking-wider pr-12 transition-colors duration-200"
                  id="journal-per-page-select"
                  onChange={(event) => {
                    setJournalPage(1)
                    setJournalLimit(Number(event.target.value) as JournalLimit)
                  }}
                  value={journalLimit}
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {journals.length === 0 ? (
              <p className="border-2 border-dashed border-primary bg-surface-container-lowest p-6 text-center font-label-caps text-xs uppercase tracking-widest text-secondary">
                NO_JOURNAL_RESULTS
              </p>
            ) : null}
            {journals.map((post) => (
              <article className="flex flex-col overflow-hidden border-2 border-[var(--gjc-primary)] md:flex-row" key={post.id}>
                <div className="flex aspect-square w-full flex-shrink-0 items-center justify-center overflow-hidden border-b-2 border-primary bg-surface-dim font-headline-lg text-4xl md:w-48 md:border-b-0 md:border-r-2">
                  {post.game.imageUrl ? (
                    <img
                      alt={`${post.game.title} cover`}
                      className="h-full w-full object-cover contrast-125"
                      src={post.game.imageUrl}
                    />
                  ) : (
                    gameInitials(post.game.title)
                  )}
                </div>
                <div className="flex flex-grow flex-col bg-surface-container-lowest p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <span className="border border-[var(--gjc-primary)] bg-surface-variant px-3 py-1 font-label-caps text-[10px] font-bold uppercase tracking-widest">
                      #{post.game.title}
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
                          className="border border-[var(--gjc-primary)] bg-[var(--gjc-on-error-fixed)] px-4 py-1 font-label-caps text-[10px] font-bold uppercase text-[var(--gjc-on-primary)] transition-colors hover:bg-surface-variant"
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

        <nav
          aria-label="Journal pagination"
          className="flex flex-col items-center justify-between gap-4 border-t-2 border-[var(--gjc-primary)] pt-8 font-label-caps text-xs uppercase tracking-widest md:flex-row"
        >
          <span className="text-secondary">
            JOURNAL_PAGE: {journalPage} / {Math.max(1, journalPageInfo.totalPages)} // TOTAL:{' '}
            {journalPageInfo.total}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              className="border-2 border-[var(--gjc-primary)] bg-surface-container-lowest px-4 py-2 transition-colors enabled:hover:bg-[var(--gjc-primary)] enabled:hover:text-[var(--gjc-on-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!journalPageInfo.hasPreviousPage}
              onClick={() => setJournalPage(1)}
              type="button"
            >
              FIRST
            </button>
            <button
              className="border-2 border-[var(--gjc-primary)] bg-surface-container-lowest px-4 py-2 transition-colors enabled:hover:bg-[var(--gjc-primary)] enabled:hover:text-[var(--gjc-on-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!journalPageInfo.hasPreviousPage}
              onClick={() => setJournalPage((page) => Math.max(1, page - 1))}
              type="button"
            >
              PREV
            </button>
            {journalPageNumbers.map((pageNumber) => (
              <button
                aria-current={pageNumber === journalPage ? 'page' : undefined}
                className={`border-2 border-[var(--gjc-primary)] px-4 py-2 transition-colors ${
                  pageNumber === journalPage
                    ? 'bg-surface-container-low text-primary'
                    : 'bg-surface-container-lowest enabled:hover:bg-[var(--gjc-primary)] enabled:hover:text-[var(--gjc-on-primary)]'
                }`}
                key={pageNumber}
                onClick={() => setJournalPage(pageNumber)}
                type="button"
              >
                {pageNumber}
              </button>
            ))}
            <button
              className="border-2 border-[var(--gjc-primary)] bg-surface-container-lowest px-4 py-2 transition-colors enabled:hover:bg-[var(--gjc-primary)] enabled:hover:text-[var(--gjc-on-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!journalPageInfo.hasNextPage}
              onClick={() => setJournalPage((page) => page + 1)}
              type="button"
            >
              NEXT
            </button>
            <button
              className="border-2 border-[var(--gjc-primary)] bg-surface-container-lowest px-4 py-2 transition-colors enabled:hover:bg-[var(--gjc-primary)] enabled:hover:text-[var(--gjc-on-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!journalPageInfo.hasNextPage}
              onClick={() => setJournalPage(Math.max(1, journalPageInfo.totalPages))}
              type="button"
            >
              LAST
            </button>
          </div>
        </nav>
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
