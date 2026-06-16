# Game Archive Server

NestJS backend server for authentication and API features.

## Requirements

- Node.js
- npm
- Docker Desktop

## Environment Variables

Create `server/.env` from `server/.env.example`.

```bash
cd server
cp .env.example .env
```

Required values:

| Name                          | Description                                                        | Local value                |
| ----------------------------- | ------------------------------------------------------------------ | -------------------------- |
| `DATABASE_HOST`               | PostgreSQL host                                                    | `localhost`                |
| `DATABASE_PORT`               | PostgreSQL port                                                    | `5432`                     |
| `DATABASE_USER`               | PostgreSQL user                                                    | `game_archive_user`        |
| `DATABASE_PASSWORD`           | PostgreSQL password                                                | `game_archive_password`    |
| `DATABASE_NAME`               | PostgreSQL database name                                           | `game_archive`             |
| `JWT_SECRET`                  | Secret key used to sign JWT tokens                                 | Use a long random string   |
| `JWT_EXPIRES_IN`              | JWT expiration time                                                | `1d`                       |
| `SERVER_URL`                  | Backend public origin used for Steam OpenID callback URLs          | `http://localhost:3000`    |
| `CLIENT_URL`                  | Frontend origin allowed by CORS                                    | `http://localhost:5173`    |
| `DEMO_SEED_ENABLED`           | Enables local demo AI seed data                                    | `true`                     |
| `DEMO_USER_EMAIL`             | Fixed demo login email                                             | `demo@gaming-journal.club` |
| `DEMO_USER_PASSWORD`          | Fixed demo login password                                          | `demo-password`            |
| `DEMO_STEAM_ID`               | Optional SteamID64 for demo profile linking                        | empty                      |
| `OPENAI_API_KEY`              | Optional OpenAI API key for RAG embeddings and structured analysis | empty                      |
| `OPENAI_CHAT_MODEL`           | Chat model for RAG JSON analysis                                   | `gpt-4o-mini`              |
| `OPENAI_EMBEDDING_MODEL`      | Embedding model for pgvector documents                             | `text-embedding-3-small`   |
| `OPENAI_EMBEDDING_DIMENSIONS` | Embedding vector size                                              | `1536`                     |
| `FASTAPI_AI_COMPUTE_URL`      | FastAPI AI compute service base URL                                | `http://localhost:8000`    |
| `FASTAPI_AI_COMPUTE_TIMEOUT_MS` | NestJS to FastAPI AI compute timeout                             | `5000`                     |
| `PGVECTOR_CONNECTION_STRING`  | FastAPI LangChain retriever database URL                           | Docker Compose default     |
| `IGDB_CLIENT_ID`              | Twitch/IGDB Client ID for game metadata search                     | empty                      |
| `IGDB_CLIENT_SECRET`          | Twitch/IGDB Client Secret for game metadata search                 | empty                      |
| `MCP_REQUIRE_AUTH`            | Requires JWT or internal-token auth for `POST /mcp`                | `true`                     |
| `MCP_ALLOW_UNAUTHENTICATED`   | Explicit non-production escape hatch for local MCP smoke testing   | `false`                    |
| `MCP_INTERNAL_TOKEN`          | Shared internal token accepted by `x-mcp-internal-token`           | empty                      |
| `STEAM_WEB_API_KEY`           | Steam Web API key for profile and play-history linking             | empty                      |
| `AGENT_MAX_ITERATIONS`        | Maximum MCP tool calls in one recommendation loop                  | `4`                        |
| `AGENT_TIMEOUT_MS`            | Maximum local Agent loop duration                                  | `30000`                    |
| `FASTAPI_AGENT_URL`           | FastAPI Agent base URL                                             | `http://localhost:8000`    |
| `FASTAPI_AGENT_TIMEOUT_MS`    | NestJS to FastAPI Agent timeout                                    | `30000`                    |

Do not commit `server/.env`. It can contain secrets such as `JWT_SECRET`.

