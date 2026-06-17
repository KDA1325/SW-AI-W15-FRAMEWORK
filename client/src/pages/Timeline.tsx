import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, getApiErrorMessage } from '../api'
import PageChrome from './PageChrome'
import ProfileAvatar, {
  PROFILE_AVATAR_GRAYSCALE_HOVER_IMAGE_CLASS,
} from './ProfileAvatar'
import type { JournalPost, PostListResponse } from '../types/posts'

type TimelineFilter = 'ALL' | 'REVIEW' | 'JOURNAL'

// 서버에서 내려오는 createdAt은 ISO 문자열입니다.
// 화면에서는 사용자가 읽기 쉽도록 날짜와 시간을 분리해서 보여주기 때문에
// 날짜 포맷 함수와 시간 포맷 함수를 따로 두었습니다.
function formatTimelineDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR')
}

function formatTimelineTime(value: string) {
  return new Date(value).toLocaleTimeString('ko-KR')
}

function getGameInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

// 타임라인에는 저널과 리뷰가 한 목록에 섞여서 들어옵니다.
// 상세 페이지 라우트는 타입별로 다르므로, 카드 클릭 전에 post.type을 보고
// REVIEW는 /review-detail/:postId, JOURNAL은 /journal-detail/:postId로 나눠 보냅니다.
function getDetailPath(post: JournalPost) {
  return post.type === 'REVIEW' ? `/review-detail/${post.id}` : `/journal-detail/${post.id}`
}

