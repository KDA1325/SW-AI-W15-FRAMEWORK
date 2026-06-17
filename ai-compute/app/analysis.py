import json
from typing import Literal

from .korean import contains_hangul, to_korean_analysis_label
from .openai_client import request_openai_json
from .schemas import (
    AgentPreferenceTag,
    AiWordCloudTerm,
    RagAnalyzeRequest,
    RagAnalyzeResponse,
    RagAnalysisContextRow,
)


WordCloudCategory = Literal["genre", "mood", "mechanic", "pace", "theme"]


GAME_ELEMENT_CANDIDATES: list[tuple[WordCloudCategory, str, list[str]]] = [
    ("mechanic", "TACTICAL_COMBAT", ["tactical", "turn-based", "strategy", "planning", "전술", "턴제", "전략", "계획"]),
    ("theme", "STORY_DRIVEN", ["story", "narrative", "dialogue", "worldbuilding", "choices", "스토리", "서사", "대화", "세계관", "선택"]),
    ("mood", "PIXEL_ART", ["pixel", "retro", "screen language", "readable", "픽셀", "레트로"]),
    ("mechanic", "PUZZLE_SYSTEMS", ["puzzle", "rules", "systems", "logic", "deduction", "퍼즐", "규칙", "논리", "추리"]),
    ("mechanic", "CRAFTING", ["crafting", "craft", "item synthesis", "gear", "equipment", "제작", "장비", "강화", "아이템"]),
    ("mechanic", "COLLECTION", ["collection", "collect", "unlock", "catalog", "items", "수집", "해금", "도감"]),
    ("mood", "COZY_SIM", ["cozy", "relaxed", "life sim", "farming", "routine", "편안", "느긋", "생활", "농사", "루틴"]),
    ("theme", "HORROR_ATMOSPHERE", ["horror", "dread", "survival horror", "limited resources", "공포", "긴장", "생존", "자원"]),
    ("mood", "AESTHETIC_PRESENTATION", ["art", "music", "atmosphere", "visual", "beautiful", "아트", "음악", "분위기", "비주얼"]),
    ("mechanic", "DEDUCTION", ["deduction", "mystery", "clue", "case", "observation", "추리", "단서", "사건", "관찰"]),
    ("mechanic", "SPATIAL_REASONING", ["spatial", "space", "position", "perspective", "portal", "공간", "위치", "시점"]),
    ("mechanic", "OPTIMIZATION", ["optimization", "efficient", "factory", "machine", "automation", "최적화", "효율", "공장", "자동화"]),
    ("theme", "EUREKA_MOMENTS", ["eureka", "solution", "aha", "discover", "secret", "깨달음", "해답", "발견", "비밀"]),
]

PLAY_STYLE_CANDIDATES: list[tuple[WordCloudCategory, str, list[str]]] = [
    ("pace", "DELIBERATE_PLANNER", ["planning", "strategy", "turn-based", "deliberate", "focus", "계획", "집중", "전략"]),
    ("mechanic", "SYSTEM_OPTIMIZER", ["optimization", "efficient", "factory", "automation", "systems", "최적화", "효율", "자동화"]),
    ("mechanic", "FARMING_LOOP", ["farming", "grind", "routine", "harvest", "repeat", "파밍", "반복", "수확", "루틴"]),
    ("mechanic", "HUNTING_LOOP", ["hunt", "boss", "monster", "pattern", "gear progression", "사냥", "보스", "몬스터", "패턴", "장비 성장"]),
    ("theme", "NARRATIVE_ROLEPLAYER", ["roleplay", "choice", "story", "social link", "quest", "역할", "선택", "스토리", "퀘스트"]),
    ("mood", "AESTHETIC_EXPLORER", ["art", "atmosphere", "music", "world", "exploration", "아트", "분위기", "음악", "탐험"]),
    ("mechanic", "COLLECTION_COMPLETIONIST", ["collection", "collect", "unlock", "catalog", "achievement", "수집", "해금", "업적"]),
    ("pace", "LOW_PRESSURE_ROUTINE", ["relaxed", "cozy", "low pressure", "calm", "routine", "편안", "느긋", "차분", "루틴"]),
    ("mechanic", "SOLO_PROBLEM_SOLVER", ["solo", "single player", "puzzle", "deduction", "logic", "솔로", "혼자", "퍼즐", "추리", "논리"]),
    ("mechanic", "COOP_TEAMPLAYER", ["co-op", "coop", "team", "voice", "multiplayer", "협동", "팀", "멀티", "보이스"]),
    ("mechanic", "TANK_ROLE", ["tank", "defense", "shield", "frontline", "aggro", "탱커", "방어", "방패", "전열", "어그로"]),
]