## External API Key And Error Strategy

GJC-85 defines the MVP security rules for LLM, MCP, IGDB, Steam, and FastAPI Agent integration.

### Secret Storage Rules

- Never hardcode API keys, access tokens, client secrets, JWT secrets, or database passwords in source code.
- Keep local secrets only in `server/.env`, which must stay untracked.
- Commit only variable names and safe defaults in `server/.env.example`.
- Production secrets must be configured in the deployment platform or a secrets manager, not in git.
- Do not log full request headers, `Authorization` values, `client_secret`, access tokens, or `.env` contents.

### Required Keys By Feature

| Feature                                       | Variables                                           | Behavior when missing                                                                                  |
| --------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| FastAPI LangChain/OpenAI RAG embeddings and retrieval | `FASTAPI_AI_COMPUTE_URL`, `PGVECTOR_CONNECTION_STRING`, `OPENAI_API_KEY`, optional model vars | Calls FastAPI `/embed` and `/rag/search`; NestJS falls back when unavailable |
| IGDB MCP game metadata                        | `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`              | `search_games` returns `isError: true`, `errorCode: "missing_credentials"`, and an empty `games` array |
| MCP HTTP endpoint auth                        | `MCP_REQUIRE_AUTH`, `MCP_INTERNAL_TOKEN`, optional JWT cookie | `POST /mcp` returns a JSON-RPC auth error instead of executing tools |
| Steam profile link                            | `STEAM_WEB_API_KEY`, user `steamId`/`DEMO_STEAM_ID` | Steam profile link returns a structured missing-credentials or missing-profile error                   |
| OpenAI native Agent tool calling              | `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`              | Uses Chat Completions `tools`/`tool_calls`; falls back to FastAPI/local planning when unavailable       |
| Recommendation Agent loop                     | `AGENT_MAX_ITERATIONS`, `AGENT_TIMEOUT_MS`          | Stops the MCP loop and returns local fallback recommendations instead of hanging                       |
| FastAPI Agent planner                         | `FASTAPI_AGENT_URL`, `FASTAPI_AGENT_TIMEOUT_MS`     | Calls `/agent/recommendations/plan`; NestJS falls back to its local query builder when unavailable     |

### External Failure Mapping

| Failure                          | Error code            | Required behavior                                              |
| -------------------------------- | --------------------- | -------------------------------------------------------------- |
| Missing key/secret               | `missing_credentials` | Return a clear setup message and empty result                  |
| Invalid key or permission denied | `unauthorized`        | Return a credential/permission message without echoing the key |
| Quota or rate limit              | `rate_limited`        | Return an empty result and tell the Agent it can retry later   |
| Timeout, DNS, connection reset   | `network_error`       | Return an empty result and keep the recommendation flow alive  |
| Unexpected provider response     | `external_api_error`  | Return a generic provider failure message without stack traces |

### MCP Tool Error Shape

`POST /mcp` is protected by default. Production always requires either a valid
JWT (`access_token` cookie or bearer token) or a matching
`x-mcp-internal-token` header. Local development can opt into unauthenticated
MCP requests only by setting `MCP_ALLOW_UNAUTHENTICATED=true` or
`MCP_REQUIRE_AUTH=false` outside production.

When MCP auth fails, the endpoint returns a JSON-RPC error and does not execute
the requested tool:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32001,
    "message": "MCP authentication required. Provide a valid JWT cookie or x-mcp-internal-token header."
  }
}
```

`search_games` reports tool execution failures through the MCP result, not as uncaught server exceptions:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{ \"provider\": \"igdb\", \"games\": [], \"errorCode\": \"missing_credentials\" }"
      }
    ],
    "isError": true,
    "structuredContent": {
      "provider": "igdb",
      "games": [],
      "error": "IGDB credentials are missing. Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET.",
      "errorCode": "missing_credentials"
    }
  }
}
```

