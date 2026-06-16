import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import axios, { AxiosError } from 'axios'
import { Repository } from 'typeorm'
import { User } from './entities/user.entity'

type SteamProfileErrorCode =
  | 'missing_credentials'
  | 'openid_failed'
  | 'profile_not_found'
  | 'unauthorized'
  | 'rate_limited'
  | 'network_error'
  | 'external_api_error'

type SteamPlayerSummary = {
  avatar: string
  avatarfull: string
  avatarmedium: string
  communityvisibilitystate?: number
  lastlogoff?: number
  personaname: string
  profileurl: string
  profilestate?: number
  steamid: string
}

type SteamProfile = {
  avatarUrl: string
  personaName: string
  profileUrl: string
  steamId: string
  visibilityState: number | null
}

type SteamProfileResponse = {
  connected: boolean
  error: string | null
  errorCode: SteamProfileErrorCode | null
  profile: SteamProfile | null
  steamId: string | null
}

type SteamOpenIdLinkResponse = {
  connected: boolean
  error: string | null
  errorCode: SteamProfileErrorCode | null
  steamId: string | null
}

type SteamVanityResponse = {
  response?: {
    steamid?: string
    success?: number
  }
}

type SteamSummaryResponse = {
  response?: {
    players?: SteamPlayerSummary[]
  }
}

@Injectable()
export class SteamService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getLinkedProfile(userId: string): Promise<SteamProfileResponse> {
    const user = await this.userRepository.findOneBy({ id: userId })

    if (!user?.steamId) {
      return {
        connected: false,
        error: null,
        errorCode: null,
        profile: null,
        steamId: null,
      }
    }

    return this.fetchProfile(user.steamId)
  }

  async linkProfile(
    userId: string,
    rawProfile: string,
  ): Promise<SteamProfileResponse> {
    const parsed = this.parseSteamProfileInput(rawProfile)
    const steamId =
      parsed.kind === 'steamid'
        ? parsed.value
        : await this.resolveVanityUrl(parsed.value)

    if (typeof steamId !== 'string') {
      return steamId
    }

    const profile = await this.fetchProfile(steamId)

    if (profile.connected) {
      await this.userRepository.update(userId, { steamId: profile.steamId })
    }

    return profile
  }

  async unlinkProfile(userId: string) {
    await this.userRepository.update(userId, { steamId: null })

    return {
      connected: false,
      error: null,
      errorCode: null,
      profile: null,
      steamId: null,
    } satisfies SteamProfileResponse
  }

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

  profileRedirectUrl(result: SteamOpenIdLinkResponse) {
    const params = new URLSearchParams()
    params.set('steam', result.connected ? 'connected' : 'failed')

    if (result.errorCode) {
      params.set('steam_error', result.errorCode)
    }

    return `${this.clientBaseUrl()}/profile?${params.toString()}`
  }

  private parseSteamProfileInput(
    rawProfile: string,
  ): { kind: 'steamid'; value: string } | { kind: 'vanity'; value: string } {
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

    try {
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
    } catch {
      return null
    }
  }

  private stringQueryValue(value: unknown) {
    return typeof value === 'string' ? value : null
  }

  private async resolveVanityUrl(
    vanityUrl: string,
  ): Promise<string | SteamProfileResponse> {
    const apiKey = this.apiKey()

    if (!apiKey) {
      return {
        connected: false,
        error: 'STEAM_WEB_API_KEY is required to resolve Steam vanity URLs.',
        errorCode: 'missing_credentials',
        profile: null,
        steamId: null,
      }
    }

    try {
      const response = await axios.get<SteamVanityResponse>(
        'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/',
        {
          params: {
            key: apiKey,
            vanityurl: vanityUrl,
          },
          timeout: 10_000,
        },
      )
      const steamId = response.data.response?.steamid

      if (!steamId) {
        return {
          connected: false,
          error: 'Steam vanity URL was not found.',
          errorCode: 'profile_not_found',
          profile: null,
          steamId: null,
        }
      }

      return steamId
    } catch (error) {
      return {
        ...this.externalError(error),
        connected: false,
        profile: null,
        steamId: null,
      }
    }
  }

  private async fetchProfile(steamId: string): Promise<SteamProfileResponse> {
    const apiKey = this.apiKey()

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

    try {
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

      if (!player) {
        return {
          connected: false,
          error: 'Steam profile was not found.',
          errorCode: 'profile_not_found',
          profile: null,
          steamId,
        }
      }

      return {
        connected: true,
        error: null,
        errorCode: null,
        profile: {
          avatarUrl: player.avatarfull || player.avatarmedium || player.avatar,
          personaName: player.personaname,
          profileUrl: player.profileurl,
          steamId: player.steamid,
          visibilityState: player.communityvisibilitystate ?? null,
        },
        steamId: player.steamid,
      }
    } catch (error) {
      return {
        ...this.externalError(error),
        connected: false,
        profile: null,
        steamId,
      }
    }
  }

  private externalError(error: unknown): {
    error: string
    errorCode: SteamProfileErrorCode
  } {
    if (!axios.isAxiosError(error)) {
      return {
        error: 'Steam API request failed.',
        errorCode: 'external_api_error',
      }
    }

    const status = (error as AxiosError).response?.status

    if (status === 401 || status === 403) {
      return {
        error: 'Steam API key is invalid or does not have permission.',
        errorCode: 'unauthorized',
      }
    }

    if (status === 429) {
      return {
        error: 'Steam API rate limit reached.',
        errorCode: 'rate_limited',
      }
    }

    if (!error.response) {
      return {
        error: 'Steam API network request failed.',
        errorCode: 'network_error',
      }
    }

    return {
      error: 'Steam API returned an unexpected response.',
      errorCode: 'external_api_error',
    }
  }

  private apiKey() {
    return this.config.get<string>('STEAM_WEB_API_KEY')?.trim() ?? ''
  }

  private serverBaseUrl() {
    return (
      this.config.get<string>('SERVER_URL')?.trim() || 'http://localhost:3000'
    ).replace(/\/+$/, '')
  }

  private clientBaseUrl() {
    return (
      this.config.get<string>('CLIENT_URL')?.trim() || 'http://localhost:5173'
    ).replace(/\/+$/, '')
  }
}
