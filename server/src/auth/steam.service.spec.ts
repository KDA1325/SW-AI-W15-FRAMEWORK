import { SteamService } from './steam.service'

describe('SteamService OpenID linking', () => {
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
})
