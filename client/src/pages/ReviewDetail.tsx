import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, getApiErrorMessage } from '../api'
import DeleteReviewModal from './DeleteReviewModal'
import EditReviewModal from './EditReviewModal'
import type { JournalPost } from './Journals'
import PageChrome from './PageChrome'
import ProfileAvatar, {
  PROFILE_AVATAR_COLOR_IMAGE_CLASS,
} from './ProfileAvatar'
import '../styles/JournalDetail.css'

type ReviewDetailPost = JournalPost & {
  game: JournalPost['game'] & {
    platforms?: string[]
  }
}

type DetailModal = 'edit-review' | 'delete-review' | null

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

function getStarIcon(rating: number, index: number) {
  const starValue = index + 1

  if (rating >= starValue) {
    return 'star'
  }

  if (rating >= starValue - 0.5) {
    return 'star_half'
  }

  return 'star'
}

function getStarFill(rating: number, index: number) {
  const starValue = index + 1

  return rating >= starValue - 0.5 ? 1 : 0
}

function ReviewDetail() {
  const location = useLocation()
  const navigate = useNavigate()
  const { postId } = useParams()
  const [post, setPost] = useState<ReviewDetailPost | null>(null)
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 리뷰 상세에서 열 수 있는 게시글 관리 모달 상태입니다.
  // edit-review는 리뷰 수정 모달, delete-review는 리뷰 삭제 확인 모달입니다.
  // 실제 버튼은 post.canEdit이 true일 때만 렌더링되므로 작성자 본인만 모달을 열 수 있습니다.
  const [activeModal, setActiveModal] = useState<DetailModal>(null)

  const fetchPost = useCallback(async () => {
    if (!postId) {
      return
    }

    try {
      setIsLoading(true)
      setMessage('')

      // 상세 페이지는 진입 경로와 상관없이 GET /posts/:id 응답의 canEdit을 신뢰합니다.
      // canEdit은 서버가 현재 로그인 사용자와 게시글 작성자를 비교해서 계산한 값이므로,
      // 타임라인에서 리뷰를 클릭해서 들어와도 내 게시글이면 수정/삭제 버튼을 보여줄 수 있습니다.
      const response = await api.get<ReviewDetailPost>(`/posts/${postId}`)
      if (response.data.type !== 'REVIEW') {
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
  }, [postId])

  useEffect(() => {
    if (!postId) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void fetchPost()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchPost, postId])

  const closeModal = () => {
    setActiveModal(null)
  }

  const gameTitle = post?.game.title ?? 'UNKNOWN_GAME'
  const platform = post?.game.platforms?.[0] ?? 'UNKNOWN'
  const author = post?.user.nickname ?? 'PLAYER'
  const authorProfileImageUrl = post?.user.profileImageUrl ?? null
  const loggedAt = post ? formatDate(post.createdAt) : '-'
  const rating = post?.rating ?? 0
  const statusMessage = postId ? message : 'POST ID NOT FOUND'
  // Timeline에서 들어온 경우에는 뒤로가기와 삭제 후 이동을 /timeline으로 맞춥니다.
  // location.state가 없는 직접 접근은 기존 동작처럼 /journals를 기본 복귀 경로로 사용합니다.
  const returnPath = (location.state as { from?: string } | null)?.from ?? '/journals'

  return (
    <PageChrome active="journals">
      <main className="journal-detail-page mx-auto w-full max-w-[1200px] px-8 py-12">
        <div className="mb-8">
          <Link
            className="inline-flex items-center gap-2 border-2 border-primary bg-background px-4 py-2 font-ui-button text-ui-button uppercase tracking-widest text-primary transition-colors duration-75 hover:bg-primary hover:text-on-primary"
            to={returnPath}
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
                {/* 이 태그는 게임 장르/Steam 태그가 아니라 게시글 타입 태그입니다.
                    타임라인 카드의 타입 배지와 같은 디자인으로 붙여 상세 화면에서도 REVIEW 글임을 바로 알 수 있게 합니다. */}
                <div className="mb-4 w-fit border border-primary bg-surface px-3 py-1 font-label-caps text-label-caps text-primary">
                  {post.type}
                </div>
                <div className="mb-4">
                  <p className="mb-1 font-label-caps text-label-caps text-secondary">AUTHOR</p>
                  <a className="group flex items-center gap-3" href="#profile">
                    <ProfileAvatar
                      alt={`${author} profile`}
                      className="flex h-10 w-10 items-center justify-center overflow-hidden border-2 border-primary bg-surface-variant"
                      imageClassName={PROFILE_AVATAR_COLOR_IMAGE_CLASS}
                      profileImageUrl={authorProfileImageUrl}
                    />
                    <span className="font-ui-button text-ui-button group-hover:underline">{author}</span>
                  </a>
                </div>
                
                <h1 className="mb-6 font-headline-xl text-[40px] uppercase leading-none md:text-headline-xl">
                  {post.title}
                </h1>
                {post.canEdit ? (
                  <div className="mb-6 flex flex-wrap gap-3">
                    {/* 목록이 아니라 타임라인에서 리뷰 상세로 들어와도 권한 판단 방식은 같습니다.
                        상세 API의 canEdit 값이 true이면 현재 로그인 사용자가 작성자라는 뜻이므로
                        여기서 EDIT/DELETE 버튼을 보여줍니다. */}
                    <button
                      className="border-2 border-primary bg-surface-container-lowest px-5 py-2 font-ui-button text-xs uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-on-primary"
                      onClick={() => setActiveModal('edit-review')}
                      type="button"
                    >
                      EDIT
                    </button>
                    <button
                      className="border-2 border-primary bg-[var(--gjc-on-error-fixed)] px-5 py-2 font-ui-button text-xs uppercase tracking-widest text-[var(--gjc-on-primary)] transition-colors hover:bg-[var(--gjc-on-primary)] hover:text-[var(--gjc-primary)]"
                      onClick={() => setActiveModal('delete-review')}
                      type="button"
                    >
                      DELETE
                    </button>
                  </div>
                ) : null}
                <div className="mb-4 w-fit border-2 border-[var(--gjc-primary)] bg-white p-4">
                  <p className="mb-2 font-label-caps text-label-caps text-secondary">RATING</p>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1 text-primary">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <span
                          className="material-symbols-outlined text-[20px]"
                          key={index}
                          style={{
                            fontVariationSettings: `'FILL' ${getStarFill(rating, index)}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
                          }}
                        >
                          {getStarIcon(rating, index)}
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
                    className="h-full w-full object-cover contrast-125"
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

      <EditReviewModal
        isOpen={activeModal === 'edit-review'}
        post={post}
        onClose={closeModal}
        // 리뷰 수정 후에는 상세 데이터를 다시 조회해서 최신 제목/본문/평점이 바로 보이게 합니다.
        onSaved={fetchPost}
      />
      <DeleteReviewModal
        isOpen={activeModal === 'delete-review'}
        post={post}
        onClose={closeModal}
        // 삭제 후에는 더 이상 현재 postId로 상세 조회가 불가능합니다.
        // 그래서 삭제 성공 콜백에서 타임라인 또는 저널 목록으로 이동시킵니다.
        onDeleted={() => navigate(returnPath)}
      />
    </PageChrome>
  )
}

export default ReviewDetail
