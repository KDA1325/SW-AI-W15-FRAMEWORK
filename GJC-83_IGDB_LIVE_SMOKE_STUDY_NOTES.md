# GJC-83 IGDB Live Smoke Study Notes

## 1. 작업 요약

`GJC-83`의 핵심 완료 기준은 MCP `search_games` tool이 실제 IGDB 외부 게임 데이터를 반환하는지 검증하는 것이다. 이번 작업에서는 별도 dev server를 오래 띄우지 않아도 검증할 수 있도록 `server/scripts/smoke-mcp-igdb.js`를 개선했다.

변경 파일:

- `server/scripts/smoke-mcp-igdb.js`
- `server/package.json`
- `server/README.md`
- `README.md`
- `GJC-83_IGDB_LIVE_SMOKE_STUDY_NOTES.md`

## 2. 실행 명령

서버 디렉터리에서 아래 명령을 실행한다.

```bash
cd server
npm run smoke:mcp:igdb
```

필요한 환경 변수:

```env
IGDB_CLIENT_ID=...
IGDB_CLIENT_SECRET=...
```

기본 실행은 임시 NestJS app을 랜덤 로컬 포트에 띄우고, 실제 `POST /mcp` route를 호출한 뒤 app을 닫는다. 이미 실행 중인 서버를 대상으로 검증하려면 `MCP_SMOKE_BASE_URL`을 지정한다.

```bash
MCP_SMOKE_BASE_URL=http://127.0.0.1:3000 MCP_SMOKE_QUERY=CrossCode MCP_SMOKE_LIMIT=3 npm run smoke:mcp:igdb
```

## 3. 왜 임시 Nest app을 띄우는가

Windows 샌드박스에서는 dev server를 백그라운드로 안정적으로 유지하기 어렵다. 그래서 스모크 스크립트가 직접 Nest app을 띄우고 OS가 배정한 임시 포트로 HTTP 요청을 보낸다.

```js
const app = await NestFactory.create(AppModule, {
  logger: ['error', 'warn'],
});
await app.listen(0, '127.0.0.1');

const address = app.getHttpServer().address();

return {
  baseUrl: `http://127.0.0.1:${address.port}`,
  close: () => app.close(),
};
```

`listen(0)`은 고정 포트 `3000` 충돌을 피하기 위해 OS가 빈 포트를 고르게 하는 방식이다.

## 4. 왜 IgdbService를 직접 부르지 않는가

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

## 5. JSON-RPC 요청 모양

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

## 6. 성공 기준

스크립트는 `structuredContent.games`가 배열이고, 최소 1개 이상의 게임이 있어야 성공한다.

```js
const games = structuredContent.games;

if (!Array.isArray(games) || games.length === 0) {
  throw new Error('MCP search_games returned zero IGDB games.');
}
```

성공하면 API key 없이 공유 가능한 요약만 출력한다.

```js
firstGames: games.slice(0, 3).map((game) => ({
  genres: game.genres,
  platforms: game.platforms,
  releaseDate: game.releaseDate,
  sourceUrl: game.sourceUrl,
  title: game.title,
})),
```

## 7. 실패 기준

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

## 8. 라이브 검증 결과

IGDB credential 설정 후 `npm run smoke:mcp:igdb`를 실행했고, 샌드박스 네트워크에서는 `network_error`가 발생했다. 같은 명령을 네트워크 권한 상승으로 다시 실행하자 실제 IGDB 결과가 반환되었다.

```json
{
  "ok": true,
  "mode": "temporary-nest-app",
  "provider": "igdb",
  "query": "CrossCode",
  "resultCount": 2,
  "firstGames": [
    {
      "title": "CrossCode",
      "releaseDate": "2018-09-20",
      "sourceUrl": "https://www.igdb.com/games/crosscode"
    },
    {
      "title": "CrossCode: A New Home",
      "releaseDate": "2021-02-26",
      "sourceUrl": "https://www.igdb.com/games/crosscode-a-new-home"
    }
  ]
}
```

이 결과로 `GJC-83`의 핵심 완료 기준인 "MCP Tool 호출로 실제 외부 게임 데이터가 반환된다"를 검증했다.
