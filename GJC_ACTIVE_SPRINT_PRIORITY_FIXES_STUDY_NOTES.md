# GJC Active Sprint Priority Fixes Study Notes

## Source Range

기준 범위는 `data/player-preference-igdb..codex/gjc-active-sprint-priority-fixes` 브랜치 diff이다. `GJC-117`은 요청대로 제외했다.

## 1. 목록 API 계약을 테스트로 고정하기

`GJC-182`는 3번 페르소나의 JOURNAL 7건이 기본 목록 조회에서 모두 보이는지 확인하는 문제였다. 서버의 기본 limit은 10이므로 `mine=true&type=JOURNAL` 요청은 첫 페이지에 7건을 모두 담아야 한다.

```ts
await expect(
    service.findAll(
        'persona-multiplayer',
        ArchivePostType.JOURNAL,
        true,
    ),
).resolves.toMatchObject({
    limit: 10,
    page: 1,
    total: 7,
    totalPages: 1,
});
```

핵심은 장애 원인을 UI 추측으로 닫지 않고, 서버 목록 계약을 단위 테스트로 남긴 점이다.

## 2. 추천 후보 검증 파이프라인

`GJC-181`은 이미 기록한 게임, 낮은 신뢰도 타이틀, 같은 시리즈 과다 추천을 막는 작업이다. 추천 전에 사용자의 `ArchivePost`와 `UserGame`을 exclusion set으로 만든다.

```ts
const exclusionSet = await this.loadRecommendationExclusionSet(userId);
const state: AgentState = {
  exclusionSet,
  maxIterations: this.maxIterations(),
  recommendations: [],
  startedAt: Date.now(),
  toolResults: [],
  userId,
};
```

후보 검증은 제목, 별칭, slug가 검색어와 맞거나 태그 검색어가 후보 메타데이터에 실제로 설명될 때만 통과한다.

```ts
return (
  normalizedTitle.includes(normalizedQuery) ||
  normalizedQuery.includes(normalizedTitle) ||
  normalizedAliases.some((alias) => alias.includes(normalizedQuery)) ||
  this.querySupportedByCandidate(query, game)
);
```

이 구조 덕분에 `Opus Magnum`을 이미 기록했다면 제외되고, `Magnum Opus`처럼 낮은 신뢰도 후보는 추천에서 빠진다.

## 3. 리뷰/저널 페이지 탐색

`GJC-176`은 프로필 최신 리뷰와 저널 REVIEW_LOGS가 다르게 보이는 문제를 해결했다. 원인은 데이터 누락이 아니라 REVIEW_LOGS가 기본 10개만 보여주고 다음 페이지 탐색이 없던 UX 문제였다.

```tsx
const reviewParams = new URLSearchParams({
  limit: String(DEFAULT_REVIEW_LIMIT),
  page: String(reviewPage),
  type: 'REVIEW',
  mine: 'true',
  sort: reviewSort,
});
```

`GJC-174`는 JOURNAL_LOGS를 게시판형 번호 pagination으로 확장했다.

```tsx
function paginationWindow(currentPage: number, totalPages: number) {
  const lastPage = Math.max(1, totalPages);
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(lastPage, currentPage + 2);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
```

## 4. AI 분석 품질 보강

`GJC-180`은 퍼즐 성향이 `PUZZLE` 하나로 뭉개지지 않도록 fallback taxonomy를 세분화했다.

```ts
{
  category: 'mechanic',
  label: 'SPATIAL_REASONING',
  terms: ['spatial', 'space', 'position', 'perspective', 'portal'],
},
{
  category: 'mechanic',
  label: 'OPTIMIZATION',
  terms: ['optimization', 'efficient', 'factory', 'machine', 'automation'],
},
```

`GJC-178`은 추천 개수를 6개로 늘리고 한국어 설명을 생성하게 했다.

```ts
const MIN_RECOMMENDATION_COUNT = 6;

return `${title}은(는) 검색 신호 "${query}"와 사용자의 RAG 태그(${tags})가 함께 맞아 추천됩니다. 선호 태그와 기록된 플레이/리뷰 맥락을 같이 반영했습니다.`;
```

`GJC-179`는 워드클라우드를 absolute 좌표가 아니라 flow layout으로 바꿔 키워드가 늘어나도 겹치지 않게 했다.

```tsx
<div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-4 text-center">
  {visibleWords.map((word) => (
    <span className="font-headline-lg font-bold uppercase leading-none">
      {normalizeLabel(word.label)}
    </span>
  ))}
</div>
```

## 5. 페르소나 데이터셋 규칙

`GJC-173`은 리뷰 평점이 0.5 단위만 쓰도록 생성 규칙을 바꿨다.

```js
const preferenceScale = {
  LIKE: {
    label: 'positive_preference',
    scores: [0.78, 0.84, 0.9, 0.95],
    reviewRatings: [4.0, 4.5, 5.0, 4.5],
  },
};
```

재생성 후 REVIEW 105건의 0.5 단위 위반은 0건이었다. 멀티플레이와 공포 페르소나는 일부 LIKE를 MIXED로 돌려 긍정 쏠림을 줄였다.

## 6. 타임라인 더보기

`GJC-140`은 타임라인 더보기에서 중복 append를 막는 것이 핵심이다.

```tsx
setPosts((currentPosts) => {
  if (page === 1) {
    return response.data.items;
  }

  const seen = new Set(currentPosts.map((post) => post.id));
  const nextPosts = response.data.items.filter((post) => !seen.has(post.id));

  return [...currentPosts, ...nextPosts];
});
```

`GJC-77`은 이 흐름 위에서 필터, 더보기, 상세 이동이 연결되어 있음을 검증했다.

```tsx
function getDetailPath(post: JournalPost) {
  return post.type === 'REVIEW'
    ? `/review-detail/${post.id}`
    : `/journal-detail/${post.id}`;
}
```

## Verification

- `server`: `npm.cmd test -- --runInBand agent.service.spec.ts posts.service.spec.ts`
- `client`: `npm.cmd run build`
- `dataset`: REVIEW 105건 중 0.5 단위 위반 0건
