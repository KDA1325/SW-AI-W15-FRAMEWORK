# Steam Live Profile Smoke Study Notes

## 1. 작업 요약

원래 목표에는 Steam API를 연결해서 Steam 사용자 프로필을 연결하는 기능이 포함되어 있다. 서버와 React UI는 이미 `GET/POST/DELETE /auth/steam/*` 흐름을 갖고 있었고, 이번 작업에서는 실제 Steam Web API key로 end-to-end smoke test를 추가했다.

변경 파일:

- `server/scripts/smoke-steam-profile.js`
- `server/package.json`
- `server/README.md`
- `README.md`
- `GJC_STEAM_LIVE_PROFILE_STUDY_NOTES.md`

## 2. 실행 명령

```bash
cd server
npm run smoke:steam
```

필요한 환경 변수:

```env
STEAM_WEB_API_KEY=...
```

기본 테스트 프로필은 공개 SteamID64 `76561197960435530`이다. 다른 프로필을 테스트하려면 아래처럼 바꿀 수 있다.

```bash
STEAM_SMOKE_PROFILE=76561197960435530 npm run smoke:steam
```

## 3. 검증하는 흐름

이 스모크 테스트는 `SteamService`를 직접 호출하지 않고 실제 HTTP route를 통과한다.

```text
temporary NestJS app
  -> POST /auth/login
  -> extract access_token cookie
  -> GET /auth/me
  -> POST /auth/steam/link
  -> GET /auth/steam/profile
  -> restore original Steam link
```

이렇게 해야 React profile page가 실제로 의존하는 인증 쿠키와 controller route까지 함께 검증된다.

## 4. 쿠키 추출

로그인 응답의 `Set-Cookie` header에서 `access_token`만 다음 요청의 `Cookie` header로 넘긴다.

```js
function extractCookie(setCookieHeader) {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : [setCookieHeader].filter(Boolean);

  return cookies
    .map((cookie) => cookie.split(';')[0])
    .filter((cookie) => cookie.startsWith('access_token='))
    .join('; ');
}
```

## 5. Steam 연결 검증

`POST /auth/steam/link`와 `GET /auth/steam/profile` 모두 같은 필수 필드를 반환해야 한다.

```js
function assertConnectedSteamProfile(response, label) {
  if (!response?.connected || response.error || response.errorCode) {
    throw new Error(
      `Steam ${label} was not connected: ${response?.errorCode ?? 'unknown_error'} ${response?.error ?? ''}`.trim(),
    );
  }

  if (
    !response.steamId ||
    !response.profile?.steamId ||
    !response.profile?.personaName ||
    !response.profile?.profileUrl
  ) {
    throw new Error(`Steam ${label} did not include required profile fields.`);
  }
}
```

## 6. 원상복구

테스트는 demo user의 `steamId`를 바꾸므로, 마지막에 이전 상태를 복구한다.

```js
async function restoreOriginalSteamLink(baseUrl, cookie, originalSteamId) {
  if (originalSteamId) {
    await axios.post(
      `${baseUrl}/auth/steam/link`,
      { steamProfile: originalSteamId },
      { headers: { Cookie: cookie }, timeout: 20_000 },
    );
    return;
  }

  await axios.delete(`${baseUrl}/auth/steam/link`, {
    headers: { Cookie: cookie },
    timeout: 15_000,
  });
}
```

## 7. 라이브 검증 결과

Steam Web API key 설정 후 network 권한으로 `npm run smoke:steam`을 실행했고, 실제 Steam profile이 반환되었다.

```json
{
  "ok": true,
  "mode": "temporary-nest-app",
  "personaName": "Robin",
  "profileUrl": "https://steamcommunity.com/id/robinwalker/",
  "steamId": "76561197960435530"
}
```

이 결과로 Steam key가 유효하고, 인증된 사용자의 Steam profile link endpoint가 실제 Steam API 데이터를 연결할 수 있음을 확인했다.
