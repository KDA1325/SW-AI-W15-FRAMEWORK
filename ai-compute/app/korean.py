import re


KOREAN_ANALYSIS_LABELS: dict[str, str] = {
    "AESTHETIC_EXPLORER": "미감과 분위기를 탐색하는 성향",
    "AESTHETIC_PRESENTATION": "아트와 분위기",
    "ARCHIVE_BASED_PLAYER": "기록 기반 플레이 성향",
    "ATMOSPHERE": "분위기",
    "COOP_TEAMPLAYER": "협동 플레이 성향",
    "COLLECTION": "수집 요소",
    "COLLECTION_COMPLETIONIST": "수집 완성형 플레이",
    "COZY_SIM": "편안한 시뮬레이션 감성",
    "CRAFTING": "제작과 장비 성장",
    "DEDUCTION": "추리 요소",
    "DELIBERATE_PLANNER": "차분하게 계획하는 플레이",
    "EUREKA_MOMENTS": "깨달음이 있는 퍼즐",
    "FARMING_LOOP": "반복 성장 루프",
    "GAME_ELEMENTS": "선호 게임 요소",
    "HORROR_ATMOSPHERE": "공포 분위기",
    "HUNTING_LOOP": "사냥과 보스 공략",
    "LOW_PRESSURE_ROUTINE": "부담 없는 반복 플레이",
    "NARRATIVE_ROLEPLAYER": "서사 몰입형 플레이",
    "OPTIMIZATION": "최적화 요소",
    "PIXEL_ART": "픽셀 아트",
    "PROGRAMMING_PUZZLE": "프로그래밍 퍼즐",
    "PUZZLE_SYSTEMS": "퍼즐 시스템",
    "SOLO_PROBLEM_SOLVER": "혼자 문제를 푸는 성향",
    "SPATIAL_REASONING": "공간 추론",
    "STORY_DRIVEN": "스토리 중심 구성",
    "SYSTEM_OPTIMIZER": "시스템 최적화 성향",
    "TACTICAL": "전술적 플레이",
    "TACTICAL_COMBAT": "전술 전투",
    "TACTICAL_RPG": "전술 RPG",
    "TANK_ROLE": "탱커 역할 선호",
}


def contains_hangul(value: str) -> bool:
    return any("\uac00" <= char <= "\ud7a3" for char in value)


def to_korean_analysis_label(label: str) -> str:
    cleaned = label.strip()

    if not cleaned:
        return ""

    if contains_hangul(cleaned):
        return cleaned

    normalized = cleaned.replace(" ", "_").upper()
    return KOREAN_ANALYSIS_LABELS.get(normalized, normalized.replace("_", " ").lower())


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


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()