function Timeline() {
  // filter는 현재 선택된 타입 필터입니다.
  // ALL: type 쿼리 없이 전체 게시글 조회
  // REVIEW: /posts?type=REVIEW 조회
  // JOURNAL: /posts?type=JOURNAL 조회
  const [filter, setFilter] = useState<TimelineFilter>('ALL')
  const [page, setPage] = useState(1)
  const [pageInfo, setPageInfo] = useState({
    hasNextPage: false,
    total: 0,
  })

  // posts에는 현재 필터 조건에 맞춰 서버에서 받아온 타임라인 카드 목록을 저장합니다.
  // 이전 목업 배열 대신 이 state를 map 해서 화면을 그립니다.
  const [posts, setPosts] = useState<JournalPost[]>([])

  // message는 API 실패 같은 사용자에게 보여줄 상태 메시지입니다.
  // getApiErrorMessage를 거쳐 서버 오류 메시지를 화면 문구로 정리해 넣습니다.
  const [message, setMessage] = useState('')

  // isLoading은 목록을 불러오는 동안 LOADING_TIMELINE 문구를 보여주기 위한 상태입니다.
  // 빈 목록 메시지와 동시에 보이지 않게 아래 JSX에서 함께 사용합니다.
  const [isLoading, setIsLoading] = useState(false)

  // Image URLs may come from IGDB, Steam, or seeded DB data; track failures per post so one broken cover falls back safely.
  const [failedImagePostIds, setFailedImagePostIds] = useState<Set<string>>(
    () => new Set(),
  )

  const markImageFailed = useCallback((postId: string) => {
    setFailedImagePostIds((current) => new Set(current).add(postId))
  }, [])

  // 타임라인은 더 이상 화면 안의 목업 배열을 사용하지 않고 서버의 게시글 목록 API를 사용합니다.
  // 서버는 이미 GET /posts?type=REVIEW 또는 GET /posts?type=JOURNAL 형식의 타입 필터를 지원합니다.
  // 그래서 ALL일 때는 type 쿼리를 보내지 않아 전체 글을 받고,
  // REVIEW/JOURNAL을 선택했을 때만 type 쿼리를 붙여 해당 타입의 글만 받아옵니다.
  //
  // URLSearchParams를 쓰는 이유:
  // - 쿼리스트링을 문자열 더하기로 직접 만들면 ?와 & 처리 실수가 나기 쉽습니다.
  // - 필터가 ALL인지 아닌지에 따라 type을 조건부로 붙이기 쉽습니다.
  // - 나중에 page, q 같은 조건이 추가되어도 params.set(...)만 늘리면 됩니다.
  const fetchTimelinePosts = useCallback(async () => {
    try {
      setIsLoading(true)
      setMessage('')

      const params = new URLSearchParams({
        // 타임라인은 최신 활동 피드이므로 최신순 정렬을 기본값으로 고정합니다.
        sort: 'latest',
        // 현재 서버가 허용하는 목록 크기 값이 5, 10, 15라서 10개를 기본 표시 개수로 사용합니다.
        limit: '10',
        page: String(page),
      })

      // ALL은 "전체"라는 UI 상태일 뿐 서버의 ArchivePostType 값은 아닙니다.
      // 따라서 ALL을 type=ALL로 보내면 서버 필터와 맞지 않으므로 type 쿼리를 아예 생략합니다.
      if (filter !== 'ALL') {
        params.set('type', filter)
      }

      const response = await api.get<PostListResponse>(`/posts?${params.toString()}`)
      setPageInfo({
        hasNextPage: response.data.hasNextPage,
        total: response.data.total,
      })
      // GJC-140: later pages append by id so repeated clicks or overlapping data cannot duplicate cards.
      setPosts((currentPosts) => {
        if (page === 1) {
          return response.data.items
        }

        const seen = new Set(currentPosts.map((post) => post.id))
        const nextPosts = response.data.items.filter((post) => !seen.has(post.id))

        return [...currentPosts, ...nextPosts]
      })
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'TIMELINE LOAD FAILED'))
    } finally {
      // 성공/실패와 상관없이 요청이 끝나면 로딩 표시는 꺼야 합니다.
      setIsLoading(false)
    }
  }, [filter, page])

  // 필터 버튼을 누르면 filter state가 바뀝니다.
  // fetchTimelinePosts는 filter를 의존하고 있으므로, filter가 바뀔 때마다 새 함수로 만들어집니다.
  // 이 useEffect는 그 변화를 감지해서 목록을 다시 불러오게 합니다.
  // 결과적으로 ALL/REVIEWS/JOURNALS 버튼이 단순 스타일 버튼이 아니라 실제 API 필터처럼 동작합니다.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchTimelinePosts()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchTimelinePosts])

  // 이전 구현은 ALL 버튼에 활성화 class가 고정되어 있어서 다른 필터를 눌러도 ALL만 선택된 것처럼 보였습니다.
  // 지금은 현재 filter 값과 버튼이 의미하는 값을 비교해서 선택된 버튼만 primary 배경을 갖게 합니다.
  const getFilterButtonClass = (value: TimelineFilter) =>
    [
      'px-4 py-2 border-2 border-primary font-ui-button text-xs transition-colors duration-0 cursor-pointer',
      filter === value
        ? 'bg-[var(--gjc-primary)] text-[var(--gjc-on-primary)]'
        : 'hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)]',
    ].join(' ')
  const changeFilter = (nextFilter: TimelineFilter) => {
    if (nextFilter === filter) {
      return
    }

    setFilter(nextFilter)
    setPage(1)
    setPosts([])
    setFailedImagePostIds(new Set())
  }

  return (
    <PageChrome active="timeline">
      <main className="timeline-page flex-grow w-full max-w-[1200px] mx-auto px-8 py-20 flex flex-col gap-[80px]">
        <div className="mb-6 flex items-center justify-between border-b-2 border-[var(--gjc-primary)] pb-3">
          <h2 className="mb-16 flex items-center gap-4 font-[DotGothic16,sans-serif] text-center text-headline-xl uppercase">
            TIMELINE
          </h2>

          <div className="flex gap-2 mt-4 md:mt-0">
            {/* 버튼을 누르면 filter state만 바꿉니다. 실제 API 재호출은 위 useEffect가 담당합니다. */}
            <button
              className={getFilterButtonClass('ALL')}
              id="filter-all"
              onClick={() => changeFilter('ALL')}
              type="button"
            >
              ALL
            </button>
            <button
              className={getFilterButtonClass('REVIEW')}
              id="filter-reviews"
              onClick={() => changeFilter('REVIEW')}
              type="button"
            >
              REVIEWS
            </button>
            <button
              className={getFilterButtonClass('JOURNAL')}
              id="filter-journals"
              onClick={() => changeFilter('JOURNAL')}
              type="button"
            >
              JOURNALS
            </button>
          </div>
        </div>

        {message ? <p className="font-label-caps text-xs uppercase text-primary">{message}</p> : null}
        {isLoading ? <p className="font-label-caps text-xs uppercase text-secondary">LOADING_TIMELINE...</p> : null}

        <div className="relative flex flex-col gap-10">
          <div className="absolute bottom-0 top-0 hidden border-l-2 border-dashed border-primary opacity-60 md:block" />

          {/* 로딩 중에는 아직 응답이 오지 않았으므로 빈 목록으로 판단하지 않습니다.
              요청이 끝난 뒤에도 posts가 비어 있을 때만 "표시할 타임라인 글이 없음"을 보여줍니다. */}
          {!isLoading && posts.length === 0 ? (
            <p className="font-label-caps text-xs uppercase tracking-wider text-secondary">
              NO_TIMELINE_POSTS
            </p>
          ) : null}

          {posts.map((post) => {
            const hasGameImage = Boolean(post.game.imageUrl && !failedImagePostIds.has(post.id))

            return (
              <article className="group relative flex flex-col gap-6 md:flex-row" key={post.id}>
                <div className="relative flex flex-shrink-0 items-center gap-4 pt-1 md:w-32 md:flex-col md:items-end md:gap-1">
                  <div className="hidden font-label-caps text-label-caps text-secondary md:block">
                    {formatTimelineDate(post.createdAt)}
                  </div>
                  <div className="hidden font-label-caps text-label-caps font-bold text-primary md:block">
                    {formatTimelineTime(post.createdAt)}
                  </div>
                  <div className="z-20 h-4 w-4 border-2 border-primary bg-on-primary transition-colors duration-0 group-hover:bg-primary md:absolute md:-left-2 md:top-2" />
                  <div className="ml-4 font-label-caps text-label-caps text-secondary md:hidden">
                    {formatTimelineDate(post.createdAt)} // {formatTimelineTime(post.createdAt)}
                  </div>
                </div>

                <Link
                  className="flex-1 border-2 border-primary bg-surface p-6 transition-shadow duration-0 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                  // 상세 페이지는 직접 URL로 들어올 수도 있고, 저널 목록에서 들어올 수도 있습니다.
                  // 타임라인에서 들어왔다는 정보를 Link state로 넘겨 두면
                  // 상세 페이지의 BACK_TO_LIST와 삭제 후 이동 경로를 /timeline으로 맞출 수 있습니다.
                  // 이 값은 URL에 노출되지 않고 React Router 내부 navigation state로만 전달됩니다.
                  state={{ from: '/timeline' }}
                  to={getDetailPath(post)}
                >
                  <div className="mb-6 flex items-center gap-4 border-b border-dashed border-primary pb-4">
                    <div className="relative flex h-20 w-16 flex-shrink-0 items-center justify-center overflow-hidden border-2 border-primary bg-surface-container-low">
                      {hasGameImage ? (
                        <img
                          alt={`${post.game.title} cover`}
                          className="h-full w-full object-cover grayscale contrast-125 transition-all duration-200 group-hover:grayscale-0"
                          onError={() => markImageFailed(post.id)}
                          src={post.game.imageUrl ?? undefined}
                        />
                      ) : (
                        <>
                          <div className="pixel-hatch absolute inset-0 bg-primary opacity-10" />
                          <span className="z-10 font-headline-lg text-xl text-primary">
                            {getGameInitials(post.game.title) || '??'}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      <ProfileAvatar
                        alt={`${post.user.nickname} profile`}
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden border-2 border-primary bg-surface-variant"
                        imageClassName={PROFILE_AVATAR_GRAYSCALE_HOVER_IMAGE_CLASS}
                        profileImageUrl={post.user.profileImageUrl}
                      />
                      <div className="min-w-0">
                        <div className="font-ui-button text-ui-button text-primary">
                          {post.user.nickname}
                        </div>
                        <div className="font-label-caps text-label-caps text-secondary">
                          #{post.game.title}
                        </div>
                      </div>
                    </div>
                    <div className="ml-auto border border-primary bg-surface px-3 py-1 font-label-caps text-label-caps text-primary">
                      {post.type}
                    </div>
                  </div>

                  <h2 className="mb-2 font-headline-lg text-headline-lg uppercase text-primary">
                    {post.title}
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface">
                    {post.content}
                  </p>
                </Link>
              </article>
            )
          })}
        </div>
        <div className="flex flex-col items-center gap-3 border-t-2 border-dashed border-primary pt-8">
          <span className="font-label-caps text-xs uppercase text-secondary">
            DISPLAYING {posts.length} / {pageInfo.total}
          </span>
          <button
            className="border-2 border-primary bg-surface px-6 py-3 font-ui-button text-xs uppercase tracking-widest transition-colors enabled:hover:bg-primary enabled:hover:text-on-primary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isLoading || !pageInfo.hasNextPage}
            onClick={() => setPage((currentPage) => currentPage + 1)}
            type="button"
          >
            {pageInfo.hasNextPage ? 'LOAD_MORE' : 'END_OF_TIMELINE'}
          </button>
        </div>
      </main>
    </PageChrome>
  )
}

export default Timeline
