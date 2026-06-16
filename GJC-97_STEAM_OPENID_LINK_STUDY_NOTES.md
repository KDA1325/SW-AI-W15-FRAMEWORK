# GJC-97 Steam OpenID 계정 연동 학습 정리

## 1. 작업 범위

- 백엔드: Steam OpenID 로그인 URL 생성, 콜백 검증, 검증된 SteamID64 저장
- 프론트엔드: 프로필 화면에서 Steam 로그인 버튼 제공, 콜백 결과 메시지 표시
- 설정/문서: `SERVER_URL` 환경변수 추가, Steam OpenID 콜백 동작 문서화

## 2. OpenID 시작 URL 생성

Steam OpenID는 사용자를 Steam 인증 화면으로 보낼 때 `openid.return_to`와 `openid.realm`을 정확히 넣어야 한다. 배포 환경마다 백엔드 공개 주소가 달라지기 때문에 `SERVER_URL`을 기준으로 콜백 주소를 만든다.

```ts
buildOpenIdLoginUrl() {
  const returnTo = `${this.serverBaseUrl()}/auth/steam/openid/callback`
  const params = new URLSearchParams({
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.mode': 'checkid_setup',
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.realm': this.serverBaseUrl(),
    'openid.return_to': returnTo,
  })

  return `https://steamcommunity.com/openid/login?${params.toString()}`
}
```

## 3. 콜백 검증 흐름

Steam이 콜백으로 넘겨준 값만 믿고 저장하면 계정 소유 검증이 되지 않는다. 그래서 콜백 payload를 다시 Steam에 보내 `is_valid:true`인지 확인한 뒤 SteamID64를 저장한다.

```ts
private async verifyOpenIdCallback(
  query: Record<string, unknown>,
): Promise<string | null> {
  const claimedId = this.stringQueryValue(query['openid.claimed_id'])
  const steamId = claimedId?.match(
    /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/,
  )?.[1]

  if (this.stringQueryValue(query['openid.mode']) !== 'id_res' || !steamId) {
    return null
  }

  const verificationBody = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('openid.') && typeof value === 'string') {
      verificationBody.set(key, value)
    }
  }

  // Steam OpenID requires the exact callback payload to be posted back with check_authentication.
  verificationBody.set('openid.mode', 'check_authentication')

  const response = await axios.post<string>(
    'https://steamcommunity.com/openid/login',
    verificationBody,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10_000,
    },
  )

  return response.data.includes('is_valid:true') ? steamId : null
}
```

핵심 주석:

```ts
// Steam OpenID requires the exact callback payload to be posted back with check_authentication.
verificationBody.set('openid.mode', 'check_authentication')
```

이 주석은 OpenID 검증에서 중요한 규칙을 남긴 것이다. 콜백에 포함된 `openid.*` 값을 유지한 채 `openid.mode`만 `check_authentication`으로 바꿔 Steam에 재검증 요청을 보내야 한다.

## 4. 인증된 SteamID 저장

검증에 성공하면 사용자의 `steamId`에 SteamID64를 저장하고, 실패하면 프론트가 해석할 수 있는 에러 코드를 반환한다.

```ts
async linkOpenIdProfile(
  userId: string,
  query: Record<string, unknown>,
): Promise<SteamOpenIdLinkResponse> {
  const steamId = await this.verifyOpenIdCallback(query)

  if (!steamId) {
    return {
      connected: false,
      error: 'Steam OpenID verification failed.',
      errorCode: 'openid_failed',
      steamId: null,
    }
  }

  await this.userRepository.update(userId, { steamId })

  return {
    connected: true,
    error: null,
    errorCode: null,
    steamId,
  }
}
```

## 5. 컨트롤러 라우팅

컨트롤러는 두 개의 라우트를 제공한다. 시작 라우트는 Steam으로 redirect하고, callback 라우트는 검증 결과를 다시 프로필 화면으로 redirect한다.

```ts
@UseGuards(JwtAuthGuard)
@Get('steam/openid')
startSteamOpenId(@Res() res: Response) {
  return res.redirect(this.steamService.buildOpenIdLoginUrl())
}

@UseGuards(JwtAuthGuard)
@Get('steam/openid/callback')
async steamOpenIdCallback(
  @Req() req: AuthedRequest,
  @Query() query: Record<string, unknown>,
  @Res() res: Response,
) {
  const result = await this.steamService.linkOpenIdProfile(req.user.userId, query)

  return res.redirect(this.steamService.profileRedirectUrl(result))
}
```

## 6. 프론트엔드 연결

프로필 화면은 API base URL을 기준으로 OpenID 시작 URL을 만들고, 버튼 클릭 시 브라우저를 해당 URL로 이동시킨다.

```tsx
function apiUrl(path: string) {
  return new URL(path, api.defaults.baseURL ?? window.location.origin).toString()
}

const startSteamOpenIdLink = () => {
  window.location.href = apiUrl('/auth/steam/openid')
}
```

콜백 이후에는 백엔드가 `/profile?steam=connected` 또는 `/profile?steam=failed&steam_error=...` 형태로 되돌려 보내므로, 초기 상태에서 query string을 읽어 메시지를 표시한다.

```tsx
const [steamMessage, setSteamMessage] = useState<string | null>(() => {
  const params = new URLSearchParams(window.location.search)
  const steamStatus = params.get('steam')

  if (steamStatus === 'connected') {
    return 'STEAM_OPENID_CONNECTED'
  }

  if (steamStatus === 'failed') {
    return `STEAM_OPENID_FAILED_${params.get('steam_error') ?? 'UNKNOWN'}`
  }

  return null
})
```

## 7. 설정 포인트

```env
SERVER_URL=http://localhost:3000
CLIENT_URL=http://localhost:5173
```

- `SERVER_URL`: Steam이 다시 돌아올 백엔드 공개 주소
- `CLIENT_URL`: OpenID 검증 뒤 사용자를 돌려보낼 프론트 주소

로컬 개발은 기본값으로 동작하지만, 배포 환경에서는 Steam이 접근 가능한 HTTPS 백엔드 URL을 `SERVER_URL`로 지정해야 한다.

## 8. 검증한 항목

```bash
npm.cmd test -- steam.service.spec.ts --runInBand
npm.cmd run build
npm.cmd test -- --runInBand
npm.cmd run lint
npm.cmd run build
```

Steam OpenID URL과 프로필 redirect URL은 단위 테스트로 환경변수 기반 동작을 확인했다.
