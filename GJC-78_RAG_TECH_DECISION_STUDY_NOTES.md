# GJC-78 RAG Tech Decision Study Notes

## What This Task Decided

`GJC-78` was a planning/support issue, so the output is a decision document rather than new runtime code. The important result is that the team now has one fixed MVP path for RAG:

```text
OpenAI text-embedding-3-small
  -> PostgreSQL pgvector vector(1536)
  -> NestJS RagService
  -> NestJS AgentService
  -> MCP search_games tool
  -> React SYNC_DATA UI
```

FastAPI and LangChain are still part of the architecture, but they are not required to finish the one-day MVP. They are reserved for the later agent-service split.

## Key Code Contract 1: Environment Values

The selected model choices are controlled by environment variables, so the implementation can swap models without changing the React or API response shape.

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

Study point: `OPENAI_EMBEDDING_DIMENSIONS` and `EmbeddingDocument.embedding vector(1536)` must stay aligned. If one changes, the database column, index, seed vectors, and stored vectors all need a migration.

## Key Code Contract 2: pgvector Setup

The project creates the pgvector column with SQL during NestJS bootstrap:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "EmbeddingDocument"
ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

CREATE INDEX IF NOT EXISTS "IDX_EmbeddingDocument_embedding_hnsw"
ON "EmbeddingDocument"
USING hnsw ("embedding" vector_cosine_ops);
```

Study point: TypeORM owns the ordinary metadata columns, while raw SQL owns the actual vector column. This is why `EmbeddingDocument` can be saved with a repository first, then updated with:

```ts
await this.dataSource.query(
  `
    UPDATE "EmbeddingDocument"
    SET "embedding" = $1::vector
    WHERE "id" = $2
  `,
  [toPgVectorLiteral(embedding.values), savedDocument.id],
);
```

## Key Code Contract 3: Request-Time Embedding Refresh

The MVP refresh policy is simple: when RAG or SYNC is requested, archive posts can be re-embedded before search.

```ts
const posts = await this.loadUserArchivePosts(userId);
const refreshedDocuments =
  options.refreshEmbeddings === false
    ? 0
    : await this.refreshArchiveEmbeddings(posts);

const queryText = this.buildPreferenceQuery(posts);
const queryEmbedding = await this.createEmbedding(queryText);
const searchRows = await this.searchContextRows(
  userId,
  queryEmbedding.values,
  topK,
);
```

Study point: this is good for a demo because edits become visible on the next SYNC. For production, a background job or outbox is better because users should not wait for every embedding refresh during a page action.

## Key Code Contract 4: User-Scoped Vector Search

The top-k query searches only documents connected to the authenticated user's posts:

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

Study point: the `<=>` operator is cosine distance for this index. Smaller distance is better, so the query orders ascending and reports `1 - distance` as a friendlier similarity value.

## Key Code Contract 5: Agent API Flow

The React recommendation button should continue using one endpoint:

```text
POST /ai/recommendations/sync
```

The backend flow is:

```text
JwtAuthGuard
  -> AgentService.syncRecommendations(userId)
  -> RagService.analyzeForUser(userId)
  -> McpService tools/call search_games
  -> IGDB results or local fallback recommendations
  -> AiRecommendationSyncResponse
```

Study point: this keeps `userId` out of the public request body. The server derives it from the authenticated cookie and passes it through internal services.

## Why LangChain Belongs In FastAPI, Not NestJS

The current NestJS code already covers the orchestration pieces:

```text
document assembly
pgvector similarity search
structured JSON analysis
MCP tool calling
agent loop guards
fallback recommendations
```

Adding LangChain inside NestJS would mostly duplicate those pieces. The current split keeps NestJS as the BFF/auth/API layer and puts Python-native AI libraries in FastAPI:

```text
NestJS BFF/auth/API
  -> FastAPI AI compute service
  -> LangChain OpenAIEmbeddings for embedding calls
  -> future LangChain PGVector retriever
  -> future LangGraph-style state loop
  -> MCP JSON-RPC tools
```

That split is useful after the demo when the team needs richer agent orchestration, retries, tracing, and Python-native AI libraries without moving auth, persistence, or API ownership out of NestJS.

## Files Updated

- `docs/GJC-78_RAG_TECH_DECISION.md`
- `README.md`
- `server/README.md`
- `GJC-78_RAG_TECH_DECISION_STUDY_NOTES.md`

## Verification

This was a documentation-only task. The verification command was:

```bash
git diff --check
```

Expected result:

```text
no whitespace errors
```
