# GJC-170 프로필 아카이브 리뷰 로그 DB 연동 학습 정리

## 1. 작업 범위

- 프론트엔드: Profile 페이지의 `ARCHIVE_LOG` 더미 카드 제거
- 프론트엔드: 로그인 사용자의 REVIEW 포스트를 `/posts` API에서 조회
- 프론트엔드: 기존 카드 그리드, hover overlay, 레트로 스타일은 유지
- 상태 처리: 로딩 실패 메시지와 리뷰 없음 empty state 추가

## 2. 더미 데이터 제거

기존 Profile 페이지는 하드코딩된 커버 이미지와 `archiveGames` 배열을 직접 렌더링했다. 이 방식은 실제 리뷰 저장 흐름과 연결되지 않아서, 사용자가 작성한 리뷰가 프로필 아카이브에 나타나지 않는다.

```tsx
const coverImages = [
  'https://...',
  'https://...',
  'https://...',
] as const

const archiveGames = [
  {
    cover: coverImages[0],
    date: '24. 10. 12',
    genre: 'Classic RPG Experience',
    platform: 'PC',
    rating: '4.5',
    title: 'SHADOWS OF AETERNA',
  },
]
```

이번 작업에서는 이 더미 배열을 제거하고, 서버 응답 타입을 명시했다.

```tsx
type ProfileArchiveReview = {
  content: string
  createdAt: string
  game: {
    id: string
    imageUrl?: string | null
    platforms?: string[]
    title: string
  }
  id: string
  rating: number | null
}
```

## 3. REVIEW 포스트만 가져오기

프로필 아카이브는 사용자의 리뷰 로그를 보여주는 영역이므로, `/posts` API에 `mine=true`, `type=REVIEW`, `sort=latest` 조건을 붙여 조회한다.

```tsx
const params = new URLSearchParams({
  limit: '10',
  mine: 'true',
  sort: 'latest',
  type: 'REVIEW',
})

// Profile archive mirrors persisted review records, so no dummy cards stay in the render path.
const response = await api.get<ProfileArchiveReview[]>(
  `/posts?${params.toString()}`,
)

setArchiveReviews(response.data)
setArchiveMessage(null)
```

여기서 `mine=true`는 로그인한 사용자 본인의 포스트만 가져오게 한다. `type=REVIEW`는 JOURNAL과 REVIEW 중 리뷰만 보여주기 위한 필터다.

## 4. UI 표시용 변환 함수

DB/API 데이터는 화면에 그대로 쓰기보다 UI에 맞는 표시 형식으로 한 번 변환한다. 날짜, 평점, 리뷰 요약, 이미지가 없는 게임의 이니셜 fallback을 각각 함수로 분리했다.

```tsx
function formatArchiveDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function formatRating(value: number | null) {
  if (typeof value !== 'number') {
    return '-'
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function reviewExcerpt(content: string) {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim())
  return firstLine?.trim().slice(0, 96) || 'NO_REVIEW_TEXT'
}

function gameInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}
```

## 5. 실제 리뷰 카드 렌더링

기존 `archiveGames.map(...)` 대신 API에서 받은 `archiveReviews.map(...)`을 렌더링한다. 카드 구조와 hover overlay는 유지하면서, 카드 안쪽 값만 DB 기반 값으로 교체했다.

```tsx
{archiveReviews.map((post) => {
  const game = post.game
  const platform = game.platforms?.[0] ?? 'DB'

  return (
    <div className="flex flex-col gap-2" key={post.id}>
      <article className="aspect-[3/4] border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] flex flex-col justify-between hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-all duration-200 cursor-pointer group relative overflow-hidden p-0">
        <div className="flex-grow flex flex-col overflow-hidden">
          {game.imageUrl ? (
            <img
              alt={`${game.title} cover`}
              className="w-full object-cover filter grayscale contrast-125 border-b-2 border-[var(--gjc-primary)] h-full"
              src={game.imageUrl}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--gjc-surface-dim)] font-headline-xl text-5xl text-[var(--gjc-primary)]">
              {gameInitials(game.title) || '??'}
            </div>
          )}
        </div>

        <div className="hidden group-hover:flex absolute inset-0 z-20 flex-col items-center justify-center p-4 text-center bg-[var(--gjc-primary)] text-[var(--gjc-on-primary)]">
          <h3 className="font-headline-lg-mobile text-[18px] mb-2">
            {game.title}
          </h3>
          <p className="font-label-caps text-[14px] mb-1">
            RATING: {formatRating(post.rating)}
          </p>
          <p className="font-body-md text-[12px] leading-tight">
            {reviewExcerpt(post.content)}
          </p>
        </div>
      </article>
      <span className="font-label-caps text-[10px] text-[var(--gjc-secondary)] uppercase">
        LOGGED: {formatArchiveDate(post.createdAt)}
      </span>
    </div>
  )
})}
```

## 6. 비어 있거나 실패한 상태

API 실패 시에는 프로필 전체를 깨뜨리지 않고 `ARCHIVE_LOG` 영역에만 메시지를 표시한다. 리뷰가 없으면 카드 그리드 대신 empty state를 보여준다.

```tsx
{archiveMessage ? (
  <p className="font-label-caps text-[10px] uppercase text-[var(--gjc-secondary)]">
    {archiveMessage}
  </p>
) : null}

{archiveReviews.length > 0 ? (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
    {/* review cards */}
  </div>
) : (
  <div className="border-2 border-dashed border-[var(--gjc-primary)] p-8 text-center font-label-caps text-[10px] uppercase text-[var(--gjc-secondary)]">
    NO_REVIEW_LOGS
  </div>
)}
```

## 7. 검증

```bash
npm.cmd run lint
npm.cmd run build
git diff --check
```

`npm.cmd run build`는 TypeScript build info 파일을 `client/node_modules/.tmp`에 쓰기 때문에 일반 샌드박스에서는 EPERM으로 실패했다. 권한 허용 후 다시 실행하여 프로덕션 빌드까지 통과했다.
