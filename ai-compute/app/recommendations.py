import json
import re

from .korean import contains_hangul, to_korean_analysis_label, unique_non_empty
from .openai_client import request_openai_json
from .schemas import (
    RecommendationBuildRequest,
    RecommendationBuildResponse,
    RecommendationCard,
    RecommendationGame,
    RecommendationLocalGame,
)


MAX_RECOMMENDATIONS_PER_SERIES = 1


def build_recommendations(
    request: RecommendationBuildRequest,
) -> RecommendationBuildResponse:
    recommendations: list[RecommendationCard] = []
    exclusion_titles = {normalize_title(title) for title in request.exclusionSet.titles}
    exclusion_external_ids = set(request.exclusionSet.externalIds)
    exclusion_game_ids = set(request.exclusionSet.gameIds)
    matched_tags = [tag.label for tag in request.preferenceTags[:4]]

    for tool_result in request.toolResults:
        for game in tool_result.games:
            if len(recommendations) >= request.maxRecommendations:
                break

            if not is_recommendation_candidate(
                game,
                tool_result.query,
                exclusion_titles,
                exclusion_external_ids,
            ):
                continue

            rank = len(recommendations) + 1
            candidate_tags = tags_supported_by_candidate(matched_tags, game)
            recommendations.append(
                RecommendationCard(
                    externalId=game.externalId,
                    gameId=None,
                    genres=game.genres,
                    imageUrl=game.imageUrl,
                    matchedTags=candidate_tags,
                    matchScore=round(max(0.72, 0.94 - (rank - 1) * 0.04), 2),
                    platforms=game.platforms,
                    rank=rank,
                    reason=simple_recommendation_reason(
                        game.title,
                        candidate_tags,
                        request,
                    ),
                    sourceUrl=game.sourceUrl,
                    tags=game.tags,
                    title=game.title,
                ),
            )

        recommendations = unique_recommendations(recommendations)

    used_fallback = len(recommendations) < request.maxRecommendations
    if used_fallback:
        for local_game in request.localGames:
            if len(recommendations) >= request.maxRecommendations:
                break

            if is_excluded_local_game(
                local_game,
                exclusion_titles,
                exclusion_external_ids,
                exclusion_game_ids,
            ):
                continue

            rank = len(recommendations) + 1
            candidate_tags = tags_supported_by_candidate(matched_tags, local_game)
            recommendations.append(
                RecommendationCard(
                    externalId={
                        "id": local_game.steamAppId or local_game.id,
                        "provider": "steam" if local_game.steamAppId else "igdb",
                    },
                    gameId=local_game.id,
                    genres=local_game.genres,
                    imageUrl=local_game.imageUrl,
                    matchedTags=candidate_tags,
                    matchScore=round(
                        min(
                            0.92,
                            max(
                                0.68,
                                0.7 + float(local_game.signalScore) * 0.04 - (rank - 1) * 0.02,
                            ),
                        ),
                        2,
                    ),
                    platforms=local_game.platforms,
                    rank=rank,
                    reason=simple_recommendation_reason(
                        local_game.title,
                        candidate_tags,
                        request,
                    ),
                    sourceUrl=(
                        f"https://store.steampowered.com/app/{local_game.steamAppId}"
                        if local_game.steamAppId
                        else None
                    ),
                    tags=local_game.tags,
                    title=local_game.title,
                ),
            )

            recommendations = unique_recommendations(recommendations)

    ranked = [
        recommendation.model_copy(update={"rank": index + 1})
        for index, recommendation in enumerate(
            unique_recommendations(recommendations)[: request.maxRecommendations],
        )
    ]
    ranked = refine_recommendation_reasons(ranked, request)
    if ranked is None:
        raise RuntimeError("Korean recommendation reason generation failed.")

    return RecommendationBuildResponse(
        provider="fastapi-python",
        recommendations=ranked,
        usedFallback=used_fallback,
    )


