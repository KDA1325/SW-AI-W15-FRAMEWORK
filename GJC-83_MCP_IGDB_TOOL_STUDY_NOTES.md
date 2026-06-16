# GJC-83 MCP IGDB Tool 구현 학습 정리

## 1. 작업 범위

이번 노트는 `GJC-83 [P0-04][MCP] 외부 게임 API JSON-RPC Tool 연동` 작업에서 변경한 아래 파일을 기준으로 정리한다.

- `server/.env.example`
- `server/README.md`
- `server/src/ai/ai.module.ts`
- `server/src/ai/igdb.service.ts`
- `server/src/ai/mcp.controller.ts`
- `server/src/ai/mcp.service.ts`

핵심 목표는 Agent가 호출할 수 있는 최소 JSON-RPC MCP endpoint를 만들고, `search_games` tool이 IGDB 게임 메타데이터를 추천 카드에 쓸 수 있는 형태로 반환하게 하는 것이다.

## 2. MCP endpoint는 JSON-RPC 요청을 받는다

컨트롤러는 단순하다. HTTP transport 역할만 하고 실제 JSON-RPC 분기는 `McpService`에 맡긴다.

```ts
@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post()
  handle(@Body() body: unknown) {
    return this.mcpService.handle(body as Parameters<McpService['handle']>[0]);
  }
}
```

이번 MVP에서는 `POST /mcp` 하나만 둔다. Agent는 이 endpoint에 `tools/list`와 `tools/call` JSON-RPC 메시지를 보낸다.

## 3. tools/list는 search_games schema를 알려준다

MCP client는 먼저 tool 목록을 조회한다.

```ts
if (request.method === 'tools/list') {
  return this.result(request.id ?? null, {
    tools: [this.searchGamesToolDefinition()],
  });
}
```

`search_games`의 입력 schema는 query를 필수로 두고, limit과 preferenceTags는 선택값으로 둔다.

```ts
inputSchema: {
  additionalProperties: false,
  properties: {
    limit: {
      default: 5,
      description: 'Maximum games to return. Range: 1-10.',
      maximum: 10,
      minimum: 1,
      type: 'number',
    },
    preferenceTags: {
      items: { type: 'string' },
      type: 'array',
    },
    query: {
      description: 'Game title or search phrase.',
      minLength: 1,
      type: 'string',
    },
  },
  required: ['query'],
  type: 'object',
}
```

`preferenceTags`는 IGDB 검색 자체에 직접 쓰지는 않지만, Agent가 “왜 이 검색어를 골랐는지” 상태로 유지할 수 있게 받는다.

## 4. tools/call은 search_games를 실행한다

`tools/call`은 tool 이름과 arguments를 검사한 뒤 IGDB service를 호출한다.

```ts
if (toolParams?.name !== 'search_games') {
  return this.error(id, -32602, `Unknown tool: ${String(toolParams?.name)}`);
}

const input = this.parseSearchGamesInput(toolParams.arguments);

if (!input) {
  return this.error(
    id,
    -32602,
    'search_games requires arguments.query as a non-empty string.',
  );
}
```

잘못된 JSON-RPC 요청이나 알 수 없는 tool은 protocol error로 돌려준다. 반면 IGDB 키 없음, API 실패 같은 실행 오류는 tool result의 `isError: true`로 돌려준다.

## 5. structuredContent와 text content를 함께 반환한다

MCP tool result는 기계가 읽기 좋은 `structuredContent`와 사람이 읽기 좋은 text block을 같이 반환한다.

```ts
return this.result(id, {
  content: [
    {
      text: JSON.stringify(result, null, 2),
      type: 'text',
    },
  ],
  isError,
  structuredContent: result,
});
```

이렇게 하면 Agent는 `structuredContent.games`를 바로 읽을 수 있고, 단순 MCP client에서도 text 결과를 볼 수 있다.

## 6. IGDB는 Twitch OAuth token이 필요하다

IGDB API는 `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`으로 Twitch token을 먼저 받은 뒤 호출한다.

```ts
const response = await axios.post<TwitchTokenResponse>(
  'https://id.twitch.tv/oauth2/token',
  null,
  {
    params: {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    },
    timeout: 15000,
  },
);
```

token은 만료 전까지 재사용한다.

```ts
if (this.token && this.token.expiresAt > now + 60_000) {
  return this.token.accessToken;
}
```

이 캐싱이 없으면 `search_games`를 호출할 때마다 token 요청이 발생해서 느리고 rate limit에도 취약해진다.

## 7. IGDB games endpoint는 APICalypse text query를 보낸다

IGDB는 JSON body가 아니라 APICalypse 문법의 text body를 받는다.

```ts
return [
  'fields name,slug,summary,first_release_date,total_rating,cover.image_id,genres.name,platforms.name,themes.name;',
  `search "${search}";`,
  'where version_parent = null;',
  `limit ${limit};`,
].join('\n');
```

여기서 가져오는 필드는 추천 카드에 필요한 최소 정보다.

- `name`: 카드 제목
- `cover.image_id`: 표지 이미지 URL 생성
- `genres.name`: 장르
- `platforms.name`: 플랫폼
- `first_release_date`: 출시일
- `summary`: 추천 이유 생성에 쓸 설명
- `slug`: IGDB 상세 URL 생성

## 8. IGDB 응답을 추천 카드 형태로 변환한다

IGDB row를 Agent가 쓰기 쉬운 구조로 바꾼다.

```ts
return {
  externalId: {
    id: String(game.id),
    provider: 'igdb',
  },
  genres: this.names(game.genres),
  imageUrl: game.cover?.image_id
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
    : null,
  platforms: this.names(game.platforms),
  releaseDate: game.first_release_date
    ? new Date(game.first_release_date * 1000).toISOString().slice(0, 10)
    : null,
  sourceUrl: slug ? `https://www.igdb.com/games/${slug}` : null,
  summary: game.summary ?? null,
  tags: this.names(game.themes),
  title: game.name,
};
```

이 형태는 GJC-88 Agent가 추천 카드 JSON을 만들 때 그대로 합치기 쉽다.

## 9. 키가 없을 때도 구조화된 오류를 반환한다

현재 로컬 `.env`에는 IGDB 키가 없다. 그래서 실제 외부 데이터 호출은 아직 검증하지 못했고, missing credentials 경로를 검증했다.

```ts
if (!clientId || !clientSecret) {
  return {
    error:
      'IGDB credentials are missing. Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET.',
    games: [],
    provider: 'igdb',
  };
}
```

검증 결과:

```json
{
  "toolName": "search_games",
  "callIsError": true,
  "provider": "igdb",
  "games": 0,
  "error": "IGDB credentials are missing. Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET."
}
```

GJC-83의 실제 외부 데이터 반환 완료 기준을 완전히 닫으려면 `IGDB_CLIENT_ID`와 `IGDB_CLIENT_SECRET`이 필요하다.
