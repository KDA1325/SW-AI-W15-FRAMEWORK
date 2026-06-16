# GJC-78 RAG Technology Decision

Status: accepted for the one-day AI recommendation MVP.

This document fixes the model, library, database, API, and data-flow choices needed by `GJC-78`. It describes the current NestJS implementation and the intended FastAPI split point without blocking the MVP on a second service.

## Decisions

| Area | MVP decision | Reason |
| --- | --- | --- |
| Chat model | OpenAI `gpt-4o-mini` via `OPENAI_CHAT_MODEL` | Commercial model, already wired in `RagService`, and replaceable by env when the team wants a newer model. |
| Embedding model | OpenAI `text-embedding-3-small` via `OPENAI_EMBEDDING_MODEL` | Matches the current 1536-dimensional pgvector column and supports local fallback when the key is missing. |
| Embedding dimensions | `1536` via `OPENAI_EMBEDDING_DIMENSIONS` | Keeps `EmbeddingDocument.embedding vector(1536)` and seed/demo vectors compatible. |
| RAG runtime | NestJS `RagService` + PostgreSQL pgvector + FastAPI LangChain retriever | NestJS keeps auth and DB ownership while FastAPI can run Python-native retrieval when available. |
| LangChain scope | Runtime dependency in the FastAPI AI compute service for OpenAI embedding calls and pgvector retrieval | Keeps Python AI integration inside the FastAPI split without adding LangChain to the NestJS runtime. |
| FastAPI scope | AI compute service for embeddings, LangChain pgvector retrieval, and LangGraph Agent planning behind `FASTAPI_AI_COMPUTE_URL`/`FASTAPI_AGENT_URL` | FastAPI owns Python-native AI orchestration pieces while NestJS keeps auth, MCP execution, persistence, and public API boundaries. |
| Embedding sync | Refresh on RAG/SYNC request for MVP; background/outbox sync after MVP | Request-time refresh keeps edits visible in demos. Event-driven sync is better once write volume matters. |

## Environment Contract

```env
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536
FASTAPI_AI_COMPUTE_URL=http://localhost:8000
FASTAPI_AI_COMPUTE_TIMEOUT_MS=5000
PGVECTOR_CONNECTION_STRING=postgresql://game_archive_user:game_archive_password@postgres:5432/game_archive

AGENT_MAX_ITERATIONS=4
AGENT_TIMEOUT_MS=30000
FASTAPI_AGENT_URL=http://localhost:8000
FASTAPI_AGENT_TIMEOUT_MS=30000
```

Missing `OPENAI_API_KEY` is not fatal. The server uses `demo-hash-embedding-v1` and deterministic rule-based analysis so the local MVP remains testable without paid credentials.

## Data Model

The RAG path depends on these existing tables:

| Table | RAG role |
| --- | --- |
| `User` | Owns journals, reviews, Steam profile link, and recommendation state. |
| `Game` | Provides title, genres, platforms, tags, Steam ids, and optional IGDB ids. |
| `UserGame` | Stores playtime and achievement signals for later recommendation enrichment. |
| `ArchivePost` | Main user-authored journal/review source for embeddings. |
| `AiProfile` | Stores synthesized taste profile fields such as summary and favorite keywords. |
| `EmbeddingDocument` | Stores source text, source metadata, and the pgvector embedding column. |
| `Recommendation` | Stores persisted recommendation results when the MVP needs saved history. |

`EmbeddingDocument.embedding` is created by bootstrap SQL because TypeORM does not model the pgvector column in this project:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "EmbeddingDocument"
ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

CREATE INDEX IF NOT EXISTS "IDX_EmbeddingDocument_embedding_hnsw"
ON "EmbeddingDocument"
USING hnsw ("embedding" vector_cosine_ops);
```

If `OPENAI_EMBEDDING_DIMENSIONS` changes, the vector column, HNSW index, seed vectors, and all stored embeddings must be migrated together.

## MVP RAG Flow

```text
Demo seed or user-authored ArchivePost rows
  -> build archive/profile/game text documents
  -> create OpenAI embedding or deterministic demo embedding
  -> upsert EmbeddingDocument metadata
  -> write vector(1536) with raw SQL
  -> build one user preference query from journals/reviews
  -> FastAPI /rag/search LangChain retriever over pgvector
  -> fallback to NestJS pgvector top-k SQL with cosine distance if FastAPI is unavailable
  -> OpenAI structured JSON analysis or rule-based fallback
  -> FastAPI /agent/recommendations/plan LangGraph planner chooses MCP search queries
  -> fallback to NestJS local query planning if FastAPI Agent planning is unavailable
  -> preferenceTags + playStyleSummary + wordCloud + contextSources
