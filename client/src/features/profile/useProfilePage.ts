import { useEffect, useState } from 'react'
import { api, getApiErrorMessage } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import type { PostListResponse } from '../../types/posts'

export type SteamProfileResponse = {
  connected: boolean
  error: string | null
  errorCode:
    | 'missing_credentials'
    | 'openid_failed'
    | 'private_profile'
    | 'profile_not_found'
    | 'unauthorized'
    | 'rate_limited'
    | 'network_error'
    | 'external_api_error'
    | null
  profile: {
    avatarUrl: string
    personaName: string
    profileUrl: string
    steamId: string
    visibilityState: number | null
  } | null
  steamId: string | null
}

export type SteamStatsResponse = {
  connected: boolean
  error: string | null
  errorCode:
    | 'missing_credentials'
    | 'openid_failed'
    | 'private_profile'
    | 'profile_not_found'
    | 'unauthorized'
    | 'rate_limited'
    | 'network_error'
    | 'external_api_error'
    | null
  stats: {
    achievementGamesChecked: number
    achievementsTotal: number
    achievementsUnlocked: number
    friendCode: string | null
    ownedGamesCount: number
    recentGames: {
      appId: number
      imageUrl: string | null
      name: string
      playtimeMinutes: number
      totalPlaytimeMinutes: number
    }[]
    recentPlaytimeMinutes: number
    recentWindowDays: number
    recentWindowLabel: 'STEAM_2W_FALLBACK'
  } | null
  steamId: string | null
}

export type ProfileArchiveReview = {
  content: string
  createdAt: string
  game: {
    id: string
    imageUrl?: string | null
    platforms?: string[]
    title: string
  }
  id: string
  rating: number | null
}

function apiUrl(path: string) {
  return new URL(
    path,
    api.defaults.baseURL ?? window.location.origin,
  ).toString()
}

function formatStatNumber(value: number | null | undefined) {
  return typeof value === 'number' ? value.toLocaleString('en-US') : '--'
}

function formatPlayHours(minutes: number | null | undefined) {
  if (typeof minutes !== 'number') {
    return '--'
  }

  return `${Math.round(minutes / 60)}H`
}

export function formatArchiveDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

export function formatRating(value: number | null) {
  if (typeof value !== 'number') {
    return '-'
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function reviewExcerpt(content: string) {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim())
  return firstLine?.trim().slice(0, 96) || 'NO_REVIEW_TEXT'
}

export function gameInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function useProfilePage() {
  const { refreshUser, user } = useAuth()
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isSteamInitialLoading, setIsSteamInitialLoading] = useState(true)
  const [isSteamLoading, setIsSteamLoading] = useState(false)
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
  const [steamState, setSteamState] = useState<SteamProfileResponse | null>(
    null,
  )
  const [steamStatsState, setSteamStatsState] =
    useState<SteamStatsResponse | null>(null)
  const [archiveReviews, setArchiveReviews] = useState<ProfileArchiveReview[]>(
    [],
  )
  const [archiveTotal, setArchiveTotal] = useState(0)
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadSteamData = async () => {
      setIsSteamInitialLoading(true)

      try {
        const [profileResult, statsResult] = await Promise.allSettled([
          api.get<SteamProfileResponse>('/auth/steam/profile'),
          api.get<SteamStatsResponse>('/auth/steam/stats'),
        ])

        if (!isMounted) {
          return
        }

        if (profileResult.status === 'fulfilled') {
          setSteamState(profileResult.value.data)
        } else {
          setSteamMessage(
            getApiErrorMessage(
              profileResult.reason,
              'STEAM PROFILE LOAD FAILED',
            ),
          )
        }

        if (statsResult.status === 'fulfilled') {
          setSteamStatsState(statsResult.value.data)
        } else {
          setSteamStatsState({
            connected: false,
            error: getApiErrorMessage(
              statsResult.reason,
              'STEAM STATS LOAD FAILED',
            ),
            errorCode: 'external_api_error',
            stats: null,
            steamId: user?.steamId ?? null,
          })
        }
      } finally {
        if (isMounted) {
          setIsSteamInitialLoading(false)
        }
      }
    }

    const loadArchiveReviews = async () => {
      try {
        const params = new URLSearchParams({
          limit: '10',
          mine: 'true',
          sort: 'latest',
          type: 'REVIEW',
        })
        const response = await api.get<PostListResponse<ProfileArchiveReview>>(
          `/posts?${params.toString()}`,
        )

        if (isMounted) {
          setArchiveReviews(response.data.items)
          setArchiveTotal(response.data.total)
          setArchiveMessage(null)
        }
      } catch (error) {
        if (isMounted) {
          setArchiveMessage(
            getApiErrorMessage(error, 'ARCHIVE LOG LOAD FAILED'),
          )
        }
      }
    }

    void loadSteamData()
    void loadArchiveReviews()

    return () => {
      isMounted = false
    }
  }, [user?.steamId])

  const startSteamOpenIdLink = () => {
    window.location.href = apiUrl('/auth/steam/openid')
  }

  const unlinkSteamProfile = async () => {
    setIsSteamLoading(true)
    setSteamMessage(null)

    try {
      const response =
        await api.delete<SteamProfileResponse>('/auth/steam/link')
      setSteamState(response.data)
      setSteamStatsState({
        connected: false,
        error: null,
        errorCode: null,
        stats: null,
        steamId: null,
      })
      setSteamMessage('STEAM_PROFILE_DISCONNECTED')
      await refreshUser()
    } catch (error) {
      setSteamMessage(getApiErrorMessage(error, 'STEAM PROFILE UNLINK FAILED'))
    } finally {
      setIsSteamLoading(false)
    }
  }

  const steamProfile = steamState?.profile
  const steamStats = steamStatsState?.stats
  const ownedGamesCount = formatStatNumber(steamStats?.ownedGamesCount)
  const reviewedGamesCount = formatStatNumber(archiveTotal)
  const achievementsUnlocked = formatStatNumber(
    steamStats?.achievementsUnlocked,
  )
  const achievementGamesChecked = formatStatNumber(
    steamStats?.achievementGamesChecked,
  )
  const recentPlayHours = formatPlayHours(steamStats?.recentPlaytimeMinutes)
  const recentGameTitles = steamStats?.recentGames.length
    ? steamStats.recentGames.map((game) => game.name).join(', ')
    : 'NO_RECENT_STEAM_GAMES'
  const recentWindowLabel = steamStats
    ? steamStats.recentWindowDays === 14
      ? '2W PLAY'
      : 'WEEK PLAY'
    : 'STEAM PLAY'
  const friendCode = steamStats?.friendCode
    ? `#${steamStats.friendCode}`
    : '----'
  const gamerTags = user?.gamerTags?.length ? user.gamerTags : ['NO_TAGS']
  const archiveRecordLabel = `DISPLAYING ${archiveReviews.length} RECORD${
    archiveReviews.length === 1 ? '' : 'S'
  } OF ${archiveTotal}`

  return {
    achievementGamesChecked,
    achievementsUnlocked,
    archiveMessage,
    archiveRecordLabel,
    archiveReviews,
    friendCode,
    gamerTags,
    isEditProfileOpen,
    isSteamInitialLoading,
    isSteamLoading,
    ownedGamesCount,
    recentGameTitles,
    recentPlayHours,
    recentWindowLabel,
    refreshUser,
    reviewedGamesCount,
    setIsEditProfileOpen,
    startSteamOpenIdLink,
    steamMessage,
    steamProfile,
    steamState,
    steamStatsState,
    unlinkSteamProfile,
    user,
  }
}
