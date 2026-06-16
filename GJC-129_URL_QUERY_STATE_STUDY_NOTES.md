# GJC-129 URL 상태 및 검색 결과 검증 학습 정리

## 1. URL을 목록 상태의 공유 가능한 저장소로 사용하기

GJC-129의 핵심은 저널 페이지의 검색어, 정렬, 페이지 크기, 현재 페이지를 URL 쿼리와 연결하는 것입니다. 이렇게 하면 새로고침하거나 URL을 공유해도 같은 목록 조건이 재현됩니다.

```tsx
const [searchParams, setSearchParams] = useSearchParams()
const initialSearchQuery = searchParams.get('q')?.trim() ?? ''

const [searchInput, setSearchInput] = useState(initialSearchQuery)
const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
const [reviewSort, setReviewSort] = useState<PostSort>(() =>
  parsePostSort(searchParams.get('reviewSort'), DEFAULT_REVIEW_SORT),
)
const [journalSort, setJournalSort] = useState<PostSort>(() =>
  parseJournalSort(searchParams.get('journalSort')),
)
const [journalLimit, setJournalLimit] = useState<JournalLimit>(() => parseJournalLimit(searchParams.get('limit')))
const [journalPage, setJournalPage] = useState(() => parseJournalPage(searchParams.get('page')))
```

포인트는 `useState`의 초기값을 URL에서 읽는다는 점입니다. 사용자가 `/journals?q=zelda&page=2` 같은 주소로 들어오면 화면 상태가 바로 그 조건에서 시작합니다.

## 2. URL 값은 항상 검증해서 상태로 바꾸기

URL은 사용자가 직접 수정할 수 있기 때문에 믿을 수 없는 입력입니다. 그래서 문자열 값을 그대로 상태에 넣지 않고, 허용된 값만 통과시키는 파서를 두었습니다.

```tsx
const DEFAULT_REVIEW_SORT: PostSort = 'rating'
const DEFAULT_JOURNAL_SORT: PostSort = 'latest'
const DEFAULT_JOURNAL_LIMIT: JournalLimit = 5

function parsePostSort(value: string | null, fallback: PostSort): PostSort {
  return value === 'latest' || value === 'oldest' || value === 'rating' ? value : fallback
}

function parseJournalSort(value: string | null): PostSort {
  return value === 'latest' || value === 'oldest' ? value : DEFAULT_JOURNAL_SORT
}

function parseJournalLimit(value: string | null): JournalLimit {
  const parsed = Number(value)

  return parsed === 5 || parsed === 10 || parsed === 15 ? parsed : DEFAULT_JOURNAL_LIMIT
}

function parseJournalPage(value: string | null) {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
}
```

리뷰 정렬은 `rating`을 허용하지만, 저널 정렬 UI는 `latest`, `oldest`만 제공합니다. 그래서 `parsePostSort`와 `parseJournalSort`를 분리했습니다.

## 3. 화면 상태를 URL로 다시 반영하기

검색어와 필터가 바뀌면 URL도 같이 바뀌어야 합니다. 기본값은 URL에 남기지 않아 주소를 짧게 유지하고, 기본값이 아닌 조건만 쿼리로 기록합니다.

```tsx
useEffect(() => {
  const nextParams = new URLSearchParams()

  if (searchQuery) {
    nextParams.set('q', searchQuery)
  }

  if (reviewSort !== DEFAULT_REVIEW_SORT) {
    nextParams.set('reviewSort', reviewSort)
  }

  if (journalSort !== DEFAULT_JOURNAL_SORT) {
    nextParams.set('journalSort', journalSort)
  }

  if (journalLimit !== DEFAULT_JOURNAL_LIMIT) {
    nextParams.set('limit', String(journalLimit))
  }

  if (journalPage !== 1) {
    nextParams.set('page', String(journalPage))
  }

  if (nextParams.toString() !== searchParams.toString()) {
    // Query-backed controls are reflected in the URL so refresh/share preserves the same list.
    setSearchParams(nextParams, { replace: true })
  }
}, [journalLimit, journalPage, journalSort, reviewSort, searchParams, searchQuery, setSearchParams])
```

`replace: true`를 사용한 이유는 검색 디바운스나 페이지 보정 중에 브라우저 히스토리가 너무 잘게 쌓이지 않게 하기 위해서입니다.

## 4. URL 변경을 다시 화면 상태로 동기화하기

뒤로가기나 주소창 직접 수정처럼 URL이 외부에서 바뀌는 경우도 고려했습니다. React 린트 규칙은 effect 본문에서 즉시 `setState`를 호출하는 패턴을 경고하므로, 렌더 직후 타이머에서 상태를 맞춥니다.

```tsx
useEffect(() => {
  const timeoutId = window.setTimeout(() => {
    const nextSearchQuery = searchParams.get('q')?.trim() ?? ''

    setSearchInput(nextSearchQuery)
    setSearchQuery(nextSearchQuery)
    setReviewSort(parsePostSort(searchParams.get('reviewSort'), DEFAULT_REVIEW_SORT))
    setJournalSort(parseJournalSort(searchParams.get('journalSort')))
    setJournalLimit(parseJournalLimit(searchParams.get('limit')))
    setJournalPage(parseJournalPage(searchParams.get('page')))
  }, 0)

  return () => window.clearTimeout(timeoutId)
}, [searchParams])
```

이 흐름 덕분에 브라우저 이동으로 URL이 바뀌어도 검색창과 목록 조건이 다시 같은 상태로 정렬됩니다.

## 5. 범위를 벗어난 페이지 접근 처리

공유된 URL이 `/journals?page=999`처럼 실제 마지막 페이지보다 큰 값을 가리킬 수 있습니다. 서버 응답의 `totalPages`를 기준으로 현재 페이지를 마지막 페이지로 보정합니다.

```tsx
setJournals(journalPageData.items)
setJournalPageInfo({
  hasNextPage: journalPageData.hasNextPage,
  hasPreviousPage: journalPageData.hasPreviousPage,
  total: journalPageData.total,
  totalPages: journalPageData.totalPages,
})

if (journalPageData.totalPages > 0 && journalPage > journalPageData.totalPages) {
  // A shared URL can point past the last page after filters/data change; clamp before rendering a broken page.
  setJournalPage(journalPageData.totalPages)
}
```

여기서 `totalPages > 0` 조건이 중요합니다. 검색 결과가 완전히 비어 있는 경우에는 마지막 페이지가 없으므로 강제로 1페이지 보정을 반복하지 않습니다.

## 6. 빈 검색 결과 UI

검색 결과가 없을 때 아무 UI도 없는 것처럼 보이지 않도록 리뷰와 저널 영역에 각각 빈 상태 문구를 넣었습니다.

```tsx
{reviews.length === 0 ? (
  <p className="w-full border-2 border-dashed border-primary bg-surface-container-lowest p-6 text-center font-label-caps text-xs uppercase tracking-widest text-secondary">
    NO_REVIEW_RESULTS
  </p>
) : null}

{journals.length === 0 ? (
  <p className="border-2 border-dashed border-primary bg-surface-container-lowest p-6 text-center font-label-caps text-xs uppercase tracking-widest text-secondary">
    NO_JOURNAL_RESULTS
  </p>
) : null}
```

기존 디자인 시스템의 `border-2`, `font-label-caps`, `uppercase`, `text-secondary` 조합을 그대로 사용해서 새 UI가 저널 페이지 분위기와 섞이도록 맞췄습니다.

## 7. 검증 결과

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
- `http://127.0.0.1:5173/journals` dev 서버 응답 200 확인
- 인앱 브라우저 자동화는 현재 Windows 실행 권한 문제로 연결 실패하여 DOM 시각 검증은 제외
