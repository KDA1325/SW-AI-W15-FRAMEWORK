# Steam Profile Link Study Notes

## 작업 요약

이번 작업은 목표에 남아 있던 Steam 사용자 프로필 연결을 MVP 범위로 구현한 것이다.

- `User.steamId` 컬럼을 활용해 사용자의 SteamID64를 저장한다.
- `GET /auth/steam/profile`로 현재 연결 상태를 조회한다.
- `POST /auth/steam/link`로 SteamID64 또는 Steam profile URL을 받아 Steam Web API로 프로필을 확인한다.
- `DELETE /auth/steam/link`로 연결을 해제한다.
- React `Profile` 화면에 Steam 연결 패널을 추가했다.
- `STEAM_WEB_API_KEY`가 없으면 화면이 깨지지 않도록 `missing_credentials` 상태를 보여준다.

## 공식 API 근거

Steam Web API 문서 기준으로 프로필 조회는 `ISteamUser/GetPlayerSummaries/v2`를 사용한다.

```text
GET https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/
params: key, steamids
```

vanity URL은 SteamID64가 아니므로 먼저 `ISteamUser/ResolveVanityURL/v1`로 변환해야 한다.

```text
GET https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/
params: key, vanityurl
```

## 핵심 코드 1: 입력 DTO

```ts
export class LinkSteamProfileDto {
  // SteamID64, /profiles/<steamid>, /id/<vanity> URL 모두 한 입력 칸에서 받습니다.
  @IsString()
  @MinLength(2)
  steamProfile!: string
}
```

하나의 입력칸에서 숫자 SteamID64, `/profiles/<steamid>` URL, `/id/<vanity>` URL을 모두 받기 위해 필드명을 `steamProfile`로 넓게 잡았다.

## 핵심 코드 2: Steam 입력 파싱

```ts
private parseSteamProfileInput(rawProfile: string):
  | { kind: 'steamid'; value: string }
  | { kind: 'vanity'; value: string } {
  const input = rawProfile.trim()
  const steamIdMatch = input.match(/(?:profiles\/)?(\d{17})/)

  if (steamIdMatch?.[1]) {
    return { kind: 'steamid', value: steamIdMatch[1] }
  }

  const vanityMatch = input.match(/steamcommunity\.com\/id\/([^/?#]+)/i)
  const vanity = vanityMatch?.[1] ?? input

  if (/^[a-zA-Z0-9_-]{2,64}$/.test(vanity)) {
    return { kind: 'vanity', value: vanity }
  }

  throw new BadRequestException(
    'SteamID64, Steam profile URL, or vanity URL name is required.',
  )
}
```

입력이 17자리 숫자면 바로 SteamID64로 취급한다. vanity 이름은 API key가 있어야 SteamID64로 변환할 수 있으므로 `resolveVanityUrl`을 거친다.

## 핵심 코드 3: Steam profile fetch

```ts
const response = await axios.get<SteamSummaryResponse>(
  'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/',
  {
    params: {
      key: apiKey,
      steamids: steamId,
    },
    timeout: 10_000,
  },
)
const player = response.data.response?.players?.[0]
```

Steam 응답에서 현재 화면에 필요한 값만 고른다.

```ts
profile: {
  avatarUrl: player.avatarfull || player.avatarmedium || player.avatar,
  personaName: player.personaname,
  profileUrl: player.profileurl,
  steamId: player.steamid,
  visibilityState: player.communityvisibilitystate ?? null,
}
```

## 핵심 코드 4: API key 없음 fallback

```ts
if (!apiKey) {
  return {
    connected: false,
    error:
      'STEAM_WEB_API_KEY is missing. Add the key before linking a live Steam profile.',
    errorCode: 'missing_credentials',
    profile: null,
    steamId,
  }
}
```

이 응답은 예외가 아니라 정상 JSON이다. 프론트는 이 값을 받아 `missing_credentials` 배지를 보여주고 페이지를 계속 렌더링한다.

## 핵심 코드 5: 인증 컨트롤러 라우팅

```ts
@UseGuards(JwtAuthGuard)
@Get('steam/profile')
steamProfile(@Req() req: AuthedRequest) {
  return this.steamService.getLinkedProfile(req.user.userId)
}

@UseGuards(JwtAuthGuard)
@Post('steam/link')
linkSteamProfile(
  @Req() req: AuthedRequest,
  @Body() dto: LinkSteamProfileDto,
) {
  return this.steamService.linkProfile(req.user.userId, dto.steamProfile)
}

@UseGuards(JwtAuthGuard)
@Delete('steam/link')
unlinkSteamProfile(@Req() req: AuthedRequest) {
  return this.steamService.unlinkProfile(req.user.userId)
}
```

Steam profile 연결은 로그인한 사용자에게만 의미가 있으므로 모든 라우트에 `JwtAuthGuard`를 적용했다.

## 핵심 코드 6: React profile panel

프로필 화면은 로딩, 연결, 실패 상태를 모두 한 패널에서 처리한다.

```tsx
<input
  className="min-w-0 flex-1 border-2 border-[var(--gjc-primary)] bg-white px-3 py-2 font-body-md text-sm text-[var(--gjc-primary)] outline-none"
  onChange={(event) => setSteamInput(event.target.value)}
  placeholder="7656119... / steamcommunity.com/id/name"
  value={steamInput}
/>
<button
  className="border-2 border-[var(--gjc-primary)] bg-[var(--gjc-primary)] px-4 py-2 font-ui-button text-xs uppercase tracking-widest text-[var(--gjc-on-primary)] transition-colors hover:bg-[var(--gjc-surface-container-lowest)] hover:text-[var(--gjc-primary)] disabled:cursor-not-allowed disabled:opacity-50"
  disabled={isSteamLoading || steamInput.trim().length < 2}
  onClick={linkSteamProfile}
  type="button"
>
  {isSteamLoading ? 'SYNCING' : 'LINK'}
</button>
```

연결 성공 시에는 `refreshUser()`를 호출해서 `/auth/me`의 `steamId`도 최신화한다.

```ts
// 연결에 성공했을 때만 /auth/me의 steamId도 다시 맞춥니다.
if (response.data.connected) {
  setSteamMessage('STEAM_PROFILE_CONNECTED')
  await refreshUser()
}
```

## MVP 한계

현재 구현은 프로필 표시용 연결이다. 사용자가 입력한 SteamID64가 정말 본인 소유 계정인지 증명하지 않는다. 실제 계정 소유권 검증이 필요하면 Steam OpenID 인증 흐름을 추가해야 한다.

## 검증 결과

실행한 검증:

```bash
cd server && npm.cmd run build
cd server && npm.cmd test -- --runInBand
cd client && npm.cmd run lint
cd client && npm.cmd run build
```

Steam key 미설정 상태 HTTP 검증:

```json
{
  "idConnected": false,
  "idSteamId": "76561198000000000",
  "idErrorCode": "missing_credentials",
  "vanityConnected": false,
  "vanitySteamId": null,
  "vanityErrorCode": "missing_credentials"
}
```

이 결과는 API key가 없어도 SteamID64 입력과 vanity URL 입력 모두 프로필 페이지를 깨뜨리지 않고, 사용자가 필요한 설정 상태를 확인할 수 있음을 보여준다.
