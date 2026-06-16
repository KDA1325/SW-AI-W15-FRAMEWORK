# GJC AI Compute Service

FastAPI microservice for compute-heavy AI work. NestJS remains the main backend
for auth, authorization, data loading, persistence, and API orchestration.

## Endpoints

```text
GET /health
POST /embed
POST /rag/search
```

`POST /embed` accepts:

```json
{
  "input": "text to embed",
  "model": "demo-hash-embedding-v1",
  "dimensions": 1536
}
```

The local fallback returns deterministic vectors compatible with the NestJS demo
embedding algorithm. If `OPENAI_API_KEY` is set and a non-demo model is
requested, the service calls OpenAI embeddings through LangChain's
`OpenAIEmbeddings` provider.

`POST /rag/search` accepts the current user's id, a query embedding, and topK,
then uses a LangChain `BaseRetriever` over the existing PostgreSQL pgvector
`EmbeddingDocument` table. NestJS still owns auth and embedding refresh, and it
falls back to its original SQL retriever if this FastAPI path is unavailable.

```json
{
  "userId": "user-id",
  "queryEmbedding": [0.1, -0.2, 0.3],
  "topK": 6
}
```

## Run Locally

```bash
cd ai-compute
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

For local RAG retrieval outside Docker, set either `PGVECTOR_CONNECTION_STRING`
or the individual `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`,
`DATABASE_PASSWORD`, and `DATABASE_NAME` variables. Docker Compose sets
`PGVECTOR_CONNECTION_STRING` to the `postgres` service automatically.

On macOS/Linux, activate with:

```bash
source .venv/bin/activate
```

## Smoke Compare

This compares a sample record from `docs/datasets/player-preference-igdb` with
the expected deterministic embedding shape.

```bash
cd ai-compute
python scripts/compare_embed.py
```
