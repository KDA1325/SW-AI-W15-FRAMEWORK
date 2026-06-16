# Player Preference IGDB Reviews/Journals Dataset

게임 스타일 및 선호 장르 키워드 분석 AI를 위한 합성 한국어 데이터셋입니다.

## Files

- `player_preference_igdb_reviews_journals.json`: 전체 레코드를 JSON 배열로 저장한 파일
- `player_preference_igdb_reviews_journals.jsonl`: 학습/임베딩 파이프라인에 넣기 쉬운 JSON Lines 파일
- `player_preference_igdb_reviews_journals.csv`: 스프레드시트 확인용 CSV 파일
- `summary.json`: 플레이어 유형, 선호 신호, REVIEW/JOURNAL 카운트 요약
- `test_persona_accounts.json`: 4개 테스트 페르소나 계정 목록
- `by-persona/`: 계정별로 분리된 JSON/JSONL/CSV와 import payload
- `generate-player-preference-dataset.mjs`: 데이터셋 재생성 스크립트

## Scope

- 총 160개 레코드
- RPG/시뮬레이션 솔로 선호: 40개
- 퍼즐 솔로 선호: 80개
- 멀티플레이 선호: 20개
- 공포 게임 선호: 20개

## Test Accounts

| 순서 | 플레이어 유형 | 이메일 | 비밀번호 | 게시글 |
| --- | --- | --- | --- | --- |
| 1 | RPG/시뮬레이션 솔로 선호 플레이어 | `persona-rpg-sim-solo@gaming-journal.club` | `PersonaTest!2026` | 40 |
| 2 | 퍼즐 솔로 선호 플레이어 | `persona-puzzle-solo@gaming-journal.club` | `PersonaTest!2026` | 80 |
| 3 | 멀티플레이 선호 플레이어 | `persona-multiplayer@gaming-journal.club` | `PersonaTest!2026` | 20 |
| 4 | 공포 게임 선호 플레이어 | `persona-horror@gaming-journal.club` | `PersonaTest!2026` | 20 |

각 계정의 `by-persona/*_import_payload.json` 파일에는 계정 정보와 게시글 생성 payload가 함께 들어 있습니다.

## Schema

- `type`: `REVIEW` 또는 `JOURNAL`
- `label_target`: `positive_preference`, `mixed_preference`, `negative_preference`
- `preference_signal`: `LIKE`, `MIXED`, `DISLIKE`
- `preference_score`: -1.0부터 1.0 사이의 분석용 선호 점수
- `rating`: REVIEW에만 있는 1-5점 평점, JOURNAL은 `null`
- `game_title`, `igdb_lookup_query`, `igdb_slug`, `igdb_source_url`: IGDB 기준 게임 참조 필드
- `igdb_match_status`: `slug_hint_only`; 숫자형 IGDB id는 후속 hydrate 대상
- `preference_keywords`: 선호 장르/플레이 스타일 키워드
- `avoidance_keywords`: 비선호 또는 마찰 요인 키워드

## Notes

본문은 실제 유저 리뷰를 수집한 것이 아니라, 모델 학습/테스트를 위해 새로 작성한 합성 원문입니다. 게임 타이틀은 IGDB에 등재된 공개 타이틀 기준으로 선정했습니다. 생성기는 외부 API를 직접 호출하지 않는 오프라인 방식이므로 숫자형 `igdb_game_id`는 `null`로 두었습니다. 추후 `igdb_lookup_query`, `igdb_slug`, `igdb_source_url`를 기준으로 서버의 IGDB 검색 API를 통해 보강할 수 있습니다.
