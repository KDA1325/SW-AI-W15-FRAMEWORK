# GJC-88 Agent Recommendation Loop Study Notes

## 작업 요약

GJC-88은 RAG 컨텍스트와 MCP `search_games` 도구를 조합해서 개인화 추천 SYNC 응답을 만드는 Agent 루프를 구현한 작업이다.

- `POST /ai/recommendations/sync` 인증 API를 추가했다.
- `AgentService`가 RAG 결과를 읽고 MCP JSON-RPC tool call을 반복 실행한다.
- `AGENT_MAX_ITERATIONS`, `AGENT_TIMEOUT_MS`로 무한 루프를 막는다.
- IGDB 자격증명이 없어 MCP가 빈 결과를 반환해도 로컬 DB fallback 추천 3개를 반환한다.
- `AiRecommendationSyncResponse` 계약에 맞게 추천, RAG 근거, pipeline trace를 한 번에 반환한다.

## 핵심 코드 1: Agent 상태

Agent는 한 번의 SYNC 실행 중 현재 추천 목록, 호출한 도구 결과, 반복 제한, 시작 시간을 상태로 들고 간다.

```ts
type AgentState = {
  maxIterations: number;
  recommendations: AiRecommendationCard[];
  startedAt: number;
  toolResults: AgentToolResult[];
  userId: string;
};
```

이 구조 덕분에 루프가 계속 돌 때마다 다음 항목을 판단할 수 있다.

- 이미 추천이 3개 이상이면 중단한다.
- MCP 호출 수가 `maxIterations`에 도달하면 중단한다.
- 시작 시간 기준 `AGENT_TIMEOUT_MS`를 넘으면 중단한다.

## 핵심 코드 2: RAG를 먼저 읽고 루프 시작

```ts
const ragContext = await this.ragService.analyzeForUser(userId, {
  refreshEmbeddings: options.forceRefresh !== false,
  topK: options.topK,
});

const state: AgentState = {
  maxIterations: this.maxIterations(),
  recommendations: [],
  startedAt: Date.now(),
  toolResults: [],
  userId,
};
```

이 코드가 중요한 이유는 추천 Agent가 사용자의 실제 일지, 리뷰, 프로필에서 나온 RAG 결과를 먼저 확보하기 때문이다. 이후 MCP 검색어도 RAG의 `preferenceTags`와 `contextSources`에서 만든다.

## 핵심 코드 3: MCP 도구 호출 루프

구현 중 남긴 주석:

```ts
// The loop treats each query as a function-calling decision: inspect state, call search_games, merge results.
return [...new Set([...sourceQueries, ...tagQueries, 'story rich RPG'])];
```

전체 루프 흐름은 아래와 같다.

```ts
for (const query of this.buildSearchQueries(ragContext)) {
  if (this.shouldStop(state)) {
    break;
  }

  const toolResult = await this.callSearchGamesTool(query, ragContext);
  state.toolResults.push(toolResult);
  state.recommendations.push(
    ...this.toRecommendations(toolResult, ragContext, state),
  );
  state.recommendations = this.uniqueRecommendations(state.recommendations);

  if (state.recommendations.length >= MIN_RECOMMENDATION_COUNT) {
    break;
  }
}
```

여기서 `callSearchGamesTool`은 MCP endpoint를 HTTP로 다시 부르지 않고 같은 NestJS 프로세스의 `McpService.handle`을 직접 호출한다. 그래도 요청 모양은 JSON-RPC와 동일하게 유지했다.

```ts
const response = await this.mcpService.handle({
  id: query,
  jsonrpc: '2.0',
  method: 'tools/call',
  params: {
    arguments: {
      limit: 5,
      preferenceTags: ragContext.preferenceTags.map((tag) => tag.label),
      query,
    },
    name: 'search_games',
  },
});
```

## 핵심 코드 4: JSON-RPC 성공 응답 타입 가드

`McpService.handle`은 성공 응답과 오류 응답을 모두 반환할 수 있다. 그래서 `result`를 읽기 전에 타입 가드로 좁혔다.

```ts
private isMcpToolCallSuccess(response: unknown): response is McpToolCallSuccess {
  return (
    response !== null && typeof response === 'object' && 'result' in response
  );
}
```

이 체크가 없으면 TypeScript는 오류 응답에도 `result`가 있다고 착각할 수 없으므로 빌드가 실패한다.

## 핵심 코드 5: fallback 추천

IGDB 키가 없거나 외부 API가 실패하면 MCP `search_games`는 빈 결과와 errorCode를 반환한다. 이때 SYNC 전체를 실패시키지 않고 로컬 DB의 게임 데이터를 추천 카드로 변환한다.

```ts
if (state.recommendations.length < MIN_RECOMMENDATION_COUNT) {
  state.recommendations = this.uniqueRecommendations([
    ...state.recommendations,
    ...(await this.fallbackRecommendations(ragContext, state)),
  ]);
}
```

fallback SQL은 최신 게임 데이터를 가져와 최소 추천 개수를 채운다.

```ts
const localGames = await this.dataSource.query<LocalGameRow[]>(
  `
    SELECT id, title, "imageUrl", genres, platforms, tags, "steamAppId"
    FROM "Game"
    ORDER BY "updatedAt" DESC
    LIMIT 10
  `,
);
```

## 핵심 코드 6: 인증 API 연결

프론트엔드는 사용자 id를 보내지 않는다. JWT guard가 인증한 사용자 정보를 이용해서 서버가 `userId`를 결정한다.

```ts
@UseGuards(JwtAuthGuard)
@Controller('ai/recommendations')
export class RecommendationsController {
  constructor(private readonly agentService: AgentService) {}

  @Post('sync')
  sync(@Req() req: AuthedRequest, @Body() body: SyncRecommendationBody) {
    return this.agentService.syncRecommendations(req.user.userId, {
      forceRefresh: body?.forceRefresh,
      requestId: body?.requestId,
      topK: body?.topK,
    });
  }
}
```

## 환경 변수

```env
AGENT_MAX_ITERATIONS=4
AGENT_TIMEOUT_MS=30000
```

- `AGENT_MAX_ITERATIONS`: 한 번의 추천 루프에서 MCP 도구를 최대 몇 번 호출할지 정한다.
- `AGENT_TIMEOUT_MS`: 추천 루프 전체가 몇 ms 이상 걸리면 중단할지 정한다.

## 검증 결과

실행한 검증:

```bash
npm.cmd run build
npm.cmd test -- --runInBand
node -e "... AgentService.syncRecommendations(...) ..."
git diff --check
```

직접 호출 결과 요약:

```json
{
  "recommendations": 3,
  "first": "CrossCode",
  "firstProvider": "steam",
  "iterations": 4,
  "maxIterations": 4,
  "stoppedReason": "fallback",
  "mcpResultCount": 0,
  "sourceCount": 3
}
```

`mcpResultCount`가 0인 이유는 현재 로컬 환경에 `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`이 없기 때문이다. 하지만 Agent는 MCP 도구를 실제로 호출했고, 루프 제한 안에서 fallback 추천 3개를 만들어 최종 응답 계약을 만족했다.
