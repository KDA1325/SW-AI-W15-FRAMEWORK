# GJC-99 타임라인 게임 이미지 표시 학습 정리

## 1. API 응답에 이미 포함된 game.imageUrl 활용

타임라인은 `GET /posts` 목록 API를 사용합니다. 서버의 `PostsService.findAll()`은 이미 `post.game` 관계를 함께 조회하고 있었고, 프론트 타입 `JournalPost`에도 `game.imageUrl`이 정의되어 있었습니다.

```ts
export type JournalPost = {
  id: string
  type: PostType
  title: string
  content: string
  game: {
    id: string
    title: string
    imageUrl?: string | null
  }
}
```

그래서 GJC-99에서는 서버 응답 계약을 새로 만들지 않고, 타임라인 렌더링만 실제 이미지 URL을 쓰도록 바꾸면 충분했습니다.

## 2. 이미지가 없을 때 쓸 게임 이니셜 fallback

게임 이미지가 없거나 깨진 경우에도 카드 좌측 영역의 크기가 유지되어야 합니다. 이를 위해 게임 제목에서 앞 단어 두 개의 첫 글자를 뽑아 fallback 텍스트로 사용했습니다.

```tsx
function getGameInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}
```

예를 들어 `Disco Elysium`은 `DE`, `Hades`는 `H`가 됩니다. 제목이 비어 있으면 화면에는 `??`가 표시됩니다.

## 3. 깨진 외부 이미지까지 fallback 처리

`imageUrl`이 있어도 외부 CDN 문제로 이미지 로딩이 실패할 수 있습니다. 타임라인 전체를 에러로 처리하지 않고, 해당 게시글 카드만 fallback으로 바꾸기 위해 실패한 post id를 `Set`으로 관리했습니다.

```tsx
// Image URLs may come from IGDB, Steam, or seeded DB data; track failures per post so one broken cover falls back safely.
const [failedImagePostIds, setFailedImagePostIds] = useState<Set<string>>(
  () => new Set(),
)

const markImageFailed = useCallback((postId: string) => {
  setFailedImagePostIds((current) => new Set(current).add(postId))
}, [])
```

`new Set(current)`를 만든 뒤 id를 추가하는 이유는 React 상태를 직접 수정하지 않고 새 참조를 만들어 렌더링 갱신을 유도하기 위해서입니다.

## 4. 기존 카드 이동 동작은 유지하고 좌측 썸네일만 교체

기존 타임라인 카드는 `Link` 전체가 상세 페이지로 이동하는 구조였습니다. 이 흐름은 그대로 두고, 카드 헤더 왼쪽의 타입 아이콘 박스를 게임 커버 영역으로 바꿨습니다.

```tsx
{posts.map((post) => {
  const hasGameImage = Boolean(post.game.imageUrl && !failedImagePostIds.has(post.id))

  return (
    <Link
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
      </div>
    </Link>
  )
})}
```

`h-20 w-16 flex-shrink-0`로 썸네일 크기를 고정해 이미지 로딩, fallback 전환, hover 상태가 생겨도 카드 레이아웃이 흔들리지 않게 했습니다.

## 5. 검증 결과

```bash
cd client
npm.cmd run lint
npm.cmd run build
cd ..
git diff --check
```

- `client` 린트 통과
- `client` 프로덕션 빌드 통과
- `git diff --check` 통과
- 변경 범위는 `client/src/pages/Timeline.tsx`와 이 학습 노트로 제한
