# GJC-163 AI Recommendation Contract 구현 학습 정리

## 1. 작업 범위

이번 노트는 `GJC-163 [P0-01][MVP] AI 추천 세로 플로우/API 계약 확정` 작업에서 변경한 아래 파일을 기준으로 정리한다.

- `server/README.md`
- `server/src/ai/recommendation-contract.ts`

핵심 목표는 React의 `SYNC_DATA` 버튼부터 NestJS BFF, FastAPI Agent, RAG, MCP, LLM 응답까지 이어지는 최소 MVP 계약을 먼저 고정하는 것이다.

## 2. userId는 프론트가 아니라 서버가 결정한다

새 타입 파일의 첫 번째 주석은 인증 경계에 대한 설명이다.

```ts
export type AiRecommendationSyncRequest = {
  // React does not send userId. NestJS should derive it from the JWT cookie and pass it to FastAPI.
  forceRefresh?: boolean;
  topK?: number;
};
```

프론트가 `userId`를 직접 보내면 다른 사용자의 추천 데이터를 요청하는 식의 위조가 쉬워진다. 이미 `PostsController`가 JWT 쿠키에서 로그인 사용자를 읽는 구조이므로, 추천 API도 같은 규칙을 따른다.

React가 보내는 공개 요청은 작게 유지한다.

```json
{
  "forceRefresh": false,
  "topK": 6
}
```

## 3. NestJS BFF와 FastAPI Agent의 계약은 분리한다

두 번째 주석은 공개 API와 내부 API가 왜 다른지 설명한다.

```ts
export type AiRecommendationAgentRequest = AiRecommendationSyncRequest & {
  // This internal request is sent from NestJS BFF to FastAPI so the agent can load DB/RAG state.
  userId: string;
  requestId: string;
};
```

NestJS는 브라우저 요청을 받는 BFF 역할을 하고, FastAPI는 AI Agent 실행을 담당한다. 그래서 브라우저는 `userId`를 모르지만, 내부 Agent는 DB와 RAG 데이터를 조회하기 위해 `userId`가 필요하다.

내부 요청은 이렇게 확장된다.

```json
{
  "userId": "00000000-0000-4000-8000-000000000001",
  "requestId": "gjc-demo-sync-001",
  "forceRefresh": false,
  "topK": 6
}
```

## 4. 화면 섹션과 응답 필드를 1:1로 맞춘다

추천 화면은 현재 더미 배열인 `recommendationCards`, `wordCloud`, `tasteTags`를 렌더링한다. 계약은 이 세 덩어리를 실제 API 응답 필드로 바꾸기 쉽게 설계했다.

```ts
export type AiRecommendationSyncResponse = {
  requestId: string;
  userId: string;
  generatedAt: string;
  lastSyncAt: string;
  preferenceTags: AiPreferenceTag[];
  playStyleSummary: string;
  wordCloud: AiWordCloudTerm[];
  recommendations: AiRecommendationCard[];
  contextSources: AiRagContextSource[];
  pipeline: AiPipelineTrace;
};
```

매핑 기준은 다음과 같다.

| 응답 필드 | 화면 섹션 | 의미 |
| --- | --- | --- |
| `preferenceTags` | `GAMES YOU ENJOY` | 사용자가 좋아하는 게임 관련 태그 |
| `wordCloud` | `YOUR PLAY STYLE` | 일지/리뷰 기반 플레이 스타일 단어 |
| `recommendations` | `RECOMMENDED GAMES` | 외부 게임 API와 Agent가 만든 추천 카드 |
| `contextSources` | 디버그/근거 | pgvector top-k 검색 근거 |
| `pipeline` | 데모 검증 | RAG, MCP, Agent 실행 흔적 |

## 5. pipeline은 데모에서 AI 필수 요소를 증명한다

세 번째 주석은 `pipeline` 필드의 존재 이유를 설명한다.

