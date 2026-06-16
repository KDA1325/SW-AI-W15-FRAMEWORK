from typing import Literal

from pydantic import BaseModel, Field

from .embedding import DEMO_EMBEDDING_DIMENSIONS, DEMO_EMBEDDING_MODEL


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str


class EmbedRequest(BaseModel):
    input: str = Field(..., min_length=1)
    model: str = DEMO_EMBEDDING_MODEL
    dimensions: int = Field(DEMO_EMBEDDING_DIMENSIONS, ge=1, le=4096)


class EmbedResponse(BaseModel):
    dimensions: int
    embedding: list[float]
    model: str
    provider: Literal["demo", "openai"]
    usage: dict[str, int]


class RagSearchRequest(BaseModel):
    userId: str = Field(..., min_length=1)
    queryEmbedding: list[float] = Field(..., min_length=1)
    topK: int = Field(6, ge=1, le=12)


class RagSearchRow(BaseModel):
    sourceType: str
    sourceId: str
    content: str
    metadata: dict[str, object] = Field(default_factory=dict)
    similarity: float


class RagSearchResponse(BaseModel):
    provider: Literal["langchain-pgvector"]
    rows: list[RagSearchRow]


class AgentPreferenceTag(BaseModel):
    label: str
    weight: float = 0
    sourceCount: int = 0


class AgentContextSource(BaseModel):
    gameTitle: str | None = None
    sourceId: str
    sourceType: str
    title: str


class AgentPlanRequest(BaseModel):
    contextSources: list[AgentContextSource] = Field(default_factory=list)
    maxIterations: int = Field(4, ge=1, le=12)
    preferenceTags: list[AgentPreferenceTag] = Field(default_factory=list)
    requestId: str
    timeoutMs: int = Field(30000, ge=1000, le=120000)
    userId: str = Field(..., min_length=1)


class AgentToolPlan(BaseModel):
    arguments: dict[str, object]
    name: Literal["search_games"]


class AgentPlanResponse(BaseModel):
    errors: list[str]
    iterations: int
    maxIterations: int
    provider: Literal["langgraph"]
    searchQueries: list[str]
    stoppedReason: Literal["completed", "max_iterations", "timeout"]
    toolPlan: list[AgentToolPlan]
