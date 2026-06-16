from fastapi import FastAPI

from .embedding import create_embedding
from .schemas import EmbedRequest, EmbedResponse, HealthResponse

app = FastAPI(
    title="GJC AI Compute Service",
    version="0.1.0",
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="ai-compute")


@app.post("/embed", response_model=EmbedResponse)
async def embed(request: EmbedRequest) -> EmbedResponse:
    result = await create_embedding(
        request.input,
        request.model,
        request.dimensions,
    )
    return EmbedResponse(
        dimensions=result.dimensions,
        embedding=result.embedding,
        model=result.model,
        provider=result.provider,
        usage={"inputCharacters": len(request.input)},
    )