This lets the Agent continue with a fallback plan instead of crashing the full SYNC flow.

## Steam Profile Link API

The profile page can link a Steam profile through the authenticated NestJS API.

```text
GET /auth/steam/profile
POST /auth/steam/link
DELETE /auth/steam/link
```

`POST /auth/steam/link` accepts a SteamID64, a `steamcommunity.com/profiles/<steamid>` URL, or a `steamcommunity.com/id/<vanity>` URL:

```json
{
  "steamProfile": "76561198000000000"
}
```

When `STEAM_WEB_API_KEY` is configured, the server calls Steam Web API `ISteamUser/GetPlayerSummaries/v2`, stores the verified SteamID64 on `User.steamId`, and returns a display profile:

```json
{
  "connected": true,
  "steamId": "76561198000000000",
  "profile": {
    "steamId": "76561198000000000",
    "personaName": "PLAYER",
    "profileUrl": "https://steamcommunity.com/profiles/76561198000000000/",
    "avatarUrl": "https://...",
    "visibilityState": 3
  },
  "error": null,
  "errorCode": null
}
```

When the key is missing, the API returns `connected: false`, `errorCode: "missing_credentials"`, and does not store the profile. Vanity URLs also require the key because they must be resolved through `ISteamUser/ResolveVanityURL/v1`.

`GET /auth/steam/openid` starts the ownership-verified Steam OpenID link flow. The callback posts Steam's signed OpenID payload back to Steam with `check_authentication`, stores the verified SteamID64 on success, and redirects back to `${CLIENT_URL}/profile` with the link result in query parameters.

`GET /auth/steam/stats` returns the linked user's Steam stats for the profile stat grid. It combines `GetOwnedGames`, `GetRecentlyPlayedGames`, and per-app `GetPlayerAchievements` calls across played games, then returns owned game count including played free games, achievement totals, recent playtime, recent games, and the shorter Steam friend-code identifier. Steam's public recent-play API exposes a two-week playtime window instead of daily timestamps, so the response labels the current profile fallback as `recentWindowDays: 14`.

### Live Steam Profile Smoke Test

After adding `STEAM_WEB_API_KEY` to `server/.env`, run:

```bash
cd server
npm run smoke:steam
```

By default, the script starts a temporary NestJS app, logs in as the demo user, links a public Steam profile through `POST /auth/steam/link`, verifies `GET /auth/steam/profile`, and then restores the demo user's previous Steam link. Override the target profile with `STEAM_SMOKE_PROFILE=<steamid-or-url>`.

Recorded live Steam result on `2026-06-16`:

```json
{
  "ok": true,
  "mode": "temporary-nest-app",
  "steamId": "76561197960435530",
  "personaName": "Robin"
}
```

## Start PostgreSQL

Run this command from the repository root:

```bash
docker compose up -d
```

The Docker PostgreSQL settings are defined in `docker-compose.yml`.

| Docker setting                            | Server env value                                |
| ----------------------------------------- | ----------------------------------------------- |
| `POSTGRES_DB=game_archive`                | `DATABASE_NAME=game_archive`                    |
| `POSTGRES_USER=game_archive_user`         | `DATABASE_USER=game_archive_user`               |
| `POSTGRES_PASSWORD=game_archive_password` | `DATABASE_PASSWORD=game_archive_password`       |
| `5432:5432`                               | `DATABASE_HOST=localhost`, `DATABASE_PORT=5432` |

## Install and Run

Run these commands from `server/`:

```bash
npm install
npm run start:dev
```

The server runs at:

```text
http://localhost:3000
```

The frontend development server is expected at:

```text
http://localhost:5173
```

## CORS, Cookies, and JWT

CORS is configured in `src/main.ts`.

- `CLIENT_URL` is the frontend origin allowed to call the API.
- `credentials: true` allows browser requests to include cookies.

Authentication uses an HTTP-only cookie named `access_token`.

