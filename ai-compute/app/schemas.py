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
