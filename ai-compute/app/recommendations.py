import re

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
    signal = ", ".join(unique_non_empty(labels)[:3])
    preference_text = signal.replace("_", " ").lower() if signal else "your play history"
    return (
        f"{title} matches {request.nickname}'s {preference_text} signals "
        "from the archive analysis."
    )


def query_parts(value: str) -> list[str]:
    return [part for part in re.split(r"[_\s-]+", value.lower()) if part]


def unique_non_empty(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []

    for value in values:
        normalized = value.strip()
        key = normalized.lower()

        if normalized and key not in seen:
            seen.add(key)
            result.append(normalized)

    return result


def normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", title.strip()).lower()


def series_key(title: str) -> str:
    normalized = normalize_title(title)
    normalized = re.sub(r"\b[ivx]+\b$", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\b\d+\b$", "", normalized)
    return re.split(r"[:\-]", normalized)[0].strip()