- The cookie is created after login/register.
- `httpOnly: true` prevents browser JavaScript from reading the token directly.
- `sameSite: 'lax'` supports normal local development navigation.
- `secure: false` is for local HTTP development. Use HTTPS and `secure: true` in production.

JWT settings are configured in `src/auth/auth.module.ts`.

- `JWT_SECRET` is required. The server should not start without it.
- `JWT_EXPIRES_IN` controls token expiration, for example `1d`.

## TypeORM Synchronize

The current local development setting uses:

```ts
synchronize: true
```

This lets TypeORM update the local database schema from entity classes during development.
It is convenient for local work, but it should not be used in production because schema changes can cause data loss.

Before production deployment, replace this with TypeORM migrations.

## Demo AI Seed Data

`DEMO_SEED_ENABLED=true` seeds the minimum data required by the AI recommendation MVP. The seed runs during NestJS application bootstrap after TypeORM synchronization and pgvector setup.

Seeded values:

| Data                   | Purpose                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Demo user              | Fixed user id `00000000-0000-4000-8000-000000000001` for end-to-end AI demos                            |
| Games                  | `Into the Breach`, `Disco Elysium`, `CrossCode` with Steam ids, tags, genres, platforms, and cover URLs |
| Posts                  | One review and two journal entries connected to the demo user and games                                 |
| UserGame rows          | Playtime and achievement signals for taste analysis                                                     |
| AiProfile              | Precomputed play style summary, favorite keywords, favorite genres                                      |
| Recommendation         | A saved recommendation row for `CrossCode`                                                              |
| EmbeddingDocument rows | Journal, review, profile, and game source documents with pgvector values                                |

The seed is idempotent: restarting the server updates the same fixed records instead of creating duplicates.

Useful verification query:

```sql
SELECT
  ed."sourceType",
  ed."sourceId",
  ed.metadata ->> 'title' AS title,
  ed.metadata ->> 'model' AS embedding_model,
  ed."embedding" IS NOT NULL AS has_embedding
FROM "EmbeddingDocument" ed
ORDER BY ed."sourceType", title;
```

The local seed uses deterministic demo vectors named `demo-hash-embedding-v1`. The RAG context API can refresh those rows with real OpenAI embeddings when `OPENAI_API_KEY` is configured.

For later MCP/API-key work, game metadata should come from IGDB, while Steam API data should be used for Steam profile and play-history linking. GJC-164 only prepares the local DB rows and optional `DEMO_STEAM_ID`; it does not call external APIs.

## RAG Context API

The model, LangChain/FastAPI boundary, pgvector table flow, and embedding refresh policy for the RAG MVP are fixed in [`../docs/GJC-78_RAG_TECH_DECISION.md`](../docs/GJC-78_RAG_TECH_DECISION.md).

GJC-80 adds a user-scoped RAG context endpoint:

```text
GET /ai/rag/context?topK=6&refreshEmbeddings=true
```

The endpoint requires the same `access_token` cookie used by the other authenticated APIs. Clients do not send `userId`; the server resolves it from the JWT.

Response shape:

```json
{
  "userId": "00000000-0000-4000-8000-000000000001",
  "generatedAt": "2026-06-16T12:00:00.000Z",
  "preferenceTags": [
    { "label": "TACTICAL_RPG", "weight": 0.94, "sourceCount": 3 }
  ],
  "playStyleSummary": "This player leans toward tactical rpg experiences...",
  "wordCloud": [
    {
      "label": "TACTICAL RPG",
      "weight": 0.94,
      "sourceCount": 3,
      "category": "mechanic"
    }
  ],
  "contextSources": [
    {
      "sourceType": "ARCHIVE_POST",
      "sourceId": "11111111-1111-4111-8111-111111111111",
      "title": "Boss patterns feel fair when the rules are visible",
      "gameTitle": "Into the Breach",
      "excerpt": "Post type: REVIEW Game: Into the Breach...",
      "similarity": 0.82
    }
  ],
  "embedding": {
    "provider": "demo",
    "model": "demo-hash-embedding-v1",
    "dimensions": 1536,
    "refreshedDocuments": 3
  }
}
```

