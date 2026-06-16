# GJC-68 Steam API 스탯 섹션 연동 학습 정리

## 1. 작업 범위

- 백엔드: 로그인 사용자의 연동된 `steamId` 기준으로 Steam 스탯 API 응답 생성
- 프론트엔드: 프로필 스탯 그리드의 더미 값 제거 및 실제 API 값 매핑
- 예외 처리: 미연동, API Key 누락, 비공개 게임 정보, 외부 API 실패 상태 처리
- 문서화: Steam 최근 플레이 API의 2주 fallback 명시

참고한 공식 문서:

- Steamworks `IPlayerService`: `GetOwnedGames`, `GetRecentlyPlayedGames` - https://partner.steamgames.com/doc/webapi/IPlayerService
- Steamworks `ISteamUserStats`: `GetPlayerAchievements` - https://partner.steamgames.com/doc/webapi/ISteamUserStats

## 2. 스탯 전용 API를 분리한 이유

프로필 기본 정보와 스탯 데이터는 실패 조건이 다르다. 프로필 요약은 공개되어도 보유 게임 목록은 비공개일 수 있고, 도전과제 API는 게임별로 실패할 수 있다. 그래서 `/auth/steam/profile`과 별도로 `/auth/steam/stats`를 만들었다.

```ts
@UseGuards(JwtAuthGuard)
@Get('steam/stats')
steamStats(@Req() req: AuthedRequest) {
  return this.steamService.getLinkedStats(req.user.userId)
}
```

## 3. 연동 사용자 기준으로만 조회

스탯은 요청 body나 query로 Steam ID를 받지 않는다. 서버가 로그인 사용자의 DB 저장값을 읽어서 조회하므로, 다른 사용자의 Steam 데이터를 임의로 요청하는 흐름을 줄일 수 있다.

```ts
async getLinkedStats(userId: string): Promise<SteamStatsResponse> {
  const user = await this.userRepository.findOneBy({ id: userId })

  if (!user?.steamId) {
    return {
      connected: false,
      error: null,
      errorCode: null,
      stats: null,
      steamId: null,
    }
  }

  return this.fetchStats(user.steamId)
}
```

## 4. Steam API 합성

스탯 응답은 세 종류의 Steam API를 합친다.

```ts
const [ownedResponse, recentResponse] = await Promise.all([
  axios.get<SteamOwnedGamesResponse>(
    'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/',
    {
      params: {
        include_appinfo: true,
        include_played_free_games: true,
        key: apiKey,
        steamid: steamId,
      },
      timeout: 10_000,
    },
  ),
  axios.get<SteamRecentlyPlayedResponse>(
    'https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/',
    {
      params: {
        count: 5,
        key: apiKey,
        steamid: steamId,
      },
      timeout: 10_000,
    },
  ),
])
```

- `GetOwnedGames`: 보유 게임 수와 게임 목록
- `GetRecentlyPlayedGames`: 최근 플레이 게임과 `playtime_2weeks`
- `GetPlayerAchievements`: 게임별 달성 도전과제

## 5. 비공개 프로필 처리

Steam 게임 상세가 비공개이거나 응답이 비어 있으면 UI에 `private_profile` 상태를 전달한다. 이때 화면은 깨지지 않고 `--`, `----`, 오류 메시지 형태로 표시된다.

```ts
if (
  !ownedPayload ||
  (!Array.isArray(ownedPayload.games) &&
    typeof ownedPayload.game_count !== 'number')
) {
  return {
    connected: false,
    error: 'Steam game details are private or unavailable.',
    errorCode: 'private_profile',
    stats: null,
    steamId,
  }
}
```

## 6. 도전과제 샘플링

`GetPlayerAchievements`는 AppID 하나씩 조회해야 한다. 보유 게임 전체를 한 번에 호출하면 프로필 로딩이 느려질 수 있으므로 최근 플레이와 플레이 시간이 있는 게임 중 최대 5개만 샘플링한다.

```ts
// Achievement lookups require one AppID at a time, so cap the sample to keep the profile request responsive.
return [...byAppId.values()]
  .filter((game) => (game.playtime_forever ?? 0) > 0)
  .sort(
    (left, right) =>
      (right.playtime_2weeks ?? 0) - (left.playtime_2weeks ?? 0) ||
      (right.playtime_forever ?? 0) - (left.playtime_forever ?? 0),
  )
  .slice(0, 5)
```

샘플링 결과는 합산해서 스탯 카드에 표시한다.

```ts
stats: {
  achievementGamesChecked: achievementSamples.length,
  achievementsTotal: achievementSamples.reduce(
    (sum, sample) => sum + sample.total,
    0,
  ),
  achievementsUnlocked: achievementSamples.reduce(
    (sum, sample) => sum + sample.unlocked,
    0,
  ),
}
```

## 7. 최근 플레이 2주 fallback

요구사항은 최근 1주일이지만, Steam 공개 최근 플레이 응답은 일별 timestamp가 아니라 `playtime_2weeks`를 제공한다. 그래서 서버 응답과 UI에 2주 fallback을 명시했다.

```ts
recentWindowDays: 14,
recentWindowLabel: 'STEAM_2W_FALLBACK',
```

프론트에서는 스탯이 실제로 있을 때만 `2W PLAY`로 보이고, 미연동/로딩 상태는 `STEAM PLAY`로 둔다.

```tsx
// Steam's public recent-play endpoint exposes a two-week window, so the UI labels that fallback explicitly.
const recentWindowLabel = steamStats
  ? steamStats.recentWindowDays === 14
    ? '2W PLAY'
    : 'WEEK PLAY'
  : 'STEAM PLAY'
```

## 8. Steam 친구 코드 표시

프로필 UI는 SteamID64 전체 대신 더 짧은 account-id 부분을 표시한다.

```ts
private steamFriendCode(steamId: string) {
  try {
    // The profile UI shows the account-id portion because Steam's friend-code screens use that shorter identifier.
    const accountId = BigInt(steamId) - 76561197960265728n

    if (accountId <= 0n) {
      return steamId
    }

    return accountId.toString()
  } catch {
    return steamId
  }
}
```

## 9. 프론트 스탯 그리드 매핑

기존 네 칸 레이아웃은 유지하고 숫자만 API 데이터로 교체했다.

```tsx
const ownedGamesCount = formatStatNumber(steamStats?.ownedGamesCount)
const achievementsUnlocked = formatStatNumber(
  steamStats?.achievementsUnlocked,
)
const recentPlayHours = formatPlayHours(steamStats?.recentPlaytimeMinutes)
const friendCode = steamStats?.friendCode
  ? `#${steamStats.friendCode}`
  : '----'
```

```tsx
<span className="font-headline-xl text-headline-xl group-hover:hidden">
  {ownedGamesCount}
</span>

<span className="font-headline-xl text-headline-xl group-hover:hidden">
  {recentPlayHours}
</span>

<span className="font-headline-xl text-[clamp(14px,2vw,24px)] break-all text-center leading-tight">
  {friendCode}
</span>
```

## 10. 검증

```bash
npm.cmd test -- steam.service.spec.ts --runInBand
npm.cmd run lint
npm.cmd run build
npm.cmd test -- --runInBand
npm.cmd run build
git diff --check
```

핵심 테스트는 외부 Steam API를 실제 호출하지 않고 `axios.get`을 mock 처리해 보유 게임, 최근 플레이, 도전과제 합산 결과를 검증한다.
