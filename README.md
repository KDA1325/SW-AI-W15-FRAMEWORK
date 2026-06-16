# Gaming Journal Club

Gaming Journal Club is a retro 8-bit styled game journal and recommendation MVP. Users write game journals and reviews, then run AI SYNC to generate preference tags, a play-style word cloud, and personalized game recommendations.

## Stack

| Layer                  | Tech                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| Frontend               | React, Vite, TypeScript                                          |
| Backend API            | NestJS                                                           |
| Database               | PostgreSQL with pgvector                                         |
| RAG                    | NestJS RAG service, pgvector, FastAPI LangChain/OpenAI/demo embeddings |
| MCP                    | JSON-RPC MCP endpoint with `search_games` tool                   |
| Agent                  | NestJS MVP Agent loop with max iterations, timeout, and fallback |
| External game metadata | IGDB API through MCP                                             |

FastAPI is now attached as a stateless AI compute service for embedding
generation and uses LangChain for OpenAI embedding calls. The current one-day
MVP keeps the Agent loop inside NestJS so RAG, MCP, and React can be tested end
to end.

## Quickstart

### 1. Start Postgres And FastAPI AI Compute

Run from the repository root:

```bash
docker compose up -d
```

The database container uses `pgvector/pgvector:pg16` and exposes local port
`5432`. The FastAPI AI compute service exposes local port `8000`.

### 2. Configure the server

```bash
cd server
cp .env.example .env
```

For the local MVP, the checked-in defaults are enough except `JWT_SECRET`, which should be changed before sharing a deployed environment.

Demo account seeded by the backend:

```text
email: demo@gaming-journal.club
password: demo-password
```

Optional AI/external keys:

| Variable                               | Purpose                                     | Local fallback                                                  |
| -------------------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| `OPENAI_API_KEY`                       | Real embeddings and structured RAG analysis | deterministic demo embeddings and rule-based analysis           |
| `FASTAPI_AI_COMPUTE_URL`               | FastAPI AI compute service URL              | `http://localhost:8000`                                         |
| `FASTAPI_AI_COMPUTE_TIMEOUT_MS`        | NestJS to FastAPI AI compute timeout        | `5000`                                                          |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | Live IGDB MCP game metadata                 | MCP returns `missing_credentials`; Agent uses local DB fallback |
| `STEAM_WEB_API_KEY`                    | Steam profile/play-history linking          | not required for current SYNC demo                              |
| `AGENT_MAX_ITERATIONS`                 | Max MCP calls in one Agent loop             | `4`                                                             |
| `AGENT_TIMEOUT_MS`                     | Max local Agent loop duration               | `30000`                                                         |
| `FASTAPI_AGENT_URL`                    | Later FastAPI Agent service URL             | reserved                                                        |

### 3. Install dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 4. Run the app

Use separate terminals.

Backend:

```bash
cd server
npm run start:dev
```

FastAPI only:

```bash
cd ai-compute
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd client
npm run dev -- --host 127.0.0.1
```

Open the Vite URL, usually:

```text
http://127.0.0.1:5173
```

If Vite says 5173 is already in use, use the next URL it prints.

## Demo Scenario

1. Open the frontend.
2. Log in with `demo@gaming-journal.club` / `demo-password`.
3. Go to `RECOMMEND`.
4. Click `SYNC_DATA`.
5. Confirm the page renders:
   - `YOUR PLAY STYLE` word cloud from RAG analysis.
   - `GAMES YOU ENJOY` preference tags.
   - `RECOMMENDED GAMES` cards with title, platform/genre, reason, matched tags, and source link.
   - `PIPELINE` trace showing RAG, MCP, and Agent values.

Optional Steam profile check:

1. Go to `PROFILE`.
2. Paste a SteamID64 or Steam profile URL in `STEAM_PROFILE`.
3. Click `LINK`.
4. With `STEAM_WEB_API_KEY` configured, confirm the Steam avatar, persona name, and profile link render.
5. Without `STEAM_WEB_API_KEY`, confirm the panel shows `missing_credentials` instead of breaking the page.

Live Steam API smoke test:

```bash
cd server
npm run smoke:steam
```

Recorded live result on `2026-06-16`: Steam profile `76561197960435530` returned persona name `Robin` through the authenticated `/auth/steam/link` and `/auth/steam/profile` flow.

