# Persona Split Dataset

4개 테스트 계정별로 분리한 리뷰/저널 데이터입니다.

## Accounts

| 순서 | 플레이어 유형 | 이메일 | 비밀번호 | 게시글 |
| --- | --- | --- | --- | --- |
| 1 | RPG/시뮬레이션 솔로 선호 플레이어 | `test1@test.com` | `personatest1` | 40 |
| 2 | 퍼즐 솔로 선호 플레이어 | `test2@test.com` | `personatest2` | 80 |
| 3 | 멀티플레이 선호 플레이어 | `test3@test.com` | `personatest3` | 20 |
| 4 | 공포 게임 선호 플레이어 | `test4@test.com` | `personatest4` | 20 |

## File Pattern

- `NN_player_type.json`: 해당 페르소나 원본 레코드 배열
- `NN_player_type.jsonl`: 해당 페르소나 JSON Lines
- `NN_player_type.csv`: 해당 페르소나 CSV
- `NN_player_type_import_payload.json`: 테스트 계정 정보와 `POST /posts`에 넣기 쉬운 게시글 payload 목록
