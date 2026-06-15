import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, getApiErrorMessage } from '../api'
import type { JournalPost } from './Journals'
import PageChrome from './PageChrome'
import '../styles/JournalDetail.css'

type ReviewDetailPost = JournalPost & {
  game: JournalPost['game'] & {
    platforms?: string[]
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR')
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function ReviewDetail() {
  const { postId } = useParams()
  const [post, setPost] = useState<ReviewDetailPost | null>(null)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!postId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const fetchPost = async () => {
        try {
          setIsLoading(true)
          setMessage('')

          const response = await api.get<ReviewDetailPost>(`/posts/${postId}`)
          setPost(response.data)
        } catch (error) {
          setPost(null)
          setMessage(getApiErrorMessage(error, 'POST LOAD FAILED'))
        } finally {
          setIsLoading(false)
        }
      }

      void fetchPost()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [postId])

  const gameTitle = post?.game.title ?? 'UNKNOWN_GAME'
  const platform = post?.game.platforms?.[0] ?? 'UNKNOWN'
  const author = post?.user.nickname ?? 'PLAYER'
  const loggedAt = post ? formatDate(post.createdAt) : '-'
  const rating = post?.rating ?? 0
  const statusMessage = postId ? message : 'POST ID NOT FOUND'

  return (
    <PageChrome active="journals">
      <main className="journal-detail-page mx-auto w-full max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link
            className="inline-flex items-center gap-2 border-2 border-primary bg-background px-4 py-2 font-ui-button text-ui-button uppercase tracking-widest text-primary transition-colors duration-75 hover:bg-primary hover:text-on-primary"
            to="/journals"
          >
            <span aria-hidden="true">&lt;-</span>
            BACK_TO_LIST
          </Link>
        </div>

        {statusMessage ? (
          <div className="mb-8 border-2 border-primary bg-surface-container-lowest p-6 font-label-caps text-sm uppercase tracking-widest">
            {statusMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="border-2 border-primary bg-surface-container-lowest p-8 font-headline-lg text-2xl uppercase">
            LOADING_REVIEW...
          </div>
        ) : null}

        {post ? (
          <>
            <section className="mb-16 grid grid-cols-1 gap-gutter md:grid-cols-12">
              <div className="flex flex-col justify-end md:order-1 md:col-span-8">
                <div className="mb-4">
                  <p className="mb-1 font-label-caps text-label-caps text-secondary">AUTHOR</p>
                  <a className="group flex items-center gap-3" href="#profile">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden border-2 border-primary bg-surface-variant">
                      <span className="material-symbols-outlined text-primary">person</span>
                    </div>
                    <span className="font-ui-button text-ui-button group-hover:underline">{author}</span>
                  </a>
                </div>
                
                <h1 className="mb-6 font-headline-xl text-[40px] uppercase leading-none md:text-headline-xl">
                  {post.title}
                </h1>
                <div className="mb-4 w-fit border-2 border-[var(--gjc-primary)] bg-white p-4">
                  <p className="mb-2 font-label-caps text-label-caps text-secondary">RATING</p>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1 text-primary">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <span className="material-symbols-outlined text-[20px]" key={index}>
                          {index < Math.round(rating) ? 'star' : 'star_outline'}
                        </span>
                      ))}
                    </div>
                    <span className="font-ui-button text-ui-button">{rating}/5</span>
                  </div>
                </div>
                <div className="grid w-fit grid-cols-1 gap-6 border border-primary bg-white p-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 font-label-caps text-label-caps text-secondary">PLATFORM</p>
                    <p className="font-ui-button text-ui-button">{platform}</p>
                  </div>
                  <div>
                    <p className="mb-1 font-label-caps text-label-caps text-secondary">LOGGED</p>
                    <p className="font-ui-button text-ui-button">{loggedAt}</p>
                  </div>
                </div>
              </div>

              <div className="aspect-[0.75] overflow-hidden border-4 border-primary bg-surface-variant md:order-2 md:col-span-4">
                {post.game.imageUrl ? (
                  <img
                    alt={`${gameTitle} cover`}
                    className="h-full w-full object-cover grayscale contrast-125"
                    src={post.game.imageUrl}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-headline-xl text-6xl">
                    {getInitials(gameTitle)}
                  </div>
                )}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-16 md:grid-cols-12">
              <article className="space-y-8 font-body-lg text-body-lg md:col-span-8">
                <div>
                  <p className="whitespace-pre-wrap leading-relaxed">{post.content}</p>

                  {post.game.imageUrl ? (
                    <figure className="mb-12 mt-8">
                      <div className="border-2 border-primary bg-black p-1">
                        <img
                          alt={`${gameTitle} capture`}
                          className="h-auto w-full grayscale contrast-125"
                          src={post.game.imageUrl}
                        />
                      </div>
                      <figcaption className="mt-4 text-center font-label-caps text-label-caps uppercase italic text-secondary">
                        [Review Archive] {gameTitle}
                      </figcaption>
                    </figure>
                  ) : null}
                </div>
              </article>

              {/* <aside className="space-y-12 md:col-span-4">
                <section className="border-2 border-primary bg-white">
                  <div className="flex h-10 items-center border-b-2 border-primary px-4 journal-hatch-pattern">
                    <h4 className="font-label-caps text-label-caps font-bold">목차</h4>
                  </div>
                  <ul className="space-y-2 p-4 font-label-caps">
                    <li className="flex cursor-pointer items-center gap-2 text-primary hover:underline">
                      REVIEW_ENTRY
                    </li>
                    <li className="flex cursor-pointer items-center gap-2 pl-4 text-secondary hover:text-primary">
                      RATING
                    </li>
                  </ul>
                </section>
              </aside> */}
            </div>
          </>
        ) : null}
      </main>
    </PageChrome>
  )
}

export default ReviewDetail
