# GJC-165 MVP Smoke Quickstart Study Notes

## 작업 요약

GJC-165는 하루 MVP 제출 전에 실행 방법, 데모 시나리오, AI 필수 요구사항 충족 여부, 스모크 테스트 결과를 문서화한 작업이다.

- 루트 `README.md`를 새로 만들었다.
- Postgres, NestJS, React 실행 순서를 정리했다.
- 데모 계정 로그인 후 `SYNC_DATA`를 누르는 시나리오를 기록했다.
- RAG, MCP, Agent 요구사항이 어디서 확인되는지 체크리스트로 정리했다.
- 실제 스모크 테스트 명령과 결과 JSON을 기록했다.
- Vite 템플릿 상태였던 `client/README.md`를 프로젝트용 안내로 교체했다.

## 핵심 코드 1: Quickstart 실행 순서

루트 README의 Quickstart는 제출자가 그대로 따라 할 수 있는 순서로 구성했다.

```bash
docker compose up -d

cd server
cp .env.example .env
npm install
npm run start:dev

cd ../client
npm install
npm run dev -- --host 127.0.0.1
```

이 순서의 핵심은 DB가 먼저 떠 있어야 NestJS가 TypeORM 동기화, pgvector setup, demo seed를 정상 수행한다는 점이다.

## 핵심 코드 2: 데모 계정

```text
email: demo@gaming-journal.club
password: demo-password
```

이 계정은 `DEMO_SEED_ENABLED=true`일 때 NestJS bootstrap 과정에서 생성된다. 추천 SYNC 데모는 이 계정의 일지, 리뷰, 플레이 기록 seed 데이터를 기준으로 돌아간다.

## 핵심 코드 3: AI 요구사항 체크리스트

README에 남긴 체크리스트 구조:

```md
| Requirement | MVP implementation | Demo signal |
| --- | --- | --- |
| RAG feature | `RagService` reads seeded journals/reviews/profile documents and searches pgvector | `pipeline.rag.sourceCount > 0`, word cloud and preference tags render |
| MCP feature | `POST /mcp` implements JSON-RPC `tools/list` and `tools/call`; `search_games` targets IGDB | `pipeline.mcp.toolName = search_games`; missing IGDB keys return structured error |
| AI Agent feature | `AgentService` reads RAG, calls MCP, merges/fallbacks recommendations | `pipeline.agent.iterations`, `maxIterations`, `stoppedReason`, and 3 recommendation cards |
```

이 표는 제출 심사자가 "RAG/MCP/Agent를 어디에서 확인하면 되는지" 바로 볼 수 있게 만든 것이다.

## 핵심 코드 4: HTTP 스모크 테스트

브라우저 없이도 로그인 쿠키와 SYNC API를 확인할 수 있도록 PowerShell 스모크 명령을 문서화했다.

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod `
  -Uri 'http://127.0.0.1:3000/auth/login' `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"email":"demo@gaming-journal.club","password":"demo-password"}' `
  -WebSession $session

$result = Invoke-RestMethod `
  -Uri 'http://127.0.0.1:3000/ai/recommendations/sync' `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"forceRefresh":true,"topK":6,"requestId":"manual-smoke"}' `
  -WebSession $session
```

이 테스트는 프론트와 같은 인증 방식인 cookie 기반 요청을 사용한다. 즉, `Recommend.tsx`가 호출하는 API 흐름과 같은 서버 경로를 검증한다.

## 핵심 코드 5: 기록한 스모크 결과

```json
{
  "recommendations": 3,
  "first": "CrossCode",
  "preferenceTags": 6,
  "wordCloud": 6,
  "ragSources": 3,
  "mcpTool": "search_games",
  "mcpResults": 0,
  "agentIterations": 4,
  "stoppedReason": "fallback"
}
```

해석:

- 추천 카드 3개가 반환되므로 GJC-166 UI가 렌더링할 데이터가 충분하다.
- `ragSources = 3`이므로 RAG가 pgvector source를 읽었다.
- `mcpTool = search_games`이므로 Agent가 MCP 도구 이름을 trace에 남긴다.
- `agentIterations = 4`와 `stoppedReason = fallback`이므로 loop guard와 fallback이 동작했다.
- `mcpResults = 0`은 IGDB 키가 없는 로컬 환경의 정상 fallback 상태다.

## 핵심 코드 6: Known issue 기록

README에 known issue를 명시했다.

```md
- IGDB live metadata requires `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`. Without them, recommendations still render through local fallback data.
- FastAPI is not yet a running service in this repo. The current MVP Agent loop is implemented in NestJS, with `FASTAPI_AGENT_URL` kept for the future split.
- The local NestJS startup may print a pg deprecation warning about concurrent `client.query()` usage. The app still starts and the smoke test passes.
- In-app browser automation failed in this Codex Windows sandbox with `CreateProcessAsUserW failed: 5`; use the Vite URL manually for visual review.
```

known issue는 숨기는 것보다 명확히 적는 편이 좋다. 특히 IGDB 키 부재와 FastAPI 미분리는 심사자가 실행 중 마주칠 수 있는 포인트이므로, fallback 동작과 현재 MVP 범위를 같이 적었다.

## 검증 결과

실행한 검증:

```bash
docker compose ps
cd server && npm.cmd run build
cd server && npm.cmd test -- --runInBand
cd client && npm.cmd run lint
cd client && npm.cmd run build
```

결과:

- Postgres container: `game-archive-postgres`, `Up`, `5432->5432`.
- Server build: pass.
- Server tests: 2 suites / 2 tests pass.
- Client lint: pass.
- Client build: pass.
- HTTP login + SYNC smoke: pass.
