import { useState } from 'react'
import type { FormEvent } from 'react'
import PageChrome from './PageChrome'

function WriteReview() {
  const [gameTitle, setGameTitle] = useState('')
  const [reviewTitle, setReviewTitle] = useState('')
  const [rating, setRating] = useState('4.5')
  const [review, setReview] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // 정적 HTML form의 required/value 속성을 React state 기반 제출 흐름으로 변환했습니다.
    event.preventDefault()
    setMessage('REVIEW_POSTED')
  }

  return (
    <PageChrome active="journals">
      <main className="mx-auto w-full max-w-container-max px-margin py-20">
        <div className="mb-16">
          <h1 className="font-headline-xl text-headline-xl uppercase">#REVIEW</h1>
          <div className="mt-4 h-2 w-24 bg-primary" />
        </div>

        <form className="grid grid-cols-12 gap-x-gutter gap-y-10" onSubmit={handleSubmit}>
          <label className="col-span-12 flex flex-col gap-2 md:col-span-8">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              GAME_TITLE *
            </span>
            <input
              className="w-full border-2 border-primary bg-surface p-4 font-body-lg text-body-lg"
              onChange={(event) => setGameTitle(event.target.value)}
              placeholder="ENTER_GAME_TITLE"
              required
              type="text"
              value={gameTitle}
            />
          </label>

          <label className="col-span-12 flex flex-col gap-2 md:col-span-4">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              RATING *
            </span>
            <input
              className="w-full border-2 border-primary bg-surface p-4 font-body-lg text-body-lg"
              max="5"
              min="0"
              onChange={(event) => setRating(event.target.value)}
              required
              step="0.5"
              type="number"
              value={rating}
            />
          </label>

          <label className="col-span-12 flex flex-col gap-2">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              REVIEW_TITLE *
            </span>
            <input
              className="w-full border-2 border-primary bg-surface p-4 font-body-md text-body-md"
              maxLength={120}
              onChange={(event) => setReviewTitle(event.target.value)}
              placeholder="ENTER_REVIEW_TITLE"
              required
              type="text"
              value={reviewTitle}
            />
          </label>

          <label className="col-span-12 flex flex-col gap-2">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              REVIEW_CONTENT *
            </span>
            <textarea
              className="min-h-[420px] w-full resize-none border-2 border-primary bg-surface p-6 font-body-md text-body-md"
              onChange={(event) => setReview(event.target.value)}
              placeholder="WRITE_CRITICAL_LOG..."
              required
              value={review}
            />
          </label>

          <div className="col-span-12 flex flex-col gap-gutter pt-8 md:flex-row">
            <button
              className="flex-grow border-2 border-primary bg-primary py-6 font-ui-button text-ui-button uppercase text-on-primary transition-all duration-75 hover:bg-surface hover:text-primary active:scale-95 md:min-w-[240px] md:flex-grow-0"
              type="submit"
            >
              POST_REVIEW
            </button>
            <button
              className="flex-grow border-2 border-primary bg-surface py-6 font-ui-button text-ui-button uppercase text-primary transition-all duration-75 hover:bg-surface-dim active:scale-95 md:min-w-[240px] md:flex-grow-0"
              type="button"
            >
              CANCEL
            </button>
          </div>
        </form>

        {message ? <p className="mt-8 font-label-caps text-primary">{message}</p> : null}
      </main>
    </PageChrome>
  )
}

export default WriteReview
