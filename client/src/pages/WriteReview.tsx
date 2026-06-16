import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FormEvent } from 'react'
import PageChrome from './PageChrome'
import { api, getApiErrorMessage } from '../api'
import GameSearchInput from './GameSearchInput'

type ReviewDuplicateResponse = {
  duplicate: boolean
  gameId: string | null
  matchedBy: 'game_id' | 'igdb' | 'title' | null
  message: string | null
  postId: string | null
}

function WriteReview() {
  const navigate = useNavigate()
  const [gameTitle, setGameTitle] = useState('')
  const [igdbGameId, setIgdbGameId] = useState<string | null>(null)
  const [reviewTitle, setReviewTitle] = useState('')
  const [rating, setRating] = useState('4.5')
  const [review, setReview] = useState('')
  const [message, setMessage] = useState('')
  const [duplicateReview, setDuplicateReview] = useState<{
    duplicate: boolean
    message: string | null
    status: 'idle' | 'checking' | 'ready'
  }>({
    duplicate: false,
    message: null,
    status: 'idle',
  })

  useEffect(() => {
    const title = gameTitle.trim()

    if (title.length < 2) {
      return
    }

    let isCancelled = false
    const timeoutId = window.setTimeout(async () => {
      setDuplicateReview((current) => ({
        ...current,
        status: 'checking',
      }))

      try {
        const params = new URLSearchParams({ gameTitle: title })

        if (igdbGameId) {
          params.set('igdbGameId', igdbGameId)
        }

        const response = await api.get<ReviewDuplicateResponse>(
          `/posts/reviews/duplicate?${params.toString()}`,
        )

        if (isCancelled) {
          return
        }

        setDuplicateReview({
          duplicate: response.data.duplicate,
          message: response.data.message,
          status: 'ready',
        })
      } catch (error) {
        if (isCancelled) {
          return
        }

        setDuplicateReview({
          duplicate: false,
          message: getApiErrorMessage(error, 'DUPLICATE CHECK FAILED'),
          status: 'ready',
        })
      }
    }, 300)

    return () => {
      isCancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [gameTitle, igdbGameId])

  const resetDuplicateReview = () => {
    setDuplicateReview({
      duplicate: false,
      message: null,
      status: 'idle',
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // 정적 HTML form의 required/value 속성을 React state 기반 제출 흐름으로 변환했습니다.
    event.preventDefault()

    if (duplicateReview.duplicate) {
      setMessage(duplicateReview.message ?? '이미 리뷰가 존재합니다.')
      return
    }

    try {
      await api.post('/posts', {
        type: 'REVIEW',
        gameTitle,
        igdbGameId: igdbGameId ?? undefined,
        title: reviewTitle,
        content: review,
        rating: parseFloat(rating),
      })

      navigate('/journals')
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'POST FAILED'))
    }
  }

  const isSubmitBlocked =
    duplicateReview.status === 'checking' || duplicateReview.duplicate

  return (
    <PageChrome active="journals">
      <main className="write-review-page flex-grow w-full max-w-[1200px] mx-auto px-8 py-20 flex flex-col gap-[80px]">
        <div className="mb-16">
          <h1 className="font-headline-xl text-headline-xl uppercase">
            #REVIEW
          </h1>
          <div className="w-24 h-2 bg-[var(--gjc-primary)] mt-4"></div>
        </div>
        <form
          className="grid grid-cols-12 gap-x-gutter gap-y-10"
          onSubmit={handleSubmit}
        >
          <label className="col-span-12 flex flex-col gap-2 md:col-span-8">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              GAME_TITLE *
            </span>
            <GameSearchInput
              inputClassName="w-full border-2 border-primary bg-surface p-4 font-body-lg text-body-lg"
              onChange={(value) => {
                setGameTitle(value)
                setIgdbGameId(null)
                resetDuplicateReview()
              }}
              onSelect={(game) => {
                setGameTitle(game.title)
                setIgdbGameId(game.externalId.id)
                resetDuplicateReview()
              }}
              placeholder="ENTER_GAME_TITLE"
              selectedIgdbGameId={igdbGameId}
              value={gameTitle}
            />
            {duplicateReview.status === 'checking' ? (
              <span className="font-label-caps text-[10px] uppercase text-on-surface-variant">
                CHECKING_REVIEW_DUPLICATE
              </span>
            ) : null}
            {duplicateReview.duplicate ? (
              <span className="font-label-caps text-[10px] text-primary">
                {duplicateReview.message ?? '이미 리뷰가 존재합니다.'}
              </span>
            ) : null}
          </label>

          <label className="col-span-12 flex flex-col gap-2 md:col-span-4">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              RATING *
            </span>
            <input
              className="w-full border-2 border-primary bg-surface p-4 font-body-lg text-body-lg"
              max="5"
              min="1"
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
              className="flex-grow border-2 border-[var(--gjc-primary)] bg-[var(--gjc-primary)] py-6 font-ui-button text-ui-button uppercase text-[var(--gjc-on-primary)] transition-all duration-75 hover:bg-[var(--gjc-surface)] hover:text-[var(--gjc-primary)] disabled:cursor-not-allowed disabled:opacity-50 md:min-w-[240px] md:flex-grow-0"
              disabled={isSubmitBlocked}
              type="submit"
            >
              {duplicateReview.status === 'checking' ? 'CHECKING' : 'POST'}
            </button>
            <button
              className="flex-grow border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface)] py-6 font-ui-button text-ui-button uppercase text-[var(--gjc-primary)] transition-all duration-75 hover:bg-[var(--gjc-surface-container)] md:min-w-[240px] md:flex-grow-0"
              type="button"
              onClick={() => navigate('/journals')}
            >
              CANCEL
            </button>
          </div>
        </form>

        {message ? (
          <p className="mt-8 font-label-caps text-primary">{message}</p>
        ) : null}
      </main>
    </PageChrome>
  )
}

export default WriteReview