```ts
export type AiPipelineTrace = {
  // The trace lets the demo prove that RAG, MCP, and the agent loop all ran during one SYNC.
  rag: {
    topK: number;
    sourceCount: number;
  };
  mcp: {
    toolName: 'search_games';
    provider: AiExternalProvider;
    resultCount: number;
  };
  agent: {
    maxIterations: number;
    iterations: number;
    stoppedReason: AiAgentStoppedReason;
  };
};
```

과제 요구사항은 RAG, MCP, AI Agent가 모두 들어가야 한다. `pipeline`은 사용자가 보는 추천 카드뿐 아니라, 내부적으로 어떤 AI 구성요소가 실행되었는지 확인할 수 있는 증거 필드다.

```json
{
  "pipeline": {
    "rag": { "topK": 6, "sourceCount": 6 },
    "mcp": {
      "toolName": "search_games",
      "provider": "steam",
      "resultCount": 10
    },
    "agent": {
      "maxIterations": 4,
      "iterations": 3,
      "stoppedReason": "completed"
    }
  }
}
```

## 6. satisfies로 샘플 JSON의 타입을 검증한다

샘플 응답은 문서용 예시이면서 TypeScript가 실제 계약과 맞는지 확인하는 테스트 역할도 한다.

```ts
export const AI_RECOMMENDATION_SYNC_SAMPLE = {
  requestId: 'gjc-demo-sync-001',
  userId: AI_RECOMMENDATION_DEMO_USER_ID,
  generatedAt: '2026-06-16T12:00:00.000+09:00',
  lastSyncAt: '2026-06-16T12:00:00.000+09:00',
  preferenceTags: [
    { label: 'TACTICAL_RPG', weight: 0.95, sourceCount: 4 },
    { label: 'STORY_DRIVEN', weight: 0.91, sourceCount: 5 },
  ],
  recommendations: [
    {
      rank: 1,
      gameId: null,
      externalId: { provider: 'steam', id: '368340' },
      title: 'CrossCode',
      matchScore: 0.93,
      matchedTags: ['RETRO_PIXEL', 'STORY_DRIVEN', 'TACTICAL_RPG'],
      reason:
        'Your journals emphasize precise combat and puzzle-like encounters, which match the action RPG structure and pixel presentation of CrossCode.',
      sourceUrl: 'https://store.steampowered.com/app/368340',
      imageUrl:
        'https://cdn.akamai.steamstatic.com/steam/apps/368340/header.jpg',
      genres: ['Action RPG', 'Puzzle'],
      platforms: ['PC', 'Steam'],
      tags: ['Pixel Graphics', 'Story Rich', 'Action RPG'],
    },
  ],
} as const satisfies AiRecommendationSyncResponse;
```

`satisfies AiRecommendationSyncResponse`를 붙이면 예시 JSON에 필드가 빠졌거나 타입이 틀렸을 때 빌드에서 바로 잡힌다. 실제로 이번 검증 중 작은따옴표가 포함된 문자열 오류가 빌드에서 발견되어 수정했다.

## 7. 전체 흐름

```text
React /recommend SYNC button
  -> POST /ai/recommendations/sync
  -> NestJS BFF validates JWT cookie and resolves userId
  -> FastAPI Agent receives { userId, requestId, forceRefresh, topK }
  -> RAG reads ArchivePost, Game, AiProfile, and EmbeddingDocument through Postgres pgvector
  -> MCP JSON-RPC server exposes tools/list and tools/call
  -> Agent calls search_games through MCP and asks the LLM for the final JSON
  -> NestJS returns one AiRecommendationSyncResponse to React
```

이 흐름 덕분에 다음 이슈들은 같은 응답 모양을 기준으로 독립적으로 구현할 수 있다.

- `GJC-164`: seed user와 pgvector 데이터 준비
- `GJC-80`: `preferenceTags`, `wordCloud`, `contextSources` 생성
- `GJC-83`: `search_games` MCP tool로 추천 카드 메타데이터 확보
- `GJC-88`: RAG와 MCP를 조합하는 Agent loop 구현
- `GJC-166`: 더미 배열 제거 후 API 응답 렌더링
