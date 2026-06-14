import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, getApiErrorMessage } from '../api'
import type { JournalPost } from './Journals'

type EditReviewModalProps = {
  isOpen: boolean
  post: JournalPost | null
  onClose: () => void
  onSaved: () => void | Promise<void>
}

function EditReviewModal({ isOpen, post, onClose, onSaved }: EditReviewModalProps) {
  const [gameTitle, setGameTitle] = useState('')
  const [reviewTitle, setReviewTitle] = useState('')
  const [rating, setRating] = useState('4.5')
  const [review, setReview] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!post || !isOpen) return

    const timeoutId = window.setTimeout(() => {
      // The edit form starts from the DB values that came from GET /posts.
      setGameTitle(post.game.title)
      setReviewTitle(post.title)
      setRating(String(post.rating ?? 1))
      setReview(post.content)
      setMessage('')
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [isOpen, post])

  if (!isOpen || !post) {
    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      setMessage('')

      // Review updates may change game title, title, body, and rating.
      await api.patch(`/posts/${post.id}`, {
        gameTitle,
        title: reviewTitle,
        content: review,
        rating: parseFloat(rating),
      })

      await onSaved()
      onClose()
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'REVIEW UPDATE FAILED'))
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[var(--gjc-primary)]/50 p-4">
      <div className="w-full max-w-3xl border-4 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="mb-8 flex items-center justify-between border-b-4 border-[var(--gjc-primary)] pb-4">
          <h2 className="font-headline-lg text-3xl uppercase tracking-widest">EDIT_REVIEW</h2>
          <button
            className="p-1 text-primary transition-colors hover:bg-primary hover:text-on-primary"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form className="grid grid-cols-1 gap-6 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2">
            <span className="font-label-caps text-sm uppercase tracking-widest">GAME_TITLE</span>
            <input
              className="border-2 border-primary bg-surface-container-low p-3 font-label-caps uppercase tracking-wider focus:outline-none focus:ring-0"
              onChange={(event) => setGameTitle(event.target.value)}
              required
              type="text"
              value={gameTitle}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-label-caps text-sm uppercase tracking-widest">RATING</span>
            <input
              className="border-2 border-primary bg-surface-container-low p-3 font-label-caps uppercase tracking-wider focus:outline-none focus:ring-0"
              max="5"
              min="1"
              onChange={(event) => setRating(event.target.value)}
              required
              step="0.5"
              type="number"
              value={rating}
            />
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="font-label-caps text-sm uppercase tracking-widest">REVIEW_TITLE</span>
            <input
              className="border-2 border-primary bg-surface-container-low p-3 font-label-caps uppercase tracking-wider focus:outline-none focus:ring-0"
              onChange={(event) => setReviewTitle(event.target.value)}
              required
              type="text"
              value={reviewTitle}
            />
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="font-label-caps text-sm uppercase tracking-widest">REVIEW_CONTENT</span>
            <textarea
              className="min-h-[220px] border-2 border-primary bg-surface-container-low p-4 font-body-md text-sm focus:outline-none focus:ring-0"
              onChange={(event) => setReview(event.target.value)}
              required
              value={review}
            />
          </label>

          {message ? (
            <p className="font-label-caps text-xs uppercase text-primary md:col-span-2">{message}</p>
          ) : null}

          <div className="flex flex-col gap-4 md:col-span-2 md:flex-row">
            <button
              className="flex-grow border-2 border-[var(--gjc-primary)] bg-[var(--gjc-primary)] py-4 font-ui-button uppercase tracking-widest text-[var(--gjc-on-primary)] transition-colors hover:bg-[var(--gjc-surface-container-lowest)] hover:text-[var(--gjc-primary)]"
              type="submit"
            >
              SAVE
            </button>
            <button
              className="flex-grow border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] py-4 font-ui-button uppercase tracking-widest text-primary transition-colors hover:bg-[var(--gjc-surface-container)]"
              onClick={onClose}
              type="button"
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditReviewModal
