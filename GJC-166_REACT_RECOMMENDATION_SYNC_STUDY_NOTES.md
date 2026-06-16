# GJC-166 React Recommendation Sync Study Notes

## 작업 요약

GJC-166은 추천 화면의 더미 데이터를 제거하고, 실제 Agent SYNC API 응답으로 취향 태그, 워드 클라우드, 추천 게임 카드를 렌더링한 작업이다.

- `client/src/pages/Recommend.tsx`의 정적 `recommendationCards`, `wordCloud`, `tasteTags` 배열을 제거했다.
- `POST /ai/recommendations/sync`를 호출하는 `syncRecommendations` 함수를 추가했다.
- 로딩, 오류, 빈 데이터, 성공 상태를 화면에서 처리했다.
- 추천 카드에 게임명, 플랫폼/장르, 추천 이유, 매칭 태그, 외부 출처 링크를 표시했다.
- 카드 reason이 길어도 레이아웃이 밀리지 않도록 CSS line clamp를 추가했다.

## 핵심 코드 1: API 응답 타입

프론트는 백엔드 계약 전체가 필요하지 않고, 추천 화면에서 실제로 쓰는 필드만 타입으로 선언했다.

```ts
type AiRecommendationSyncResponse = {
  generatedAt: string
  lastSyncAt: string
  pipeline: {
    agent: {
      iterations: number
      maxIterations: number
      stoppedReason: 'completed' | 'fallback' | 'max_iterations' | 'timeout'
    }
    mcp: {
      resultCount: number
      toolName: 'search_games'
    }
    rag: {
      sourceCount: number
      topK: number
    }
  }
  playStyleSummary: string
  preferenceTags: AiPreferenceTag[]
  recommendations: AiRecommendationCard[]
  requestId: string
  userId: string
  wordCloud: AiWordCloudTerm[]
}
```

이렇게 하면 JSX에서 `syncData.recommendations`, `syncData.wordCloud`를 사용할 때 TypeScript가 필드 누락이나 오타를 잡아준다.

## 핵심 코드 2: SYNC 요청 상태

```ts
const [isAnalyzingOpen, setIsAnalyzingOpen] = useState(false)
const [isSyncing, setIsSyncing] = useState(false)
const [syncData, setSyncData] =
  useState<AiRecommendationSyncResponse | null>(null)
const [syncError, setSyncError] = useState<string | null>(null)
const scrollRef = useRef<HTMLDivElement | null>(null)
const syncRequestIdRef = useRef(0)
```

- `isSyncing`: 버튼 disabled와 sync 아이콘 회전에 사용한다.
- `syncData`: 성공 응답을 저장해서 화면 전체를 다시 렌더링한다.
- `syncError`: 실패 메시지를 별도 영역에 표시한다.
- `syncRequestIdRef`: 빠르게 여러 번 눌렀을 때 오래된 응답이 최신 화면을 덮어쓰지 않게 막는다.

## 핵심 코드 3: Agent API 호출

구현 중 남긴 주석:

```ts
// 여러 번 빠르게 SYNC를 눌러도 가장 마지막 응답만 화면 상태를 바꾸게 합니다.
if (requestOrder === syncRequestIdRef.current) {
  setSyncData(response.data)
}
```

전체 요청 흐름은 아래와 같다.

```ts
const syncRecommendations = async () => {
  const requestOrder = syncRequestIdRef.current + 1
  syncRequestIdRef.current = requestOrder
  setIsSyncing(true)
  setIsAnalyzingOpen(true)
  setSyncError(null)

  try {
    const response = await api.post<AiRecommendationSyncResponse>(
      '/ai/recommendations/sync',
      {
        forceRefresh: true,
        requestId: `gjc-web-sync-${Date.now()}`,
        topK: 6,
      },
    )

    if (requestOrder === syncRequestIdRef.current) {
      setSyncData(response.data)
    }
  } catch (error) {
    if (requestOrder === syncRequestIdRef.current) {
      setSyncError(getApiErrorMessage(error, 'AI SYNC FAILED'))
    }
  } finally {
    if (requestOrder === syncRequestIdRef.current) {
      setIsSyncing(false)
      setIsAnalyzingOpen(false)
    }
  }
}
```

`api` 인스턴스는 `withCredentials: true`로 설정되어 있으므로 로그인 쿠키 `access_token`이 자동으로 포함된다. 프론트는 `userId`를 보내지 않고, NestJS가 JWT에서 사용자 id를 읽는다.

## 핵심 코드 4: 워드 클라우드와 태그 렌더링

워드 클라우드와 태그는 API 데이터가 없을 때 빈 상태를 보여주고, 데이터가 있으면 고정 위치 배열에 매핑한다.

```tsx
{visibleWords.length > 0 ? (
  visibleWords.map((word, index) => (
    <span
      className="absolute font-headline-lg font-bold uppercase leading-none"
      key={`${word.label}-${word.category}`}
      style={wordStyle(word, index)}
    >
      {normalizeLabel(word.label)}
    </span>
  ))
) : (
  <span className="font-label-caps text-xs text-[var(--gjc-secondary)] uppercase">
    NO_STYLE_DATA
  </span>
)}
```

`wordStyle`은 weight를 글자 크기로 바꾸고 mood 계열만 보조색으로 표시한다.

```ts
function wordStyle(word: AiWordCloudTerm, index: number) {
  const position = wordPositions[index % wordPositions.length]
  const fontSize = `${1.15 + Math.min(word.weight, 1) * 2.5}rem`
  const color =
    word.category === 'mood'
      ? 'var(--gjc-secondary)'
      : 'var(--gjc-primary)'

  return {
    ...position,
    color,
    fontSize,
  }
}
```

## 핵심 코드 5: 추천 카드

추천 카드는 API의 `recommendations` 배열을 그대로 사용한다.

```tsx
{syncData.recommendations.map((card) => (
  <article
    className="w-[300px] h-[460px] bg-[var(--gjc-surface-container-lowest)] flex-shrink-0 flex flex-col border-2 border-[var(--gjc-primary)] transition-all group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px]"
    key={`${card.externalId.provider}-${card.externalId.id}-${card.rank}`}
  >
    <h3 className="font-headline-lg text-2xl text-[var(--gjc-primary)] uppercase leading-tight">
      {card.title}
    </h3>
    <p className="recommend-card-reason font-body-md text-xs leading-relaxed text-[var(--gjc-secondary)]">
      {card.reason}
    </p>
  </article>
))}
```

외부 출처가 있으면 새 탭으로 열 수 있는 링크를 보여준다.

```tsx
{card.sourceUrl ? (
  <a
    className="font-label-caps text-[10px] text-[var(--gjc-primary)] uppercase underline"
    href={card.sourceUrl}
    rel="noreferrer"
    target="_blank"
  >
    OPEN_SOURCE
  </a>
) : null}
```

## 핵심 코드 6: 긴 추천 이유 보호

추천 이유는 Agent가 생성하거나 fallback으로 합성하므로 길이가 일정하지 않다. 카드 높이를 안정적으로 유지하기 위해 CSS에서 4줄까지만 보여준다.

```css
.recommend-card-reason {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
}
```

## 검증 결과

실행한 검증:

```bash
npm.cmd run build
npm.cmd run lint
Invoke-RestMethod POST http://127.0.0.1:3000/auth/login
Invoke-RestMethod POST http://127.0.0.1:3000/ai/recommendations/sync
git diff --check
```

HTTP 검증 요약:

```json
{
  "recommendations": 3,
  "first": "CrossCode",
  "preferenceTags": 6,
  "wordCloud": 6,
  "stoppedReason": "fallback",
  "sourceCount": 3
}
```

브라우저 검증은 in-app browser 런타임이 Windows sandbox 권한 오류로 시작되지 않아 수행하지 못했다. 대신 Vite production build, ESLint, 로그인 쿠키 기반 Agent API 호출로 기능 연결을 검증했다.
