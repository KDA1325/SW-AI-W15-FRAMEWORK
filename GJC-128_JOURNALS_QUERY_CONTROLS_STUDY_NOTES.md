# GJC-128 검색/정렬/보기 개수 UI 상태 연결 학습 정리

## 1. 작업 범위

- 프론트엔드: Journals 검색 입력 debounce 구현
- 프론트엔드: 검색/정렬/보기 개수/page 초기화 버튼 추가
- 기존 구현 확인: 검색어, 정렬, 보기 개수, page가 `/posts` query string에 연결되어 있음

## 2. 기존 API query 연결

Journals 페이지는 리뷰 목록과 저널 목록을 분리해서 요청한다. 각 UI control state는 query string으로 변환된다.

```tsx
const reviewParams = new URLSearchParams({
  type: 'REVIEW',
  mine: 'true',
  sort: reviewSort,
})

const journalParams = new URLSearchParams({
  type: 'JOURNAL',
  mine: 'true',
  sort: journalSort,
  limit: String(journalLimit),
  page: String(journalPage),
})

if (searchQuery) {
  reviewParams.set('q', searchQuery)
  journalParams.set('q', searchQuery)
}
```

`fetchPosts`가 `journalLimit`, `journalPage`, `journalSort`, `reviewSort`, `searchQuery`를 의존하므로 해당 값이 바뀌면 목록을 다시 조회한다.

```tsx
const fetchPosts = useCallback(async () => {
  // ...
}, [journalLimit, journalPage, journalSort, reviewSort, searchQuery])
```

## 3. 검색 입력 debounce

기존에는 SEARCH submit 시점에만 `searchQuery`가 확정되었다. 이제 입력이 멈춘 뒤 350ms 후 검색어를 query state에 반영한다.

```tsx
useEffect(() => {
  const timeoutId = window.setTimeout(() => {
    // Search input is debounced before it becomes an API query, so typing does not fire one request per key.
    setJournalPage(1)
    setSearchQuery(searchInput.trim())
  }, 350)

  return () => window.clearTimeout(timeoutId)
}, [searchInput])
```

검색어가 바뀌면 항상 첫 페이지부터 다시 보도록 `setJournalPage(1)`도 함께 호출한다.

## 4. 즉시 검색 제출 유지

debounce와 별개로 ENTER나 SEARCH 버튼은 즉시 검색을 실행한다.

```tsx
const handleSearch = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  // A new search should always start from the first journal page.
  setJournalPage(1)
  setSearchQuery(searchInput.trim())
}
```

이렇게 하면 느긋하게 타이핑할 때는 debounce가 동작하고, 사용자가 명확히 SEARCH를 누르면 기다리지 않는다.

## 5. 조건 초기화

RESET 버튼은 검색어, 정렬, 보기 개수, 페이지를 모두 초기값으로 돌린다. 이 값들이 `fetchPosts` 의존성에 포함되어 있으므로 다음 렌더에서 초기 목록을 다시 조회한다.

```tsx
const resetFilters = () => {
  // Reset every query-backed control to its default so the next fetch reproduces the initial list state.
  setSearchInput('')
  setSearchQuery('')
  setReviewSort('rating')
  setJournalSort('latest')
  setJournalLimit(5)
  setJournalPage(1)
}
```

```tsx
<button
  className="flex items-center justify-center gap-2 border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] px-6 py-2 font-ui-button text-xs uppercase tracking-widest text-primary transition-colors hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)]"
  onClick={resetFilters}
  type="button"
>
  RESET
  <span className="material-symbols-outlined text-sm">restart_alt</span>
</button>
```

## 6. 검증

```bash
npm.cmd run lint
npm.cmd run build
git diff --check
```

검색 입력 debounce, SEARCH 즉시 제출, RESET 초기화가 모두 같은 query-backed state를 통해 동작하도록 정리했다.
