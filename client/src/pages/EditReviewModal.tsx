import { useState } from 'react'
import type { FormEvent } from 'react'

type EditReviewModalProps = {
  isOpen: boolean
  onClose: () => void
}

function EditReviewModal({ isOpen, onClose }: EditReviewModalProps) {
  const [gameTitle, setGameTitle] = useState('CYBERNETIC DRIFT')
  const [reviewTitle, setReviewTitle] = useState('RE-EVALUATING THE INTERFACE')
  const [rating, setRating] = useState('4.5')
  const [review, setReview] = useState(
    'Looking back, what was criticized as cluttered is actually incredibly utilitarian.',
  )

  if (!isOpen) {
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // 원본의 정적 편집 화면을 모달 폼으로 옮겼고, 제출은 React 이벤트로 제어합니다.
    event.preventDefault()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[var(--gjc-primary)]/50 p-4">
      <div className="w-full max-w-3xl border-4 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="mb-8 flex items-center justify-between border-b-4 border-[var(--gjc-primary)] pb-4">
          <h2 className="font-headline-lg text-3xl uppercase tracking-widest">
            EDIT_REVIEW
          </h2>
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
            <span className="font-label-caps text-sm uppercase tracking-widest">
              GAME_TITLE
            </span>
            <input
              className="border-2 border-primary bg-surface-container-low p-3 font-label-caps uppercase tracking-wider focus:outline-none focus:ring-0"
              // 정적 HTML input을 React controlled input으로 변환했습니다.
              onChange={(event) => setGameTitle(event.target.value)}
              type="text"
              value={gameTitle}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="font-label-caps text-sm uppercase tracking-widest">
              RATING
            </span>
            <input
              className="border-2 border-primary bg-surface-container-low p-3 font-label-caps uppercase tracking-wider focus:outline-none focus:ring-0"
              max="5"
              min="0"
              onChange={(event) => setRating(event.target.value)}
              step="0.5"
              type="number"
              value={rating}
            />
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="font-label-caps text-sm uppercase tracking-widest">
              REVIEW_TITLE
            </span>
            <input
              className="border-2 border-primary bg-surface-container-low p-3 font-label-caps uppercase tracking-wider focus:outline-none focus:ring-0"
              onChange={(event) => setReviewTitle(event.target.value)}
              type="text"
              value={reviewTitle}
            />
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="font-label-caps text-sm uppercase tracking-widest">
              REVIEW_CONTENT
            </span>
            <textarea
              className="min-h-[220px] border-2 border-primary bg-surface-container-low p-4 font-body-md text-sm focus:outline-none focus:ring-0"
              // 원본 textarea 내용을 React state로 보관해서 이후 API payload로 그대로 넘길 수 있게 했습니다.
              onChange={(event) => setReview(event.target.value)}
              value={review}
            />
          </label>

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