def is_recommendation_candidate(
    game: RecommendationGame,
    query: str,
    exclusion_titles: set[str],
    exclusion_external_ids: set[str],
) -> bool:
    external_key = f"{game.externalId.provider}:{game.externalId.id}"
    if external_key in exclusion_external_ids:
        return False

    if normalize_title(game.title) in exclusion_titles:
        return False

    return has_recommendation_grade_metadata(game) and has_reliable_candidate_match(
        game,
        query,
    )


def has_recommendation_grade_metadata(game: RecommendationGame) -> bool:
    return (
        bool(game.imageUrl)
        and bool(game.sourceUrl)
        and bool(game.summary and len(game.summary.strip()) >= 60)
        and len(game.genres) > 0
        and len(game.platforms) > 0
        and len(game.tags) > 0
        and isinstance(game.totalRating, (int, float))
        and game.totalRating >= 65
    )


def has_reliable_candidate_match(game: RecommendationGame, query: str) -> bool:
    normalized_query = normalize_title(query)
    normalized_title = normalize_title(game.title)
    normalized_aliases = [normalize_title(alias) for alias in game.aliases]
    normalized_slug = normalize_title((game.sourceUrl or "").split("/")[-1].replace("-", " "))

    return (
        normalized_query in normalized_title
        or normalized_title in normalized_query
        or any(
            normalized_query in alias or alias in normalized_query
            for alias in normalized_aliases
        )
        or bool(
            normalized_slug
            and (normalized_query in normalized_slug or normalized_slug in normalized_query)
        )
        or query_supported_by_candidate(query, game)
    )


def query_supported_by_candidate(
    query: str,
    game: RecommendationGame | RecommendationLocalGame,
) -> bool:
    searchable_text = candidate_searchable_text(game)
    return any(
        part in searchable_text
        for part in query_parts(query)
        if len(part) >= 4
    )


def tags_supported_by_candidate(
    matched_tags: list[str],
    game: RecommendationGame | RecommendationLocalGame,
) -> list[str]:
    searchable_text = candidate_searchable_text(game)
    supported: list[str] = []

    for tag in matched_tags:
        if any(part in searchable_text for part in query_parts(tag) if len(part) >= 4):
            supported.append(tag)

    return supported


def candidate_searchable_text(game: RecommendationGame | RecommendationLocalGame) -> str:
    summary = game.summary if isinstance(game, RecommendationGame) else None
    values = [
        game.title,
        summary,
        *game.genres,
        *game.tags,
    ]
    return " ".join(value for value in values if value).lower()


def is_excluded_local_game(
    game: RecommendationLocalGame,
    exclusion_titles: set[str],
    exclusion_external_ids: set[str],
    exclusion_game_ids: set[str],
) -> bool:
    return (
        game.id in exclusion_game_ids
        or normalize_title(game.title) in exclusion_titles
        or bool(game.steamAppId and f"steam:{game.steamAppId}" in exclusion_external_ids)
    )


def unique_recommendations(
    recommendations: list[RecommendationCard],
) -> list[RecommendationCard]:
    seen_titles: set[str] = set()
    series_counts: dict[str, int] = {}
    unique: list[RecommendationCard] = []

    for recommendation in recommendations:
        title_key = normalize_title(recommendation.title)
        title_series_key = series_key(recommendation.title)

        if title_key in seen_titles:
            continue

        if series_counts.get(title_series_key, 0) >= MAX_RECOMMENDATIONS_PER_SERIES:
            continue

        seen_titles.add(title_key)
        series_counts[title_series_key] = series_counts.get(title_series_key, 0) + 1
        unique.append(recommendation)

    return unique


