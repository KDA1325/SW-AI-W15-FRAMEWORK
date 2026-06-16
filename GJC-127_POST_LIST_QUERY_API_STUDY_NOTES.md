# GJC-127 검색/정렬/페이지네이션 쿼리 API 학습 정리

## 1. 작업 범위

- 백엔드: `/posts` 목록 API가 검색, 정렬, 페이지네이션을 한 응답 계약으로 반환
- 백엔드: `type`, `sort`, `limit`, `page` 쿼리 검증 강화
- 백엔드: 검색 범위를 제목/본문/게임명에서 게임 태그/장르/플랫폼까지 확장
- 프론트엔드: `Journals`, `Timeline`, `Profile`의 `/posts` 호출부를 새 응답 계약에 맞춤

## 2. 목록 응답 계약

기존 `/posts`는 배열만 반환했다. 그래서 프론트는 다음 페이지가 있는지 `items.length === limit`처럼 추측해야 했다. 이제 서버가 페이지 메타를 함께 내려준다.

```ts
type PostListResponse = {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    items: PostListItem[];
    limit: number;
    page: number;
    sort: PostListSort;
    total: number;
    totalPages: number;
};
```

프론트도 같은 계약을 타입으로 공유한다.

```tsx
export type PostListResponse<TPost = JournalPost> = {
  hasNextPage: boolean
  hasPreviousPage: boolean
  items: TPost[]
  limit: number
  page: number
  sort: PostSort
  total: number
  totalPages: number
}
```

## 3. 쿼리 검증

URL query string은 런타임에서는 항상 문자열이므로, 컨트롤러는 `type?: string`으로 받고 서비스에서 허용값을 검증한다.

```ts
@Query('type') type?: string,
```

서비스는 QueryBuilder를 만들기 전에 `type`을 먼저 검증한다. 이렇게 해야 `type=ALL` 같은 잘못된 요청이 조용히 빈 목록으로 처리되지 않고 명확한 400 응답이 된다.

```ts
const normalizedType = type ? this.parseListType(type) : null;
```

```ts
private parseListType(type: string) {
    if (POST_LIST_TYPES.has(type)) {
        return type as ArchivePostType;
    }

    throw new BadRequestException(
        'type은 REVIEW 또는 JOURNAL 중 하나여야 합니다.',
    );
}
```

## 4. 검색 조건

검색어는 제목, 본문, 게임명뿐 아니라 게임 태그/장르/플랫폼 배열에서도 찾는다. PostgreSQL 배열 컬럼은 `unnest(...)`로 행처럼 펼친 뒤 `ILIKE`를 적용한다.

```ts
if (keyword) {
    const keywordPattern = `%${keyword}%`;

    postsQuery.andWhere(
        new Brackets((qb) => {
            qb.where('post.title ILIKE :keyword', {
                keyword: keywordPattern,
            });
            qb.orWhere('post.content ILIKE :keyword', {
                keyword: keywordPattern,
            });
            qb.orWhere('game.title ILIKE :keyword', {
                keyword: keywordPattern,
            });
            qb.orWhere(
                'EXISTS (SELECT 1 FROM unnest(game.tags) AS game_tag(term) WHERE game_tag.term ILIKE :keyword)',
                { keyword: keywordPattern },
            );
            qb.orWhere(
                'EXISTS (SELECT 1 FROM unnest(game.genres) AS game_genre(term) WHERE game_genre.term ILIKE :keyword)',
                { keyword: keywordPattern },
            );
            qb.orWhere(
                'EXISTS (SELECT 1 FROM unnest(game.platforms) AS game_platform(term) WHERE game_platform.term ILIKE :keyword)',
                { keyword: keywordPattern },
            );
        }),
    );
}
```

`Brackets`를 쓰는 이유는 여러 `OR` 조건을 하나의 괄호로 묶어 다른 `AND` 조건들과 섞일 때 SQL 의미가 깨지지 않게 하기 위해서다.

## 5. 페이지 메타 계산

TypeORM의 `getManyAndCount()`를 쓰면 현재 페이지의 items와 전체 개수를 함께 얻을 수 있다.

```ts
const [posts, total] = await postsQuery.getManyAndCount();
const totalPages = Math.ceil(total / normalizedLimit);

return {
    hasNextPage: normalizedPage * normalizedLimit < total,
    hasPreviousPage: normalizedPage > 1,
    items: posts.map((post) => ({
        ...post,
        canEdit: post.userId === userId,
    })),
    limit: normalizedLimit,
    page: normalizedPage,
    sort: normalizedSort,
    total,
    totalPages,
};
```

`canEdit`은 목록 UI가 수정/삭제 버튼 노출을 판단할 수 있도록 기존처럼 유지한다.

## 6. 프론트 적용

Journals 페이지는 배열 대신 `items`와 페이지 메타를 저장한다.

```tsx
const [reviewResponse, journalResponse] = await Promise.all([
  api.get<PostListResponse>(`/posts?${reviewParams.toString()}`),
  api.get<PostListResponse>(`/posts?${journalParams.toString()}`),
])
const journalPageData = journalResponse.data

setReviews(reviewResponse.data.items)
setJournals(journalPageData.items)
// The API owns pagination truth, so NEXT/PREV and TOTAL labels do not guess from array length.
setJournalPageInfo({
  hasNextPage: journalPageData.hasNextPage,
  hasPreviousPage: journalPageData.hasPreviousPage,
  total: journalPageData.total,
  totalPages: journalPageData.totalPages,
})
```

NEXT/PREV 버튼도 서버 메타를 그대로 사용한다.

```tsx
<button disabled={!journalPageInfo.hasPreviousPage}>PREV</button>
<button disabled={!journalPageInfo.hasNextPage}>NEXT</button>
```

Timeline과 Profile은 목록 자체만 필요하므로 `response.data.items`를 사용한다.

```tsx
const response = await api.get<PostListResponse>(`/posts?${params.toString()}`)
setPosts(response.data.items)
```

```tsx
const response = await api.get<PostListResponse<ProfileArchiveReview>>(
  `/posts?${params.toString()}`,
)

setArchiveReviews(response.data.items)
setArchiveTotal(response.data.total)
```

## 7. 검증

```bash
npm.cmd test -- posts.service.spec.ts --runInBand
npm.cmd run build
npm.cmd run lint
npm.cmd run build
git diff --check
```

서버 전체 lint 스크립트는 `--fix` 옵션 때문에 이번 이슈 범위 밖 파일까지 포맷하려고 해서 커밋 검증에는 사용하지 않았다. 대신 `posts.service.spec.ts` 단위 테스트와 서버 빌드로 목록 API 계약을 확인했고, 클라이언트는 lint와 production build를 통과했다.