When FastAPI is running, RAG asks the AI compute service to generate embeddings
through `POST /embed` and to retrieve user-scoped pgvector context through
`POST /rag/search`. If `OPENAI_API_KEY` is set and a non-demo model is requested,
FastAPI uses LangChain `OpenAIEmbeddings`; otherwise it returns the deterministic
demo embedding. The retrieval endpoint uses a LangChain retriever over the
existing `EmbeddingDocument` table. If either FastAPI path is unavailable, NestJS
falls back to its existing OpenAI/demo embedding and local pgvector SQL paths so
RAG remains testable in local development. Structured JSON analysis is still
performed inside NestJS.

### FastAPI AI Compute Service

GJC-183 adds the first FastAPI split:

```text
GET http://localhost:8000/health
POST http://localhost:8000/embed
POST http://localhost:8000/rag/search
POST http://localhost:8000/agent/recommendations/plan
```

NestJS keeps authentication, data loading, pgvector persistence, MCP execution,
recommendation merging, and final response persistence. FastAPI receives only
the text/model/dimensions payload needed for embedding calculation, the
userId/queryEmbedding/topK payload needed for user-scoped context retrieval, or
the RAG context needed to produce a LangGraph MCP search plan:

```json
{
  "input": "Game journal text",
  "model": "demo-hash-embedding-v1",
  "dimensions": 1536
}
```

```json
{
  "userId": "user-id",
  "queryEmbedding": [0.1, -0.2, 0.3],
  "topK": 6
}
```

```json
{
  "userId": "user-id",
  "requestId": "manual-sync",
  "maxIterations": 4,
  "timeoutMs": 30000,
  "preferenceTags": [{ "label": "PUZZLE_SYSTEMS", "weight": 0.9, "sourceCount": 3 }],
  "contextSources": [{ "sourceType": "ARCHIVE_POST", "sourceId": "post-id", "title": "Puzzle notes", "gameTitle": "Baba Is You" }]
}
```

The local FastAPI fallback uses the same deterministic demo vector shape as the
previous NestJS-only path. OpenAI embeddings use LangChain's provider package,
and retrieval uses a LangChain `BaseRetriever` wrapper for PostgreSQL pgvector.
Run a sample comparison with:

```bash
cd server
npm run smoke:ai-compute
```

## MCP Game Metadata Tool

GJC-83 adds a minimal JSON-RPC MCP endpoint:

```text
POST /mcp
```

Tool discovery:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

