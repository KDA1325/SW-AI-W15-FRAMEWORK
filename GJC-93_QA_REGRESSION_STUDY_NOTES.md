# GJC-93 회귀 QA 학습 정리

## 1. QA 이슈는 기능 구현과 검증 근거를 연결한다

GJC-93은 새 기능을 크게 추가하는 이슈가 아니라, 활성 스프린트에서 완료된 기능들이 데모 가능한 흐름으로 연결됐는지 확인하는 작업입니다. 그래서 결과물은 코드보다 검증 문서가 중심입니다.

```text
대상 범위:
- 저널/리뷰 작성: IGDB 검색, 게임 선택, 중복 리뷰 차단
- 프로필: DB 프로필, Steam 연동, Steam stats, archive review logs
- 추천: user-scoped RAG/Agent, SYNC 저장, latest 복원, No data 상태
- 타임라인: game.imageUrl 표시와 fallback
```

핵심은 "무엇을 실제로 실행했는지"와 "무엇은 환경 한계로 직접 보지 못했는지"를 분리해서 남기는 것입니다.

## 2. 먼저 자동 검증으로 기본 안정성을 확보한다

서버와 클라이언트가 각각 빌드되고 테스트되는지 확인했습니다.

```powershell
cd server
npm.cmd run build
npm.cmd test -- --runInBand

cd ../client
npm.cmd run lint
npm.cmd run build
```

결과:

```text
server build: PASS
server tests: 6 suites / 22 tests PASS
client lint: PASS
client build: PASS
```

이 단계는 브라우저에서 눈으로 보기 전, 타입 오류나 단위 테스트 회귀가 없는지 빠르게 잡아주는 안전망입니다.

## 3. 외부 API smoke는 권한 문제와 실제 실패를 분리한다

IGDB와 Steam smoke는 처음에는 네트워크 오류가 났고, 외부 네트워크 접근 권한으로 재시도했을 때 성공했습니다.

```powershell
cd server
npm.cmd run smoke:mcp:igdb
npm.cmd run smoke:steam
```

성공 요약:

```json
{
  "igdb": {
    "ok": true,
    "query": "CrossCode",
    "resultCount": 2
  },
  "steam": {
    "ok": true,
    "personaName": "Robin",
    "steamId": "76561197960435530"
  }
}
```

이런 smoke는 API 키가 들어간 환경에서 외부 서비스가 실제로 응답하는지 확인하는 데 유용합니다.

## 4. 추천 SYNC는 HTTP happy path와 latest 복원까지 확인한다

추천 페이지의 핵심은 `POST /ai/recommendations/sync`가 현재 사용자 데이터를 분석하고, 그 결과가 DB에 저장되어 `GET /ai/recommendations/latest`로 다시 복원되는 것입니다.

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

SYNC 결과:

```json
{
  "recommendations": 3,
  "preferenceTags": 6,
  "wordCloud": 6,
  "ragSources": 5,
  "mcpResults": 5,
  "stoppedReason": "completed"
}
```

서버 재시작 후 latest 복원 결과:

```json
{
  "hasLatest": true,
  "recommendations": 3,
  "lastSyncAt": "2026-06-16T08:54:19.620Z",
  "stoppedReason": "completed"
}
```

이 두 결과를 함께 봐야 "SYNC가 실행됐다"를 넘어 "새로고침 후에도 유지된다"는 요구사항까지 확인할 수 있습니다.

## 5. 남은 한계는 실패가 아니라 QA 산출물이다

현재 Codex Windows 환경에서는 인앱 브라우저 자동화가 실행 권한 문제로 실패했습니다.

```text
CreateProcessAsUserW failed: 5
```

그래서 실제 화면에서 hover, 버튼 클릭, 이미지 표시 상태를 보는 단계는 사용자 환경에서 수동 데모 전 한 번 더 확인해야 합니다. 이 한계를 숨기지 않고 `GJC-93_P2_QA_DEMO_MEMO.md`에 남겨 두면, 다음 검증자가 같은 영역을 놓치지 않습니다.

## 6. 문서화된 QA 산출물

```text
GJC-93_P2_QA_DEMO_MEMO.md
```

이 메모에는 활성 스프린트 이슈 상태, 실행한 명령, smoke 결과, 추천 API 결과, latest 복원 결과, 남은 수동 데모 체크리스트가 들어 있습니다.
