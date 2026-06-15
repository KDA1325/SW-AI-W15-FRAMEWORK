import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, getApiErrorMessage } from '../api'
import type { JournalPost } from './Journals'
import PageChrome from './PageChrome'
import '../styles/JournalDetail.css'

type DetailComment = {
  id: string
  postId: string
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
  // App.tsx에서 /journal-detail/:postId 라우트를 등록했습니다.
  // 여기서 postId는 URL에 들어있는 실제 게시글 id입니다.
  // 예: /journal-detail/abc-123 으로 들어오면 postId === 'abc-123' 이 됩니다.
  // 이 값을 API 경로 /posts/:id에 넣어 현재 보고 있는 게시글 하나만 DB에서 조회합니다.
  const { postId } = useParams()
  const [post, setPost] = useState<JournalDetailPost | null>(null)
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  useEffect(() => {
    if (!postId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const fetchPost = async () => {
        try {
          setIsLoading(true)
          setMessage('')

          // 상세 API 호출 흐름:
          // 1. 목록에서 넘어온 postId를 이용해 GET /posts/:id 요청을 보냅니다.
          // 2. 서버는 ArchivePost와 연결된 game, user, comments 정보를 함께 조회합니다.
          // 3. 응답을 post state에 저장하면 아래 JSX가 DB 값을 기준으로 다시 렌더링됩니다.
          const response = await api.get<JournalDetailPost>(`/posts/${postId}`)
          if (response.data.type !== 'JOURNAL') {
            setPost(null)
            setMessage('POST ID NOT FOUND')
            return
          }

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

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const content = comment.trim()

    if (!post || !content) {
      return
    }

    try {
      setIsSubmittingComment(true)
      setMessage('')

      const response = await api.post<JournalDetailPost>(`/posts/${post.id}/comments`, {
        content,
      })

      setPost(response.data)
      setComment('')
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'COMMENT SAVE FAILED'))
    } finally {
      setIsSubmittingComment(false)
    }
  }

  // 상세 API 응답의 comments 안에는 이 게시글에 연결된 댓글들이 들어옵니다.
  // 그래도 화면에서는 한 번 더 postId를 확인합니다.
  // 이유:
  // - 댓글 엔티티에는 postId 컬럼이 있어서 어떤 게시글의 댓글인지 알 수 있습니다.
  // - entry.postId === post.id 조건으로 현재 상세 페이지의 게시글 댓글만 남깁니다.
  // - parentCommentId === null 조건으로 대댓글이 아닌 최상위 댓글만 먼저 화면에 배치합니다.
  // - 대댓글은 각 댓글의 replies 배열에서 따로 렌더링합니다.
  const topLevelComments = (post?.comments ?? [])
    .filter((entry) => entry.postId === post?.id && entry.parentCommentId === null)
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
                        disabled={isSubmittingComment}
                        type="submit"
                      >
                        {isSubmittingComment ? '등록중...' : '등록'}
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
                            {(entry.replies ?? [])
                              // replies는 특정 댓글의 대댓글 목록입니다.
                              // 대댓글도 Comment 테이블의 한 행이므로 postId를 가지고 있습니다.
                              // 혹시 다른 게시글의 대댓글이 섞여 들어오는 상황을 막기 위해
                              // 현재 post.id와 같은 데이터만 한 번 더 필터링합니다.
                              .filter((reply) => reply.postId === post.id)
                              .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
                              .map((reply) => (
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

              {/* <aside className="space-y-12 md:col-span-4">
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
                        {item.label}
                      </li>
                    ))}
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

export default JournalDetail