Tool call:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "search_games",
    "arguments": {
      "query": "CrossCode",
      "limit": 3,
      "preferenceTags": ["RETRO_PIXEL", "STORY_DRIVEN"]
    }
  }
}
```

The `search_games` tool uses IGDB for video game metadata and returns recommendation-card fields: title, IGDB id, genres, platforms, release date, cover URL, source URL, summary, and tags.
It is the only exposed MVP MCP tool and is marked read-only through
`annotations.readOnlyHint`.

When `IGDB_CLIENT_ID` or `IGDB_CLIENT_SECRET` is missing, the tool returns `isError: true` with structured content like:

```json
{
  "provider": "igdb",
  "games": [],
  "error": "IGDB credentials are missing. Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET.",
  "errorCode": "missing_credentials"
}
```

### Live IGDB Smoke Test

After adding `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` to `server/.env`, run:

```bash
cd server
npm run smoke:mcp:igdb
```

By default, the script starts a temporary NestJS app on a random local port, calls the real `POST /mcp` JSON-RPC route, and then closes the app. To target a server that is already running, pass `MCP_SMOKE_BASE_URL`.
For a temporary local app, the script explicitly enables the non-production MCP
dev bypass if no token is configured. For an already-running server, pass
`MCP_SMOKE_INTERNAL_TOKEN` or `MCP_SMOKE_BEARER_TOKEN`.

Optional overrides:

```bash
MCP_SMOKE_BASE_URL=http://127.0.0.1:3000 MCP_SMOKE_QUERY=CrossCode MCP_SMOKE_LIMIT=3 npm run smoke:mcp:igdb
MCP_SMOKE_INTERNAL_TOKEN=<token> MCP_SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke:mcp:igdb
```

The script calls `POST /mcp` with a JSON-RPC `tools/call search_games` request and fails if `structuredContent.games` is empty. It never prints API keys.

Recorded live IGDB MCP result on `2026-06-16`:

```json
{
  "ok": true,
  "mode": "temporary-nest-app",
  "provider": "igdb",
  "query": "CrossCode",
  "resultCount": 2,
  "firstGames": ["CrossCode", "CrossCode: A New Home"]
}
```

## AI Recommendation Agent Loop

GJC-88 implements the recommendation loop, GJC-185 adds a FastAPI LangGraph
planner, and GJC-184 adds OpenAI native function calling for the first
tool-selection path:

```text
POST /ai/recommendations/sync
```

The route requires the JWT `access_token` cookie and resolves `userId` from the authenticated request. The client may pass:

```json
{
  "forceRefresh": true,
  "topK": 6
}
```

The Agent state tracks:

```ts
type AgentState = {
  maxIterations: number
  recommendations: AiRecommendationCard[]
  startedAt: number
  toolResults: AgentToolResult[]
  userId: string
}
```

Execution order:

1. Read RAG context with `RagService.analyzeForUser`.
2. If `OPENAI_API_KEY` is configured, send the MCP `search_games` schema as an OpenAI Chat Completions `tools` payload and parse `tool_calls`.
3. Reject unsupported tool names, invalid JSON arguments, empty queries, and already-recorded source game titles before any MCP execution.
4. If function calling is unavailable or invalid, ask FastAPI `POST /agent/recommendations/plan` to run a LangGraph state graph over the RAG context.
5. If FastAPI is unavailable or returns no queries, build local fallback queries from source game titles and top preference tags.
6. Call the MCP `search_games` tool through JSON-RPC.
7. Merge and de-duplicate IGDB results into recommendation cards.
8. Stop after enough recommendations, `AGENT_MAX_ITERATIONS`, or `AGENT_TIMEOUT_MS`.
9. If IGDB is unavailable, return local DB fallback recommendations so SYNC still produces a usable response.

The response pipeline includes Agent trace fields for QA: `planner`,
`selectedTool`, `toolCallCount`, `queries`, `iterations`, `maxIterations`, and
`stoppedReason`. NestJS keeps the actual MCP call, fallback, and persistence
path so the authenticated public API remains stable while Agent orchestration
moves incrementally.

## Domain Data Model

GJC-63 defines the core data model around users, games, archive posts, comments, AI profiles, recommendations, and embedding documents.

### Entities

| Entity              | Purpose                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `User`              | Authenticated user profile. Stores email, password hash, nickname, bio, profile image, gamer tags, and optional Steam id. |
| `Game`              | Game master data. Stores external ids, title, image, description, genres, platforms, and store/game tags.                 |
| `UserGame`          | Join entity between `User` and `Game` with playtime, achievement rate, and last played time.                              |
| `ArchivePost`       | Unified post table for reviews and journals. `type` is `REVIEW` or `JOURNAL`; `rating` is used only for reviews.          |
| `Comment`           | Comment table for archive posts. Supports nested replies through `parentCommentId`.                                       |
| `AiProfile`         | One AI-generated taste profile per user, including play style summary and favorite keywords/genres.                       |
| `Recommendation`    | Recommended game result for a user, including reason, score, and rank.                                                    |
| `EmbeddingDocument` | RAG source document metadata for games, archive posts, and AI profiles.                                                   |

### Relationships

```text
User 1 ── N UserGame N ── 1 Game
User 1 ── N ArchivePost N ── 1 Game
ArchivePost 1 ── N Comment
User 1 ── N Comment
Comment 1 ── N Comment replies
User 1 ── 1 AiProfile
User 1 ── N Recommendation N ── 1 Game
EmbeddingDocument sourceType/sourceId -> Game | ArchivePost | AiProfile
```

### Notes

- `ArchivePost` intentionally combines reviews and journals. `rating` is nullable and should be set only when `type = REVIEW`.
- `Comment.parentCommentId` is nullable. `null` means a top-level comment; a value means the comment is a reply.
- `EmbeddingDocument.embedding` is not mapped as a TypeORM `@Column` because this project uses PostgreSQL `pgvector`. The `PgvectorSetupService` creates the actual `vector(1536)` column and HNSW index with raw SQL after TypeORM synchronization.
- User-entered gamer tags are stored on `User.gamerTags`.
- Store/game tags from Steam are currently stored on `Game.tags` as a `text[]` array. A separate `Tag` entity is not part of the current simplified schema.

## AI Recommendation MVP Contract

GJC-163 fixes the one-day MVP contract for the AI recommendation flow. The contract type lives in `src/ai/recommendation-contract.ts` so later DB, RAG, MCP, Agent, and React work can target one response shape instead of separate mock structures.

### Jira P0 Order

| Order | Issue     | Output                                                     |
| ----- | --------- | ---------------------------------------------------------- |
| 1     | `GJC-163` | API contract and sample SYNC response                      |
| 2     | `GJC-164` | Postgres, pgvector, seed user, seed posts, seed embeddings |
| 3     | `GJC-80`  | RAG search and taste analysis response                     |
| 4     | `GJC-83`  | MCP JSON-RPC `search_games` tool using a real game API     |
| 5     | `GJC-85`  | API key, permission, and error handling strategy           |
| 6     | `GJC-88`  | Agent loop that combines RAG and MCP tool results          |
| 7     | `GJC-166` | React recommendation page wired to the SYNC API            |
| 8     | `GJC-165` | Smoke test and quickstart documentation                    |

### Vertical Flow

```text
React /recommend SYNC button
  -> POST /ai/recommendations/sync
  -> NestJS BFF validates JWT cookie and resolves userId
  -> NestJS AgentService runs the SYNC loop
  -> OpenAI native function calling selects search_games tool calls when configured
  -> FastAPI Agent planner receives { userId, requestId, contextSources, preferenceTags } as fallback
  -> LangGraph chooses MCP search_games queries with max-iteration and timeout state if OpenAI planning is unavailable
  -> RAG reads ArchivePost, Game, AiProfile, and EmbeddingDocument through Postgres pgvector
  -> MCP JSON-RPC server exposes tools/list and tools/call
  -> Agent calls search_games through MCP and normalizes tool/fallback results into final JSON
  -> NestJS returns one AiRecommendationSyncResponse to React