```

The current top-k query is user-scoped through `ArchivePost.userId`:

```sql
SELECT
  ed."sourceType",
  ed."sourceId",
  ed.content,
  ed.metadata,
  1 - (ed.embedding <=> $1::vector) AS similarity
FROM "EmbeddingDocument" ed
INNER JOIN "ArchivePost" post
  ON ed."sourceType" = 'ARCHIVE_POST'
  AND ed."sourceId" = post.id
WHERE post."userId" = $2
  AND ed.embedding IS NOT NULL
ORDER BY ed.embedding <=> $1::vector ASC
LIMIT $3;
```

## API Flow

```text
React /recommend SYNC_DATA
  -> POST /ai/recommendations/sync
  -> JwtAuthGuard resolves userId from access_token
  -> AgentService calls RagService.analyzeForUser()
  -> RagService refreshes embeddings and prefers FastAPI /rag/search for context retrieval
  -> AgentService asks FastAPI /agent/recommendations/plan for LangGraph tool planning
  -> AgentService calls MCP tools/call search_games
  -> McpService calls IGDB through IgdbService
  -> AgentService merges IGDB results or local DB fallback cards
  -> React renders preference tags, word cloud, cards, and pipeline trace
```

Public MVP endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /ai/rag/context?topK=6&refreshEmbeddings=true` | Inspect user-scoped RAG analysis directly. |
| `POST /embed` on FastAPI | Generate OpenAI/LangChain or deterministic demo embeddings. |
| `POST /rag/search` on FastAPI | Retrieve user-scoped archive context with a LangChain retriever over pgvector. |
| `POST /agent/recommendations/plan` on FastAPI | Run a LangGraph state graph that plans bounded MCP `search_games` queries from RAG context. |
| `POST /mcp` | JSON-RPC MCP server with `initialize`, `tools/list`, and `tools/call`. |
| `POST /ai/recommendations/sync` | Full RAG + MCP + Agent recommendation sync used by React. |

## LangChain And FastAPI Split

The current MVP intentionally does not add LangChain to the NestJS runtime.
NestJS still performs the required data loading, embedding refresh, and fallback
orchestration directly against PostgreSQL. LangChain is introduced in the
FastAPI AI compute service for OpenAI embedding calls and a `BaseRetriever`
implementation that queries the existing `EmbeddingDocument` pgvector table.
The dedicated LangChain `PGVector` vector store uses its own collection schema,
so this project keeps the TypeORM-owned table and exposes a compatible
LangChain retriever wrapper instead of migrating stored documents.

FastAPI now also hosts the first Python-native Agent orchestration step:

```text
NestJS
  -> stays responsible for auth, cookies, user-facing REST, and DB ownership boundaries
  -> calls FASTAPI_AGENT_URL with { userId, requestId, contextSources, preferenceTags, maxIterations, timeoutMs }
  -> executes MCP JSON-RPC tools and persists the final recommendation snapshot

FastAPI
  -> owns LangChain PGVector retriever setup
  -> owns LangGraph state-machine planning
  -> returns planned `search_games` tool arguments and stop metadata
```

The current LangGraph planner keeps the same state guard concepts as the NestJS
loop: request id, user id, context titles, preference tags, tool results,
iterations, max iterations, timeout, and stopped reason. It plans MCP tool calls
without executing external services, so API keys and authorization stay in the
NestJS/MCP layer.

```python
state = {
    "user_id": user_id,
    "iterations": 0,
    "search_queries": [],
    "tool_results": [],
    "max_iterations": 4,
    "timeout_ms": 30000,
}
```

## Embedding Sync Policy

MVP policy:

```text
ArchivePost create/update/delete
  -> no immediate background job
  -> next GET /ai/rag/context or POST /ai/recommendations/sync refreshes archive embeddings
```

Post-MVP policy:

```text
ArchivePost transaction commits
  -> write EmbeddingRefreshJob or outbox row
  -> worker creates embedding
  -> worker upserts EmbeddingDocument
  -> worker marks failed jobs with retry metadata
```

This keeps today's demo simple while documenting the production-safe direction.

## External References

- OpenAI embeddings API: https://developers.openai.com/api/reference/resources/embeddings/methods/create
- OpenAI `gpt-4o-mini` model page: https://platform.openai.com/docs/models/gpt-4o-mini
- LangChain PGVector integration: https://docs.langchain.com/oss/python/integrations/vectorstores/pgvector
- LangGraph overview: https://docs.langchain.com/oss/python/langgraph/overview
