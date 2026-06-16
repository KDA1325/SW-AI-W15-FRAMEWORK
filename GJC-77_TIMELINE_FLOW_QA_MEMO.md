# GJC-77 Timeline Flow QA Memo

## Scope

타임라인의 `ALL` / `REVIEWS` / `JOURNALS` 필터, 더보기 pagination, 상세 이동 흐름을 확인했다.

## Verified Flow

- `ALL`은 `type` query 없이 `/posts?sort=latest&limit=10&page=1`을 호출한다.
- `REVIEWS`는 `type=REVIEW`, `JOURNALS`는 `type=JOURNAL`을 붙여 같은 목록 API를 사용한다.
- `LOAD_MORE`는 다음 `page`를 요청하고 기존 카드 id와 중복되지 않는 항목만 append한다.
- 카드 클릭은 게시글 타입에 따라 상세 경로를 나눈다.

```tsx
function getDetailPath(post: JournalPost) {
  return post.type === 'REVIEW' ? `/review-detail/${post.id}` : `/journal-detail/${post.id}`
}
```

## Regression Check

`client` production build 통과로 라우팅 타입과 타임라인 렌더링 코드가 컴파일됨을 확인했다.
