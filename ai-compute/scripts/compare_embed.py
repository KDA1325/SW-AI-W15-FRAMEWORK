from __future__ import annotations

import asyncio
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ai-compute"))

from app.embedding import DEMO_EMBEDDING_DIMENSIONS, DEMO_EMBEDDING_MODEL, create_embedding


async def main() -> None:
    sample_path = (
        ROOT
        / "docs"
        / "datasets"
        / "player-preference-igdb"
        / "by-persona"
        / "01_rpg_sim_solo.json"
    )
    records = json.loads(sample_path.read_text(encoding="utf-8"))
    sample = records[0]
    text = "\n".join(
        [
            f"Game: {sample['game_title']}",
            f"Title: {sample['title']}",
            f"Content: {sample['content']}",
            f"Keywords: {', '.join(sample['preference_keywords'])}",
        ]
    )

    result = await create_embedding(
        text,
        DEMO_EMBEDDING_MODEL,
        DEMO_EMBEDDING_DIMENSIONS,
    )

    assert result.provider == "demo"
    assert result.model == DEMO_EMBEDDING_MODEL
    assert result.dimensions == DEMO_EMBEDDING_DIMENSIONS
    assert len(result.embedding) == DEMO_EMBEDDING_DIMENSIONS
    assert all(-1 <= value <= 1 for value in result.embedding)

    print(
        json.dumps(
            {
                "ok": True,
                "sampleId": sample["id"],
                "provider": result.provider,
                "model": result.model,
                "dimensions": result.dimensions,
                "first3": result.embedding[:3],
            },
            ensure_ascii=False,
        )
    )


asyncio.run(main())
