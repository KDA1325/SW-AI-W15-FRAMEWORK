from fastapi import FastAPI

from .agent_graph import build_agent_plan
from .analysis import analyze_rag_context
from .embedding import create_embedding
from .env import load_local_env
from .recommendations import build_recommendations
from .retrieval import search_archive_context
from .schemas import (
    AgentPlanRequest,
    AgentPlanResponse,
    EmbedRequest,
    EmbedResponse,
    HealthResponse,
    RecommendationBuildRequest,
    RecommendationBuildResponse,
    RagAnalyzeRequest,
    RagAnalyzeResponse,
    RagSearchRequest,
    RagSearchResponse,
)

load_local_env()

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


@app.post("/rag/search", response_model=RagSearchResponse)
async def rag_search(request: RagSearchRequest) -> RagSearchResponse:
    return RagSearchResponse(
        provider="langchain-pgvector",
        rows=search_archive_context(
            request.userId,
            request.queryEmbedding,
            request.topK,
        ),
    )


@app.post("/rag/analyze", response_model=RagAnalyzeResponse)
async def rag_analyze(request: RagAnalyzeRequest) -> RagAnalyzeResponse:
    return analyze_rag_context(request)


@app.post("/agent/recommendations/plan", response_model=AgentPlanResponse)
async def agent_recommendation_plan(
    request: AgentPlanRequest,
) -> AgentPlanResponse:
    return build_agent_plan(request)


@app.post(
    "/agent/recommendations/build",
    response_model=RecommendationBuildResponse,
)
async def agent_recommendations_build(
    request: RecommendationBuildRequest,
) -> RecommendationBuildResponse:
    return build_recommendations(request)
