# GJC-70 Journals API Integration QA Memo

## Scope

저널/리뷰 목록 화면의 목업 데이터 제거와 실제 목록 API 연동 상태를 확인했다.

## Verification

- `client/src/pages/Journals.tsx`는 정적 리뷰/저널 배열을 갖지 않는다.
- REVIEW_LOGS는 `type=REVIEW&mine=true` 쿼리로 `/posts`를 호출한다.
- JOURNAL_LOGS는 `type=JOURNAL&mine=true` 쿼리로 `/posts`를 호출한다.
- 결과가 없을 때 `NO_REVIEW_RESULTS`, `NO_JOURNAL_RESULTS` 빈 상태가 표시된다.
- `client` production build가 통과했다.

## Code Path

```tsx
const [reviewResponse, journalResponse] = await Promise.all([
  api.get<PostListResponse>(`/posts?${reviewParams.toString()}`),
  api.get<PostListResponse>(`/posts?${journalParams.toString()}`),
])

setReviews(reviewPageData.items)
setJournals(journalPageData.items)
```

## Boundary

`GJC-117`은 요청에서 제외되었으므로, 별도 로딩/오류 상태 개선은 이번 검증 범위에 포함하지 않았다.