def analyze_rag_context(request: RagAnalyzeRequest) -> RagAnalyzeResponse:
    fallback = create_fallback_analysis(request.contextRows)
    openai_analysis = create_openai_analysis(request, fallback)

    if openai_analysis is not None:
        return RagAnalyzeResponse(provider="openai", **openai_analysis)

    return RagAnalyzeResponse(provider="deterministic", **fallback)


def create_openai_analysis(
    request: RagAnalyzeRequest,
    fallback: dict[str, object],
) -> dict[str, object] | None:
    if not request.contextRows:
        return None

    result = request_openai_json(
        schema=analysis_json_schema(),
        schema_name="gjc_rag_korean_taste_analysis",
        system_prompt=(
            "당신은 게임 리뷰, 저널, 플레이 기록을 분석해 추천용 RAG 컨텍스트를 정리합니다. "
            "반드시 JSON만 반환합니다. playStyleSummary는 자연스러운 한국어 존댓말 한 문장으로 작성하고, "
            "영어 문장이나 반말을 절대 쓰지 마세요. preferenceTags.label은 추천 검색과 매칭에 쓰이므로 "
            "짧은 UPPER_SNAKE_CASE 영어 코드로 유지하고, wordCloud.label은 화면 표시용 한국어 명사구로 작성하세요."
        ),
        user_content=json.dumps(
            {
                "instruction": (
                    "ARCHIVE_PROFILE_DIGEST가 있으면 전체 사용자 기록 요약으로 우선 참고하세요. "
                    "preferenceTags는 장르, 테마, 메커닉, 표현 방식 같은 게임 요소를 뽑고, "
                    "wordCloud는 플레이 속도, 행동 패턴, 역할, 동기, 사회적 플레이 방식처럼 사용자 행동 성향을 뽑으세요."
                ),
                "sources": [context_row_to_prompt(row) for row in request.contextRows],
                "userId": request.userId,
            },
            ensure_ascii=False,
        ),
        timeout_seconds=20,
    )

    if result is None:
        return None

    return normalize_analysis(result, fallback)


def create_fallback_analysis(rows: list[RagAnalysisContextRow]) -> dict[str, object]:
    game_elements = score_candidates(rows, GAME_ELEMENT_CANDIDATES)
    play_styles = score_candidates(rows, PLAY_STYLE_CANDIDATES)

    if not game_elements:
        game_elements = [
            {
                "category": "theme",
                "label": "GAME_ELEMENTS",
                "sourceCount": max(1, len(rows)),
                "weight": 0.6,
            },
        ]

    if not play_styles:
        play_styles = [
            {
                "category": "pace",
                "label": "ARCHIVE_BASED_PLAYER",
                "sourceCount": max(1, len(rows)),
                "weight": 0.6,
            },
        ]

    preference_tags = [
        AgentPreferenceTag(
            label=str(item["label"]),
            sourceCount=int(item["sourceCount"]),
            weight=float(item["weight"]),
        )
        for item in game_elements[:14]
    ]
    preference_labels = {tag.label for tag in preference_tags}
    word_cloud = [
        AiWordCloudTerm(
            category=item["category"],
            label=to_korean_analysis_label(str(item["label"])),
            sourceCount=int(item["sourceCount"]),
            weight=float(item["weight"]),
        )
        for item in play_styles
        if str(item["label"]) not in preference_labels
    ][:18]

    return {
        "playStyleSummary": fallback_summary(word_cloud),
        "preferenceTags": preference_tags,
        "wordCloud": word_cloud,
    }


def score_candidates(
    rows: list[RagAnalysisContextRow],
    candidates: list[tuple[WordCloudCategory, str, list[str]]],
) -> list[dict[str, object]]:
    scored: list[dict[str, object]] = []

    for category, label, terms in candidates:
        source_count = sum(
            1
            for row in rows
            if any(term.lower() in searchable_text(row) for term in terms)
        )

        if source_count <= 0:
            continue

        scored.append(
            {
                "category": category,
                "label": label,
                "sourceCount": source_count,
                "weight": round(min(0.98, 0.55 + source_count * 0.13), 2),
            },
        )

    return sorted(scored, key=lambda item: float(item["weight"]), reverse=True)


def searchable_text(row: RagAnalysisContextRow) -> str:
    metadata_values = " ".join(str(value) for value in row.metadata.values())
    return f"{row.content} {metadata_values}".lower()


