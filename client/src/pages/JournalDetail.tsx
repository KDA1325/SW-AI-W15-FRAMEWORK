import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, getApiErrorMessage } from '../api'
import type { JournalPost } from './Journals'
import PageChrome from './PageChrome'
import '../styles/JournalDetail.css'

type DetailComment = {
  id: string
  content: string
  parentCommentId: string | null
  createdAt: string
  user: {
    nickname: string
  }
  replies?: DetailComment[]
}

type JournalDetailPost = JournalPost & {
  game: JournalPost['game'] & {
    description?: string | null
    genres?: string[]
    platforms?: string[]
    tags?: string[]
  }
  comments?: DetailComment[]
}

const tableOfContents = [
  { label: 'JOURNAL_ENTRY', active: true },
  { label: 'GAME_CONTEXT' },
  { label: 'PLAYER_NOTE' },
  { label: 'COMMENTS', active: true },
]

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

function JournalDetail() {
  const { postId } = useParams()
  const [post, setPost] = useState<JournalDetailPost | null>(null)
  const [comment, setComment] = useState('')
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

          const response = await api.get<JournalDetailPost>(`/posts/${postId}`)
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

  const submitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setComment('')
  }

  const topLevelComments = (post?.comments ?? [])
    .filter((entry) => entry.parentCommentId === null)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))

  const gameTitle = post?.game.title ?? 'UNKNOWN_GAME'
  const platform = post?.game.platforms?.[0] ?? 'UNKNOWN'
  const author = post?.user.nickname ?? 'PLAYER'
  const loggedAt = post ? formatDate(post.createdAt) : '-'
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
            LOADING_JOURNAL...
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

                <p className="mb-2 font-label-caps text-label-caps uppercase text-secondary">#{gameTitle}</p>
                <h1 className="mb-6 font-headline-xl text-[40px] uppercase leading-none md:text-headline-xl">
                  {post.title}
                </h1>

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
                  {/* <h2 className="mb-6 border-b-2 border-primary pb-2 font-headline-lg text-headline-lg uppercase">
                    JOURNAL_ENTRY
                  </h2> */}
                  <p className="whitespace-pre-wrap leading-relaxed">{post.content}</p>

                  {/* {post.game.description ? (
                    <>
                      <h3 className="mb-4 mt-8 font-headline-lg text-headline-lg-mobile uppercase">
                        GAME_CONTEXT
                      </h3>
                      <p className="mb-8 whitespace-pre-wrap">{post.game.description}</p>
                    </>
                  ) : null}

                  {post.game.tags?.length ? (
                    <ul className="mb-8 list-none space-y-4">
                      {post.game.tags.map((tag) => (
                        <li className="flex items-start gap-4" key={tag}>
                          <span className="material-symbols-outlined mt-1 text-primary">pixel_6</span>
                          <span>{tag}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null} */}

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
                        [Game Archive] {gameTitle}
                      </figcaption>
                    </figure>
                  ) : null}
                </div>

                <section className="mt-12 space-y-8 border-t-2 border-primary pt-12">
                  <h2 className="font-headline-lg text-headline-lg uppercase">댓글</h2>

                  <form className="space-y-4 border-2 border-primary bg-white p-6" onSubmit={submitComment}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">person</span>
                      <span className="font-label-caps text-label-caps uppercase">USER_ID: {author}</span>
                    </div>
                    <textarea
                      className="h-32 w-full resize-none border border-primary bg-surface-container-lowest p-4 font-body-md focus:border-primary focus:outline-none focus:ring-0"
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="INITIATE_RESPONSE..."
                      value={comment}
                    />
                    <div className="flex justify-end">
                      <button
                        className="border-2 border-primary bg-[var(--gjc-primary)] px-6 py-2 font-ui-button text-ui-button uppercase text-[var(--gjc-on-primary)] transition-colors hover:bg-[var(--gjc-white)] hover:text-black"
                        type="submit"
                      >
                        등록
                      </button>
                    </div>
                  </form>

                  <div className="space-y-6">
                    {topLevelComments.length ? (
                      topLevelComments.map((entry) => (
                        <div className="border border-primary bg-surface-container-lowest p-4" key={entry.id}>
                          <div className="mb-2 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-xs">person</span>
                              <span className="font-label-caps text-label-caps font-bold">
                                {entry.user.nickname}
                              </span>
                            </div>
                            <span className="font-label-caps text-xs text-secondary">
                              {formatDate(entry.createdAt)}
                            </span>
                          </div>
                          <p className="font-body-md text-body-md">{entry.content}</p>
                          <div className="mt-4 flex flex-col gap-4">
                            <button
                              className="w-fit font-ui-button text-xs uppercase tracking-widest text-primary hover:underline"
                              type="button"
                            >
                              [ REPLY ]
                            </button>
                            {(entry.replies ?? []).map((reply) => (
                              <div
                                className="ml-8 mt-4 border-t-2 border-surface-container-highest pt-4"
                                key={reply.id}
                              >
                                <div className="border border-primary bg-white p-4">
                                  <div className="mb-2 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                      <span className="material-symbols-outlined text-xs">person</span>
                                      <span className="font-label-caps text-label-caps font-bold">
                                        {reply.user.nickname}
                                      </span>
                                    </div>
                                    <span className="font-label-caps text-xs text-secondary">
                                      {formatDate(reply.createdAt)}
                                    </span>
                                  </div>
                                  <p className="font-body-md text-body-md">{reply.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="border border-primary bg-surface-container-lowest p-4 font-label-caps text-xs uppercase text-secondary">
                        NO_COMMENTS_YET
                      </p>
                    )}
                  </div>
                </section>
              </article>

              <aside className="space-y-12 md:col-span-4">
                <section className="border-2 border-primary bg-white">
                  <div className="flex h-10 items-center border-b-2 border-primary px-4 journal-hatch-pattern">
                    <h4 className="font-label-caps text-label-caps font-bold">목차</h4>
                  </div>
                  <ul className="space-y-2 p-4 font-label-caps">
                    {tableOfContents.map((item) => (
                      <li
                        className={`flex cursor-pointer items-center gap-2 hover:text-primary ${
                          item.active ? 'text-primary hover:underline' : 'pl-4 text-secondary'
                        }`}
                        key={item.label}
                      >
                        {/* {item.active ? (
                          <span className="text-xs">&gt;</span>
                        ) : (
                          <span className="material-symbols-outlined text-xs">pixel_6</span>
                        )} */}
                        {item.label}
                      </li>
                    ))}
                  </ul>
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </main>
    </PageChrome>
  )
}

export default JournalDetail