def simple_recommendation_reason(
    title: str,
    matched_tags: list[str],
    request: RecommendationBuildRequest,
) -> str:
    labels = [
        *[term.label for term in request.wordCloud[:2]],
        *matched_tags[:2],
        *[tag.label for tag in request.preferenceTags[:2]],
    ]
    signal = ", ".join(
        to_korean_analysis_label(label)
        for label in unique_non_empty(labels)[:3]
        if to_korean_analysis_label(label)
    )
    preference_text = signal if signal else "기록 기반 플레이 성향"
    return (
        f"{title}는 {request.nickname}님의 {preference_text}과 맞닿아 있어 추천합니다."
    )


def refine_recommendation_reasons(
    recommendations: list[RecommendationCard],
    request: RecommendationBuildRequest,
) -> list[RecommendationCard] | None:
    if not recommendations:
        return recommendations

    result = request_openai_json(
        schema=recommendation_reason_json_schema(),
        schema_name="gjc_recommendation_reasons_ko",
        system_prompt=(
            "당신은 게임 추천 UI에 들어갈 짧은 추천 근거를 씁니다. "
            "반드시 JSON만 반환하고, 모든 reason은 자연스러운 한국어 존댓말 한 문장이어야 합니다. "
            "영어 단어 나열, 영어 문장, 반말, 해요체, 과장된 홍보 문구는 쓰지 마세요. "
            f"{request.reasonLanguageInstruction}"
        ),
        user_content=json.dumps(
            {
                "instruction": (
                    "각 추천 게임마다 서로 다른 추천 근거를 70자 안팎으로 작성하세요. "
                    "사용자의 플레이 성향, 선호 게임 요소, 후보 게임의 장르/태그를 근거로 삼으세요. "
                    "reason 값에는 반드시 한글이 포함되어야 하며 영어로 작성하면 안 됩니다."
                ),
                "reasonLanguageInstruction": request.reasonLanguageInstruction,
                "nickname": request.nickname,
                "playStyleSummary": request.playStyleSummary,
                "playStyles": [
                    to_korean_analysis_label(term.label)
                    for term in request.wordCloud[:5]
                ],
                "gameElementTags": [
                    to_korean_analysis_label(tag.label)
                    for tag in request.preferenceTags[:8]
                ],
                "recommendations": [
                    {
                        "genres": recommendation.genres,
                        "matchedTags": [
                            to_korean_analysis_label(tag)
                            for tag in recommendation.matchedTags
                        ],
                        "rank": recommendation.rank,
                        "tags": recommendation.tags,
                        "title": recommendation.title,
                    }
                    for recommendation in recommendations
                ],
            },
            ensure_ascii=False,
        ),
        timeout_seconds=20,
    )

    if result is None:
        return None

    reasons_by_rank = {
        int(item["rank"]): str(item["reason"]).strip()
        for item in result.get("reasons", [])
        if isinstance(item, dict)
        and isinstance(item.get("rank"), (int, float))
        and isinstance(item.get("reason"), str)
        and contains_hangul(str(item.get("reason")))
    }

    if len(reasons_by_rank) < len(recommendations):
        return None

    return [
        recommendation.model_copy(update={"reason": reasons_by_rank[recommendation.rank]})
        for recommendation in recommendations
    ]


def recommendation_reason_json_schema() -> dict[str, object]:
    return {
        "additionalProperties": False,
        "properties": {
            "reasons": {
                "items": {
                    "additionalProperties": False,
                    "properties": {
                        "rank": {"type": "number"},
                        "reason": {"type": "string"},
                        "title": {"type": "string"},
                    },
                    "required": ["rank", "title", "reason"],
                    "type": "object",
                },
                "type": "array",
            },
        },
        "required": ["reasons"],
        "type": "object",
    }


def query_parts(value: str) -> list[str]:
    return [part for part in re.split(r"[_\s-]+", value.lower()) if part]


def normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", title.strip()).lower()


def series_key(title: str) -> str:
    normalized = normalize_title(title)
    normalized = re.sub(r"\b[ivx]+\b$", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\b\d+\b$", "", normalized)
    return re.split(r"[:\-]", normalized)[0].strip()
