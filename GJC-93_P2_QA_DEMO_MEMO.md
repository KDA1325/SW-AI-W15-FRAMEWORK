# GJC-93 P2 당일 회귀 QA 데모 메모

## 1. 대상 스프린트

- 스프린트: `P2 당일 잔여 필수 구현 (6/16)`
- 확인 일시: `2026-06-16`
- 목적: 저널/프로필/추천/타임라인 당일 필수 잔여 구현이 데모 가능한 수준으로 연결됐는지 확인한다.

## 2. 활성 스프린트 이슈 상태

| 이슈 | 범위 | QA 신호 |
| --- | --- | --- |
| GJC-67 | 프로필 기본 정보 DB 연동 | 완료 상태, 프로필 DB 저장 흐름 구현됨 |
| GJC-68 | Steam API 스탯 섹션 | 완료 상태, live Steam smoke 통과 |
| GJC-97 | Steam OpenID 연동 | 완료 상태, Steam 연동 API 흐름 포함 |
| GJC-167 | 추천 사용자 범위 제한 | 완료 상태, RAG/Agent 사용자 스코프 테스트 통과 |
| GJC-168 | 추천 Sync 저장/새로고침 유지 | HTTP SYNC 후 `latest` 조회 통과 |
| GJC-169 | 추천 카드 높이/스크롤 | client lint/build 통과 |
| GJC-170 | 프로필 아카이브 리뷰 로그 DB 연동 | 완료 상태, `/posts?mine=true&type=REVIEW` 렌더 경로 사용 |
| GJC-171 | IGDB 게임 검색/선택 | live IGDB MCP smoke 통과 |
| GJC-172 | 중복 리뷰 차단 | server Jest 전체 통과 |
| GJC-99 | 타임라인 게임 이미지/fallback | client lint/build 통과, 코드 fallback 포함 |

## 3. 실행한 검증 명령

```powershell
docker compose ps
```

결과:

```text
game-archive-postgres   pgvector/pgvector:pg16   Up 2 days   0.0.0.0:5432->5432/tcp
```

```powershell
cd server
npm.cmd run build
npm.cmd test -- --runInBand
```

결과:

```text
server build: PASS
Test Suites: 6 passed, 6 total
Tests: 22 passed, 22 total
```

```powershell
cd client
npm.cmd run lint
npm.cmd run build
```

결과:

```text
client lint: PASS
client build: PASS
```

## 4. 외부 연동 smoke

일반 샌드박스 실행에서는 IGDB/Steam 네트워크 요청이 실패했지만, 외부 네트워크 접근 권한으로 재시도했을 때 둘 다 통과했습니다.

```powershell
cd server
npm.cmd run smoke:mcp:igdb
```

요약 결과:

```json
{
  "ok": true,
  "provider": "igdb",
  "query": "CrossCode",
  "resultCount": 2,
  "firstGames": ["CrossCode", "CrossCode: A New Home"]
}
```

```powershell
cd server
npm.cmd run smoke:steam
```

요약 결과:

```json
{
  "ok": true,
  "personaName": "Robin",
  "profileUrl": "https://steamcommunity.com/id/robinwalker/",
  "steamId": "76561197960435530"
}
```

두 smoke 모두 임시 Nest 앱을 띄워 실제 서버 코드 경로를 사용합니다. 실행 중 `pg` deprecation warning이 출력되지만 smoke 결과는 성공입니다.

## 5. 추천 SYNC API happy path

빌드된 Nest 서버를 `node dist/main.js`로 실행한 뒤 demo 계정으로 로그인하고 SYNC를 호출했습니다.

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod `
  -Uri 'http://127.0.0.1:3000/auth/login' `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"email":"demo@gaming-journal.club","password":"demo-password"}' `
  -WebSession $session

$sync = Invoke-RestMethod `
  -Uri 'http://127.0.0.1:3000/ai/recommendations/sync' `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"forceRefresh":true,"topK":6,"requestId":"gjc-93-qa"}' `
  -WebSession $session
```

요약 결과:

```json
{
  "loginEmail": "demo@gaming-journal.club",
  "recommendations": 3,
  "preferenceTags": 6,
  "wordCloud": 6,
  "ragSources": 5,
  "mcpTool": "search_games",
  "mcpResults": 5,
  "agentIterations": 1,
  "stoppedReason": "completed"
}
```

## 6. 추천 새로고침 유지 확인

서버를 재시작한 뒤 같은 demo 계정으로 `GET /ai/recommendations/latest`를 호출했습니다.

```powershell
$latest = Invoke-RestMethod `
  -Uri 'http://127.0.0.1:3000/ai/recommendations/latest' `
  -Method Get `
  -WebSession $session
```

요약 결과:

```json
{
  "hasLatest": true,
  "recommendations": 3,
  "preferenceTags": 6,
  "wordCloud": 6,
  "lastSyncAt": "2026-06-16T08:54:19.620Z",
  "ragSources": 5,
  "mcpResults": 5,
  "stoppedReason": "completed"
}
```

즉, SYNC 결과는 DB에 저장되고 새 서버 실행 후에도 최신 스냅샷으로 복원됩니다.

## 7. 확인된 한계

- 이 Codex Windows 환경에서 인앱 브라우저 자동화가 `CreateProcessAsUserW failed: 5`로 실패했습니다.
- 따라서 실제 브라우저에서 버튼 클릭, hover, 이미지 시각 상태를 눈으로 확인하는 단계는 수동 데모 전 사용자 환경에서 한 번 더 확인해야 합니다.
- API/빌드/테스트 기준으로는 저널, 프로필, 추천, 타임라인 당일 구현 범위가 연결되어 있습니다.

## 8. 수동 데모 체크리스트

```text
[ ] /login에서 demo@gaming-journal.club / demo-password 로그인
[ ] /profile에서 nickname, bio, gamerTags, Steam 상태, archive review cards 확인
[ ] /write-review에서 IGDB 검색 결과 선택 후 payload 저장 흐름 확인
[ ] 같은 게임 리뷰 재작성 시 inline duplicate message 확인
[ ] /recommend에서 SYNC_DATA 클릭 후 추천, 태그, 워드클라우드, pipeline 확인
[ ] 새로고침 후 /recommend가 마지막 SYNC 결과를 유지하는지 확인
[ ] /timeline에서 각 게시글 좌측 게임 이미지 또는 이니셜 fallback 확인
```
