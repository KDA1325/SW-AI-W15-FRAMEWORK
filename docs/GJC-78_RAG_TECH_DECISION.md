# GJC-78 RAG Technology Decision

Status: accepted for the one-day AI recommendation MVP.

This document fixes the model, library, database, API, and data-flow choices needed by `GJC-78`. It describes the current NestJS implementation and the intended FastAPI split point without blocking the MVP on a second service.

## Decisions

| Area | MVP decision | Reason |
| --- | --- | --- |
| Chat model | OpenAI `gpt-4o-mini` via `OPENAI_CHAT_MODEL` | Commercial model, already wired in `RagService`, and replaceable by env when the team wants a newer model. |
| Embedding model | OpenAI `text-embedding-3-small` via `OPENAI_EMBEDDING_MODEL` | Matches the current 1536-dimensional pgvector column and supports local fallback when the key is missing. |
| Embedding dimensions | `1536` via `OPENAI_EMBEDDING_DIMENSIONS` | Keeps `EmbeddingDocument.embedding vector(1536)` and seed/demo vectors compatible. |
| RAG runtime | NestJS `RagService` + PostgreSQL pgvector | Lowest-risk MVP path because auth, DB entities, seeding, and React API are already in the same app. |
| LangChain scope | Runtime dependency in the FastAPI AI compute service for OpenAI embedding calls; still no NestJS runtime dependency | Keeps Python AI integration inside the FastAPI split while leaving a clear future path to a LangChain `PGVector` retriever. |
| FastAPI scope | Reserved agent service behind `FASTAPI_AGENT_URL`; not required for the one-day MVP | The MVP proves RAG, MCP, and Agent end to end through NestJS. FastAPI can later own LangGraph orchestration. |
| Embedding sync | Refresh on RAG/SYNC request for MVP; background/outbox sync after MVP | Request-time refresh keeps edits visible in demos. Event-driven sync is better once write volume matters. |

## Environment Contract

```env
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1536

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
  -> pgvector top-k search with cosine distance
  -> OpenAI structured JSON analysis or rule-based fallback
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
  -> RagService refreshes/searches pgvector context
  -> AgentService calls MCP tools/call search_games
  -> McpService calls IGDB through IgdbService
  -> AgentService merges IGDB results or local DB fallback cards
  -> React renders preference tags, word cloud, cards, and pipeline trace
```

Public MVP endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /ai/rag/context?topK=6&refreshEmbeddings=true` | Inspect user-scoped RAG analysis directly. |
| `POST /mcp` | JSON-RPC MCP server with `initialize`, `tools/list`, and `tools/call`. |
| `POST /ai/recommendations/sync` | Full RAG + MCP + Agent recommendation sync used by React. |

## LangChain And FastAPI Split

The current MVP intentionally does not add LangChain to the NestJS runtime. NestJS still performs the required loader, vector query, and fallback orchestration directly against PostgreSQL. LangChain is introduced in the FastAPI AI compute service for OpenAI embedding calls.

FastAPI becomes useful when the team wants a Python-native agent service. At that point:

```text
NestJS
  -> stays responsible for auth, cookies, user-facing REST, and DB ownership boundaries
  -> calls FASTAPI_AGENT_URL with { userId, requestId, forceRefresh, topK }

FastAPI
  -> owns LangChain PGVector retriever setup
  -> owns LangGraph or equivalent state-machine orchestration
  -> calls the same MCP JSON-RPC tools
  -> returns AiRecommendationSyncResponse-compatible JSON
```

Recommended post-MVP FastAPI responsibilities:

```python
# Sketch only. Keep the response compatible with AiRecommendationSyncResponse.
retriever = PGVector(
    embeddings=openai_embeddings,
    collection_name="embedding_documents",
    connection=postgres_connection,
)

state = {
    "user_id": user_id,
    "iterations": 0,
    "recommendations": [],
    "tool_results": [],
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
