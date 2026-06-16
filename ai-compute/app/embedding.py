import os
from dataclasses import dataclass

import httpx

DEMO_EMBEDDING_DIMENSIONS = 1536
DEMO_EMBEDDING_MODEL = "demo-hash-embedding-v1"
MAX_EMBEDDING_INPUT_CHARS = 12000


@dataclass(frozen=True)
class EmbeddingResult:
    dimensions: int
    embedding: list[float]
    model: str
    provider: str


def build_demo_embedding(
    seed_text: str,
    dimensions: int = DEMO_EMBEDDING_DIMENSIONS,
) -> list[float]:
    hash_value = 2166136261

    for char in seed_text:
        hash_value ^= ord(char)
        hash_value = (hash_value * 16777619) & 0xFFFFFFFF

    values: list[float] = []
    for index in range(dimensions):
        hash_value ^= index + 1
        hash_value = (hash_value * 16777619) & 0xFFFFFFFF
        normalized = hash_value / 4294967295
        values.append(round(normalized * 2 - 1, 6))

    return values


def truncate_embedding_input(text: str) -> str:
    normalized = " ".join(text.split())
    return normalized[:MAX_EMBEDDING_INPUT_CHARS]


async def create_embedding(
    text: str,
    model: str | None,
    dimensions: int | None,
) -> EmbeddingResult:
    requested_model = model or os.getenv("OPENAI_EMBEDDING_MODEL") or DEMO_EMBEDDING_MODEL
    requested_dimensions = dimensions or int(
        os.getenv("OPENAI_EMBEDDING_DIMENSIONS") or DEMO_EMBEDDING_DIMENSIONS
    )

    if requested_model != DEMO_EMBEDDING_MODEL and os.getenv("OPENAI_API_KEY"):
        openai_result = await create_openai_embedding(
            truncate_embedding_input(text),
            requested_model,
            requested_dimensions,
        )
        if openai_result is not None:
            return openai_result

    values = build_demo_embedding(text, requested_dimensions)
    return EmbeddingResult(
        dimensions=len(values),
        embedding=values,
        model=DEMO_EMBEDDING_MODEL,
        provider="demo",
    )


async def create_openai_embedding(
    text: str,
    model: str,
    dimensions: int,
) -> EmbeddingResult | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    payload: dict[str, object] = {
        "encoding_format": "float",
        "input": text,
        "model": model,
    }

    if model.startswith("text-embedding-3"):
        payload["dimensions"] = dimensions

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()

        body = response.json()
        values = body.get("data", [{}])[0].get("embedding")
        if not isinstance(values, list) or not values:
            return None

        return EmbeddingResult(
            dimensions=len(values),
            embedding=[float(value) for value in values],
            model=str(body.get("model") or model),
            provider="openai",
        )
    except httpx.HTTPError:
        return None