def context_row_to_prompt(row: RagAnalysisContextRow) -> dict[str, object]:
    return {
        "content": row.content[:1800],
        "gameTitle": row.metadata.get("gameTitle"),
        "similarity": row.similarity,
        "sourceId": row.sourceId,
        "sourceType": row.sourceType,
        "title": row.metadata.get("title"),
    }


def normalize_analysis(
    raw: dict[str, object],
    fallback: dict[str, object],
) -> dict[str, object] | None:
    preference_tags = normalize_preference_tags(raw.get("preferenceTags"))
    word_cloud = normalize_word_cloud(raw.get("wordCloud"), preference_tags)
    play_style_summary = raw.get("playStyleSummary")

    if not isinstance(play_style_summary, str) or not contains_hangul(play_style_summary):
        play_style_summary = str(fallback["playStyleSummary"])

    if not preference_tags:
        preference_tags = fallback["preferenceTags"]

    if not word_cloud:
        word_cloud = fallback["wordCloud"]

    return {
        "playStyleSummary": play_style_summary.strip(),
        "preferenceTags": preference_tags,
        "wordCloud": word_cloud,
    }


def normalize_preference_tags(value: object) -> list[AgentPreferenceTag]:
    if not isinstance(value, list):
        return []

    tags: list[AgentPreferenceTag] = []
    for item in value[:14]:
        if not isinstance(item, dict):
            continue

        label = item.get("label")
        if not isinstance(label, str) or not label.strip():
            continue

        tags.append(
            AgentPreferenceTag(
                label=label.strip().replace(" ", "_").upper(),
                sourceCount=to_int(item.get("sourceCount"), 1),
                weight=to_weight(item.get("weight")),
            ),
        )

    return tags


def normalize_word_cloud(
    value: object,
    preference_tags: list[AgentPreferenceTag],
) -> list[AiWordCloudTerm]:
    if not isinstance(value, list):
        return []

    preference_labels = {tag.label.strip().replace(" ", "_").upper() for tag in preference_tags}
    terms: list[AiWordCloudTerm] = []
    allowed_categories = {"genre", "mood", "mechanic", "pace", "theme"}

    for item in value[:18]:
        if not isinstance(item, dict):
            continue

        label = item.get("label")
        category = item.get("category")
        if (
            not isinstance(label, str)
            or not label.strip()
            or not isinstance(category, str)
            or category not in allowed_categories
        ):
            continue

        normalized_label = label.strip()
        if normalized_label.replace(" ", "_").upper() in preference_labels:
            continue

        terms.append(
            AiWordCloudTerm(
                category=category,
                label=to_korean_analysis_label(normalized_label),
                sourceCount=to_int(item.get("sourceCount"), 1),
                weight=to_weight(item.get("weight")),
            ),
        )

    return terms


def fallback_summary(styles: list[AiWordCloudTerm]) -> str:
    labels = [term.label for term in styles[:3] if term.label.strip()]

    if not labels:
        return "아직 분석할 기록이 충분하지 않아 기본적인 플레이 기록을 중심으로 추천을 준비합니다."

    return (
        f"기록을 보면 {', '.join(labels)} 성향이 두드러지며, "
        "추천은 선호 게임 요소와 플레이 패턴을 함께 반영합니다."
    )


def to_int(value: object, fallback: int) -> int:
    return int(value) if isinstance(value, (int, float)) else fallback


def to_weight(value: object) -> float:
    if isinstance(value, (int, float)):
        return round(max(0.0, min(1.0, float(value))), 2)
    return 0.6


def analysis_json_schema() -> dict[str, object]:
    return {
        "additionalProperties": False,
        "properties": {
            "playStyleSummary": {"type": "string"},
            "preferenceTags": {
                "items": {
                    "additionalProperties": False,
                    "properties": {
                        "label": {"type": "string"},
                        "sourceCount": {"type": "number"},
                        "weight": {"type": "number"},
                    },
                    "required": ["label", "weight", "sourceCount"],
                    "type": "object",
                },
                "maxItems": 14,
                "type": "array",
            },
            "wordCloud": {
                "items": {
                    "additionalProperties": False,
                    "properties": {
                        "category": {
                            "enum": ["genre", "mood", "mechanic", "pace", "theme"],
                            "type": "string",
                        },
                        "label": {"type": "string"},
                        "sourceCount": {"type": "number"},
                        "weight": {"type": "number"},
                    },
                    "required": ["label", "weight", "sourceCount", "category"],
                    "type": "object",
                },
                "maxItems": 18,
                "type": "array",
            },
        },
        "required": ["preferenceTags", "playStyleSummary", "wordCloud"],
        "type": "object",
    }