```

### Public NestJS API

`POST /ai/recommendations/sync`

React should call this endpoint with `withCredentials: true`. It should not send `userId`; NestJS must derive the user from the JWT cookie, the same way `PostsController` does.

Request:

```json
{
  "forceRefresh": false,
  "topK": 6
}
```

Response fields map directly to the current recommendation page:

| Field              | React section                           | Source                           |
| ------------------ | --------------------------------------- | -------------------------------- |
| `preferenceTags`   | `GAMES YOU ENJOY` tag chips             | RAG taste analysis               |
| `playStyleSummary` | Short explanation near SYNC state       | LLM synthesis                    |
| `wordCloud`        | `YOUR PLAY STYLE` word cloud            | RAG text mining and LLM cleanup  |
| `recommendations`  | `RECOMMENDED GAMES` cards               | Agent merged RAG and MCP results |
| `contextSources`   | Debug or expandable evidence list       | pgvector top-k search            |
| `pipeline`         | Demo proof that RAG, MCP, and Agent ran | Backend trace                    |

### Internal FastAPI Agent API

`POST /agent/recommendations/sync`

NestJS sends this request to FastAPI after authentication:

```json
{
  "userId": "00000000-0000-4000-8000-000000000001",
  "requestId": "gjc-demo-sync-001",
  "forceRefresh": false,
  "topK": 6
}
```

### Final SYNC Response Example

```json
{
  "requestId": "gjc-demo-sync-001",
  "userId": "00000000-0000-4000-8000-000000000001",
  "generatedAt": "2026-06-16T12:00:00.000+09:00",
  "lastSyncAt": "2026-06-16T12:00:00.000+09:00",
  "preferenceTags": [
    { "label": "TACTICAL_RPG", "weight": 0.95, "sourceCount": 4 },
    { "label": "STORY_DRIVEN", "weight": 0.91, "sourceCount": 5 },
    { "label": "RETRO_PIXEL", "weight": 0.86, "sourceCount": 3 }
  ],
  "playStyleSummary": "You favor deliberate combat, readable systems, and games where repeated failure reveals better strategy rather than pure grind.",
  "wordCloud": [
    {
      "label": "TACTICAL",
      "weight": 0.95,
      "sourceCount": 4,
      "category": "mechanic"
    },
    {
      "label": "NARRATIVE",
      "weight": 0.91,
      "sourceCount": 5,
      "category": "theme"
    }
  ],
  "recommendations": [
    {
      "rank": 1,
      "gameId": null,
      "externalId": { "provider": "steam", "id": "368340" },
      "title": "CrossCode",
      "imageUrl": "https://cdn.akamai.steamstatic.com/steam/apps/368340/header.jpg",
      "genres": ["Action RPG", "Puzzle"],
      "platforms": ["PC", "Steam"],
      "tags": ["Pixel Graphics", "Story Rich", "Action RPG"],
      "matchScore": 0.93,
      "matchedTags": ["RETRO_PIXEL", "STORY_DRIVEN", "TACTICAL_RPG"],
      "reason": "Your journals emphasize precise combat and puzzle-like encounters, which match the action RPG structure and pixel presentation of CrossCode.",
      "sourceUrl": "https://store.steampowered.com/app/368340"
    }
  ],
  "contextSources": [
    {
      "sourceType": "ARCHIVE_POST",
      "sourceId": "11111111-1111-4111-8111-111111111111",
      "title": "Boss patterns feel fair when the rules are visible",
      "gameTitle": "Into the Breach",
      "excerpt": "I enjoyed how every loss taught me a clearer tactical rule instead of asking for more grinding.",
      "similarity": 0.89
    }
  ],
  "pipeline": {
    "rag": { "topK": 6, "sourceCount": 6 },
    "mcp": {
      "toolName": "search_games",
      "provider": "igdb",
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

### Error Shape

```json
{
  "requestId": "gjc-demo-sync-001",
  "message": "AI recommendation sync failed.",
  "fallbackAvailable": true
}
```

### Implementation Notes For The Next P0 Issues

- `GJC-164` should create a deterministic seed user with id `00000000-0000-4000-8000-000000000001` and enough journal/review rows to produce the sample tags.
- `GJC-80` should return `preferenceTags`, `playStyleSummary`, `wordCloud`, and `contextSources` before game recommendation cards exist.
- `GJC-83` should expose at least `tools/list` and `tools/call` over JSON-RPC, with a `search_games` tool returning fields that can fill `AiRecommendationCard`.
- `GJC-88` should cap the agent loop with `maxIterations`, timeout handling, and a structured fallback that still returns `AiRecommendationErrorResponse`.
- `GJC-166` should remove the static `recommendationCards`, `wordCloud`, and `tasteTags` arrays from `client/src/pages/Recommend.tsx` and render this API response instead.

## Useful Commands

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Build server
npm run build
```
