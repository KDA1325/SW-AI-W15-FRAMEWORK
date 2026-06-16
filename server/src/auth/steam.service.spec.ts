import axios from 'axios'
import { SteamService } from './steam.service'

describe('SteamService OpenID linking', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('builds a Steam OpenID login URL from SERVER_URL', () => {
    const service = new SteamService(
      {
        get: jest.fn((key: string) =>
          key === 'SERVER_URL' ? 'https://api.gjc.test/' : undefined,
        ),
      } as never,
      {} as never,
    )

    const loginUrl = new URL(service.buildOpenIdLoginUrl())

    expect(loginUrl.origin).toBe('https://steamcommunity.com')
    expect(loginUrl.searchParams.get('openid.mode')).toBe('checkid_setup')
    expect(loginUrl.searchParams.get('openid.realm')).toBe(
      'https://api.gjc.test',
    )
    expect(loginUrl.searchParams.get('openid.return_to')).toBe(
      'https://api.gjc.test/auth/steam/openid/callback',
    )
  })

  it('builds a client profile redirect with callback status', () => {
    const service = new SteamService(
      {
        get: jest.fn((key: string) =>
          key === 'CLIENT_URL' ? 'https://app.gjc.test/' : undefined,
        ),
      } as never,
      {} as never,
    )

    expect(
      service.profileRedirectUrl({
        connected: false,
        error: 'Steam OpenID verification failed.',
        errorCode: 'openid_failed',
        steamId: null,
      }),
    ).toBe(
      'https://app.gjc.test/profile?steam=failed&steam_error=openid_failed',
    )
  })

  it('aggregates linked Steam stats from owned, recent, and achievement APIs', async () => {
    const repository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'user-1',
        steamId: '76561197960265729',
      }),
    }
    const service = new SteamService(
      {
        get: jest.fn((key: string) =>
          key === 'STEAM_WEB_API_KEY' ? 'steam-key' : undefined,
        ),
      } as never,
      repository as never,
    )
    const axiosGet = jest.spyOn(axios, 'get')

    axiosGet
      .mockResolvedValueOnce({
        data: {
          response: {
            game_count: 2,
            games: [
              {
                appid: 10,
                img_icon_url: 'icon-a',
                name: 'Recent Quest',
                playtime_2weeks: 90,
                playtime_forever: 240,
              },
              {
                appid: 20,
                name: 'Archive RPG',
                playtime_forever: 480,
              },
            ],
          },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          response: {
            games: [
              {
                appid: 10,
                img_icon_url: 'icon-a',
                name: 'Recent Quest',
                playtime_2weeks: 90,
                playtime_forever: 240,
              },
            ],
            total_count: 1,
          },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          playerstats: {
            achievements: [{ achieved: 1 }, { achieved: 0 }],
          },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          playerstats: {
            achievements: [{ achieved: 1 }],
          },
        },
      } as never)

    const result = await service.getLinkedStats('user-1')

    expect(result.connected).toBe(true)
    expect(result.stats?.ownedGamesCount).toBe(2)
    expect(result.stats?.recentPlaytimeMinutes).toBe(90)
    expect(result.stats?.recentWindowDays).toBe(14)
    expect(result.stats?.achievementGamesChecked).toBe(2)
    expect(result.stats?.achievementsUnlocked).toBe(2)
    expect(result.stats?.achievementsTotal).toBe(3)
    expect(result.stats?.friendCode).toBe('1')
    expect(result.stats?.recentGames[0]).toMatchObject({
      appId: 10,
      imageUrl:
        'https://media.steampowered.com/steamcommunity/public/images/apps/10/icon-a.jpg',
      name: 'Recent Quest',
      playtimeMinutes: 90,
    })
  })

  it('returns a private profile state when game details are unavailable', async () => {
    const service = new SteamService(
      {
        get: jest.fn((key: string) =>
          key === 'STEAM_WEB_API_KEY' ? 'steam-key' : undefined,
        ),
      } as never,
      {
        findOneBy: jest.fn().mockResolvedValue({
          id: 'user-1',
          steamId: '76561197960265729',
        }),
      } as never,
    )
    const axiosGet = jest.spyOn(axios, 'get')

    axiosGet
      .mockResolvedValueOnce({ data: { response: {} } } as never)
      .mockResolvedValueOnce({ data: { response: { games: [] } } } as never)

    const result = await service.getLinkedStats('user-1')

    expect(result.connected).toBe(false)
    expect(result.errorCode).toBe('private_profile')
    expect(result.stats).toBeNull()
  })
})