## AI Requirement Checklist

The detailed RAG technology and data-pipeline decision is documented in [`docs/GJC-78_RAG_TECH_DECISION.md`](docs/GJC-78_RAG_TECH_DECISION.md).

| Requirement        | MVP implementation                                                                           | Demo signal                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| RAG feature        | `RagService` reads seeded journals/reviews/profile documents and searches pgvector           | `pipeline.rag.sourceCount > 0`, word cloud and preference tags render                     |
| MCP feature        | `POST /mcp` implements JSON-RPC `tools/list` and `tools/call`; `search_games` targets IGDB   | `pipeline.mcp.toolName = search_games`; missing IGDB keys return structured error         |
| AI Agent feature   | `AgentService` reads RAG, calls MCP, merges/fallbacks recommendations                        | `pipeline.agent.iterations`, `maxIterations`, `stoppedReason`, and 3 recommendation cards |
| Loop guard         | `AGENT_MAX_ITERATIONS`, `AGENT_TIMEOUT_MS`, fallback recommendations                         | local smoke shows `agentIterations = 4`, `stoppedReason = fallback`                       |
| React integration  | `Recommend.tsx` calls `POST /ai/recommendations/sync`                                        | SYNC click renders API data instead of dummy arrays                                       |
| Steam profile link | `Profile.tsx` calls `GET/POST/DELETE /auth/steam/*`; server calls Steam `GetPlayerSummaries` | Profile panel shows linked Steam profile or structured missing-credentials state          |

## Smoke Test Results

Last recorded smoke test: `2026-06-16` local development environment.

Latest active-sprint regression memo: [`GJC-93_P2_QA_DEMO_MEMO.md`](GJC-93_P2_QA_DEMO_MEMO.md).

Commands:

```bash
docker compose ps

cd server
npm run smoke:ai-compute
npm run build
npm test -- --runInBand

cd ../client
npm run lint
npm run build
```

HTTP SYNC smoke test:

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

Recorded result summary:

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

`mcpResults` is `0` in this local smoke test because IGDB credentials are not configured. The MCP tool is still called, reports a structured missing-credentials result, and the Agent returns local fallback recommendations.

Optional live IGDB MCP smoke test after configuring `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`:

```bash
cd server
npm run smoke:mcp:igdb
```

This starts a temporary NestJS app, calls the real `POST /mcp` JSON-RPC endpoint, and fails unless IGDB returns at least one game. To test an already-running server, set `MCP_SMOKE_BASE_URL`.

Recorded live IGDB MCP result on `2026-06-16`:

```json
{
  "ok": true,
  "provider": "igdb",
  "query": "CrossCode",
  "resultCount": 2,
  "first": "CrossCode"
}
```

## Known Issues

- IGDB live metadata requires `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`. Without them, recommendations still render through local fallback data.
- Steam live profile display requires `STEAM_WEB_API_KEY`. Without it, the profile page shows a structured `missing_credentials` state.
- The current Steam link MVP stores a SteamID64 after API lookup, but does not prove ownership of the Steam account. Add Steam OpenID before using this as account verification.
- The current MVP Agent loop is still implemented in NestJS. FastAPI handles the first compute split through `/health` and `/embed`; broader Agent migration is still future work behind `FASTAPI_AGENT_URL`.
- The local NestJS startup may print a pg deprecation warning about concurrent `client.query()` usage. The app still starts and the smoke test passes.
- In-app browser automation failed in this Codex Windows sandbox with `CreateProcessAsUserW failed: 5`; use the Vite URL manually for visual review.

## Study Notes

- `GJC-78_RAG_TECH_DECISION_STUDY_NOTES.md`
- `GJC-163_AI_RECOMMENDATION_CONTRACT_STUDY_NOTES.md`
- `GJC-164_DB_PGVECTOR_SEED_STUDY_NOTES.md`
- `GJC-80_RAG_CONTEXT_API_STUDY_NOTES.md`
- `GJC-83_MCP_IGDB_TOOL_STUDY_NOTES.md`
- `GJC-85_API_KEY_ERROR_STRATEGY_STUDY_NOTES.md`
- `GJC-88_AGENT_RECOMMENDATION_LOOP_STUDY_NOTES.md`
- `GJC-166_REACT_RECOMMENDATION_SYNC_STUDY_NOTES.md`
