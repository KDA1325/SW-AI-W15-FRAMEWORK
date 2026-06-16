# GJC-83 IGDB Live Smoke Study Notes

## 1. 작업 요약

`GJC-83`의 남은 완료 기준은 `search_games` MCP tool이 실제 IGDB 외부 데이터를 반환하는지 검증하는 것이다. 현재 로컬 `.env`에는 IGDB credential이 없어서 라이브 호출 자체는 아직 닫을 수 없지만, credential이 들어오는 즉시 같은 명령으로 검증할 수 있도록 스모크 스크립트를 추가했다.

변경 파일:

- `server/scripts/smoke-mcp-igdb.js`
- `server/package.json`
- `server/README.md`
- `README.md`

## 2. 실행 명령

NestJS 서버를 먼저 실행한 뒤, 서버 디렉터리에서 아래 명령을 실행한다.

```bash
cd server
npm run smoke:mcp:igdb
```

필요한 환경 변수:

```env
IGDB_CLIENT_ID=...
IGDB_CLIENT_SECRET=...
```

옵션으로 MCP 서버 URL, 검색어, 결과 개수를 바꿀 수 있다.

```bash
MCP_SMOKE_BASE_URL=http://127.0.0.1:3000 MCP_SMOKE_QUERY=CrossCode MCP_SMOKE_LIMIT=3 npm run smoke:mcp:igdb
```

## 3. 왜 IgdbService를 직접 부르지 않는가

스크립트는 `IgdbService.searchGames()`를 직접 실행하지 않고 `POST /mcp`를 호출한다.

```js
const response = await axios.post(`${baseUrl}/mcp`, payload, {
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});
```

이렇게 해야 한 번에 아래 범위를 검증할 수 있다.

```text
HTTP POST /mcp
  -> JSON-RPC method routing
  -> tools/call parsing
  -> search_games tool execution
  -> Twitch token request
  -> IGDB games request
  -> structuredContent normalization
```

즉, Jira 완료 기준인 "MCP Tool 호출로 실제 외부 게임 데이터가 반환된다"를 가장 직접적으로 확인하는 방식이다.

## 4. JSON-RPC 요청 모양

스모크 스크립트가 보내는 payload는 MCP tool 호출 형식과 같다.

```js
const payload = {
  id: 'igdb-live-smoke',
  jsonrpc: '2.0',
  method: 'tools/call',
  params: {
    arguments: {
      limit,
      preferenceTags: ['RETRO_PIXEL', 'STORY_DRIVEN'],
      query,
    },
    name: 'search_games',
  },
};
```

`preferenceTags`는 IGDB 검색어 자체에는 직접 쓰이지 않지만, Agent가 어떤 RAG 신호를 들고 tool을 호출했는지 추적하기 위한 입력이다.

## 5. 성공 기준

스크립트는 `structuredContent.games`가 배열이고, 최소 1개 이상의 게임이 있어야 성공한다.

```js
const games = structuredContent.games;

if (!Array.isArray(games) || games.length === 0) {
  throw new Error('MCP search_games returned zero IGDB games.');
}
```

성공하면 API key 없이 공유 가능한 요약만 출력한다.

```json
{
  "ok": true,
  "provider": "igdb",
  "query": "CrossCode",
  "resultCount": 3,
  "firstGames": [
    {
      "title": "CrossCode",
      "genres": ["Role-playing (RPG)", "Adventure"],
      "platforms": ["PC (Microsoft Windows)"],
      "releaseDate": "2018-09-20",
      "sourceUrl": "https://www.igdb.com/games/crosscode"
    }
  ]
}
```

실제 결과는 IGDB 응답에 따라 달라질 수 있다.

## 6. 실패 기준

credential이 없으면 서버를 호출하기 전에 바로 실패한다.

```js
if (!hasIgdbCredentials()) {
  console.error(
    'IGDB credentials are missing. Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET in server/.env before running this smoke test.',
  );
  process.exitCode = 1;
  return;
}
```

MCP가 구조화 오류를 반환해도 실패한다.

```js
if (response.data?.result?.isError || structuredContent.error) {
  throw new Error(
    `MCP search_games failed with ${structuredContent.errorCode ?? 'unknown_error'}: ${structuredContent.error ?? 'no message'}`,
  );
}
```

이 실패 처리는 `missing_credentials`, `unauthorized`, `rate_limited`, `network_error`, `external_api_error` 같은 기존 오류 전략과 맞물린다.

## 7. 비밀 값 출력 방지

스크립트는 `.env`를 읽지만, `IGDB_CLIENT_ID`나 `IGDB_CLIENT_SECRET` 값을 출력하지 않는다. 성공 출력도 게임 제목, 장르, 플랫폼, 출시일, IGDB URL 같은 추천 카드 검증 정보만 포함한다.

```js
firstGames: games.slice(0, 3).map((game) => ({
  genres: game.genres,
  platforms: game.platforms,
  releaseDate: game.releaseDate,
  sourceUrl: game.sourceUrl,
  title: game.title,
})),
```

## 8. 현재 남은 일

현재 로컬 `server/.env`에는 IGDB credential이 없으므로 실제 외부 데이터 반환은 아직 검증하지 못했다. 값을 설정한 뒤 `npm run smoke:mcp:igdb`가 성공하면 `GJC-83`을 완료 상태로 전환할 수 있다.
