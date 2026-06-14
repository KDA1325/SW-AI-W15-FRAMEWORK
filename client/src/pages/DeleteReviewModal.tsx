import { useState } from 'react'
import { api, getApiErrorMessage } from '../api'
import type { JournalPost } from './Journals'

type DeleteReviewModalProps = {
  isOpen: boolean
  post: JournalPost | null
  onClose: () => void
  onDeleted: () => void | Promise<void>
}

function DeleteReviewModal({ isOpen, post, onClose, onDeleted }: DeleteReviewModalProps) {
  const [message, setMessage] = useState('')

  if (!isOpen || !post) {
    return null
  }

  const handleDelete = async () => {
    try {
      setMessage('')

      // Delete the selected review and refresh the parent list so the card disappears immediately.
      await api.delete(`/posts/${post.id}`)
      await onDeleted()
      onClose()
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'REVIEW DELETE FAILED'))
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-primary/50" onClick={onClose} />
      <div className="relative w-full max-w-md border-4 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="mb-6 flex items-center justify-between border-b-4 border-[var(--gjc-primary)] pb-4">
          <h2 className="font-headline-lg text-2xl uppercase tracking-widest">DELETE_CONFIRMATION</h2>
          <button
            className="p-1 text-primary transition-colors hover:bg-primary hover:text-on-primary"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mb-8">
          <p className="font-body-md text-sm uppercase leading-relaxed tracking-wider">
            DELETE REVIEW: {post.title}
          </p>
          <div>THIS ACTION CANNOT BE UNDONE.</div>
        </div>

        {message ? <p className="mb-4 font-label-caps text-xs uppercase text-primary">{message}</p> : null}

        <div className="flex flex-col gap-4 md:flex-row">
          <button
            className="flex-grow border-2 border-[var(--gjc-primary)] bg-[var(--gjc-primary)] py-4 font-ui-button uppercase tracking-widest text-[var(--gjc-on-primary)] transition-colors hover:bg-[var(--gjc-surface-container-lowest)] hover:text-[var(--gjc-primary)]"
            onClick={onClose}
            type="button"
          >
            CANCEL
          </button>
          <button
            className="flex-grow border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] py-4 font-ui-button uppercase tracking-widest text-[var(--gjc-primary)] transition-colors hover:border-[var(--gjc-on-error)] hover:bg-[var(--gjc-on-error-container)] hover:text-[var(--gjc-on-primary)]"
            onClick={handleDelete}
            type="button"
          >
            DELETE
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteReviewModal
