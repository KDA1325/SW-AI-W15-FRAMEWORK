# GJC AI Compute Service

FastAPI microservice for compute-heavy AI work. NestJS remains the main backend
for auth, authorization, data loading, persistence, and API orchestration.

## Endpoints

```text
GET /health
POST /embed
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

## Run Locally

```bash
cd ai-compute
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

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
