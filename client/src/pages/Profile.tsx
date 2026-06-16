import { useEffect, useState } from 'react'
import { api, getApiErrorMessage } from '../api'
import { useAuth } from '../auth/AuthContext'
import EditProfileModal from './EditProfileModal'
import PageChrome from './PageChrome'
import type { PostListResponse } from './Journals'
import { resolveProfileImageUrl } from './profileImage'

import '../styles/Profile.css'

const fallbackBio =
  'Retro games, slow criticism, and difficult endings. Recently analyzing logged play data.'

type SteamProfileResponse = {
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

type SteamStatsResponse = {
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

type ProfileArchiveReview = {
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

function formatArchiveDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function formatRating(value: number | null) {
  if (typeof value !== 'number') {
    return '-'
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function reviewExcerpt(content: string) {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim())
  return firstLine?.trim().slice(0, 96) || 'NO_REVIEW_TEXT'
}

function gameInitials(title: string) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function Profile() {
  const { refreshUser, user } = useAuth()
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
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

    const loadSteamProfile = async () => {
      try {
        const response = await api.get<SteamProfileResponse>(
          '/auth/steam/profile',
        )

        if (isMounted) {
          setSteamState(response.data)
        }
      } catch (error) {
        if (isMounted) {
          setSteamMessage(
            getApiErrorMessage(error, 'STEAM PROFILE LOAD FAILED'),
          )
        }
      }

      try {
        const response = await api.get<SteamStatsResponse>('/auth/steam/stats')

        if (isMounted) {
          setSteamStatsState(response.data)
        }
      } catch (error) {
        if (isMounted) {
          setSteamStatsState({
            connected: false,
            error: getApiErrorMessage(error, 'STEAM STATS LOAD FAILED'),
            errorCode: 'external_api_error',
            stats: null,
            steamId: user?.steamId ?? null,
          })
        }
      }

      try {
        const params = new URLSearchParams({
          limit: '10',
          mine: 'true',
          sort: 'latest',
          type: 'REVIEW',
        })
        // Profile archive mirrors persisted review records, so no dummy cards stay in the render path.
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

    void loadSteamProfile()

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
    : '최근 플레이한 게임이 없습니다'
  // Steam's public recent-play endpoint exposes a two-week window, so the UI labels that fallback explicitly.
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

  return (
    <PageChrome active="profile">
      <main className="profile-page flex-grow w-full max-w-[1200px] mx-auto px-8 py-20 flex flex-col gap-[80px]">
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="col-span-1 md:col-span-3 aspect-square border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-dim)] relative group overflow-hidden flex items-center justify-center p-2">
            <img
              alt="Pixelated retro monitor portrait"
              className="w-full h-full object-cover filter contrast-125 mix-blend-multiply opacity-80"
              src={resolveProfileImageUrl(user?.profileImageUrl)}
            />
            <div className="absolute inset-0 border-4 border-[var(--gjc-primary)] m-2 pointer-events-none hidden group-hover:block" />
          </div>

          <div className="col-span-1 md:col-span-3 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-[var(--gjc-secondary)] text-[10px]">
                  ID_TERMINAL
                </span>
              </div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-[var(--gjc-primary)]">
                  {user?.nickname || 'PLAYER'}
                </h1>
                <button
                  className="w-5 h-5 flex items-center justify-center bg-transparent border-none hover:opacity-70 active:scale-95 transition-all duration-100"
                  onClick={() => setIsEditProfileOpen(true)}
                  title="Edit Profile"
                  type="button"
                >
                  <span className="material-symbols-outlined text-xl text-[var(--gjc-primary)]">
                    edit_square
                  </span>
                </button>
              </div>
            </div>

            <div className="flex-grow flex flex-col gap-2">
              <span className="font-label-caps text-[var(--gjc-secondary)] text-[10px]">
                SYSTEM_BIO
              </span>
              <p className="font-body-md text-[var(--gjc-on-surface)] leading-relaxed">
                {user?.bio ?? fallbackBio}
                <span className="animate-pulse">_</span>
              </p>
            </div>
          </div>

          <div className="col-span-1 md:col-span-6 flex flex-col justify-center items-end gap-4 relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-end gap-2 text-right">
              {gamerTags.map((tag) => (
                <span
                  className="font-headline-lg-mobile text-headline-lg-mobile text-[var(--gjc-primary)] hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] px-2 transition-colors inline-block"
                  key={tag}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-12 gap-6 border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="md:col-span-3 flex items-center justify-center">
            {steamProfile ? (
              <img
                alt={`${steamProfile.personaName} Steam avatar`}
                className="h-24 w-24 border-2 border-[var(--gjc-primary)] object-cover contrast-125"
                src={steamProfile.avatarUrl}
              />
            ) : (
              <div className="h-24 w-24 border-2 border-dashed border-[var(--gjc-primary)] flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-[var(--gjc-primary)]">
                  sports_esports
                </span>
              </div>
            )}
          </div>

          <div className="md:col-span-4 flex flex-col gap-2">
            <span className="font-label-caps text-[var(--gjc-secondary)] text-[10px]">
              STEAM_PROFILE
            </span>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-[var(--gjc-primary)] uppercase">
              {steamProfile?.personaName ?? 'NOT_LINKED'}
            </h2>
            {steamProfile?.profileUrl ? (
              <a
                className="font-label-caps text-[10px] text-[var(--gjc-primary)] uppercase !underline"
                href={steamProfile.profileUrl}
                rel="noreferrer"
                target="_blank"
              >
                OPEN_STEAM_PROFILE
              </a>
            ) : null}
            {/* <span className="font-label-caps text-[10px] text-[var(--gjc-secondary)] uppercase">
              {steamState?.steamId
                ? `STEAMID_${steamState.steamId}`
                : 'STEAMID_EMPTY'}
            </span> */}
          </div>

          <div className="md:col-span-5 flex flex-col gap-3">
            <button
              className="font-label-caps border-2 border-[var(--gjc-primary)] bg-[var(--gjc-primary)] px-4 py-3 font-ui-button text-xs uppercase tracking-widest text-[var(--gjc-on-primary)] transition-colors hover:bg-[var(--gjc-surface-container-lowest)] hover:text-[var(--gjc-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSteamLoading}
              onClick={
                steamState?.steamId ? unlinkSteamProfile : startSteamOpenIdLink
              }
              type="button"
            >
              {steamState?.steamId ? 'STEAM_LOGOUT' : 'STEAM_LOGIN'}
            </button>

            {steamMessage ? (
              <p className="font-label-caps text-[10px] uppercase text-[var(--gjc-secondary)]">
                {steamMessage}
              </p>
            ) : null}

            {steamState?.errorCode ? (
              <span className="w-fit border border-[var(--gjc-primary)] px-2 py-1 font-label-caps text-[10px] uppercase text-[var(--gjc-primary)]">
                {steamState.errorCode}
              </span>
            ) : null}

            {steamStatsState?.error ? (
              <p className="font-label-caps text-[10px] uppercase text-[var(--gjc-secondary)]">
                STEAM_STATS: {steamStatsState.error}
              </p>
            ) : null}
          </div>
        </section>

        <hr className="border-t-2 border-[var(--gjc-primary)] border-dashed w-full" />

        <section className="grid grid-cols-2 gap-0 border-y-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] divide-x-2 divide-y-2 md:divide-y-0 divide-[var(--gjc-primary)] relative md:grid-cols-4">
          <div className="p-6 flex flex-col items-center justify-center hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-all step-transition group cursor-default relative hover:z-10 hover:scale-105 hover:ring-4 hover:ring-[var(--gjc-primary)]">
            <span className="font-label-caps text-[var(--gjc-secondary)] group-hover:text-[var(--gjc-surface-dim)] transition-colors duration-100 mb-2">
              GAMES
            </span>
            <span className="font-headline-xl text-headline-xl group-hover:hidden">
              {ownedGamesCount}
            </span>
            <span className="hidden group-hover:flex font-[DotGothic16,sans-serif] text-[16px] text-center leading-tight">
              보유 게임: {ownedGamesCount} <br />
              리뷰 남긴 게임: {reviewedGamesCount}
            </span>
          </div>
          <div className="p-6 flex flex-col items-center justify-center hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-all step-transition group cursor-default relative hover:z-10 hover:scale-105 hover:ring-4 hover:ring-[var(--gjc-primary)]">
            <span className="font-label-caps text-[var(--gjc-secondary)] group-hover:text-[var(--gjc-surface-dim)] transition-colors duration-100 mb-2">
              ACHIEVEMENTS
            </span>
            <span className="font-headline-xl text-headline-xl group-hover:hidden">
              {achievementsUnlocked}
            </span>
            <span className="hidden group-hover:flex font-[DotGothic16,sans-serif] text-[16px] text-center leading-tight">
              달성 도전과제: {achievementsUnlocked} <br />
              게임 {achievementGamesChecked}개의 도전과제 {achievementsUnlocked}개 달성
            </span>
          </div>
          <div className="p-6 flex flex-col items-center justify-center hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-all step-transition group cursor-default relative hover:z-10 hover:scale-105 hover:ring-4 hover:ring-[var(--gjc-primary)]">
            <span className="font-label-caps text-[var(--gjc-secondary)] group-hover:text-[var(--gjc-surface-dim)] transition-colors duration-100 group-hover:hidden mb-2">
              {recentWindowLabel}
            </span>
            <span className="hidden group-hover:block font-label-caps text-[var(--gjc-surface-dim)] transition-colors duration-100">
              RECENT GAME
            </span>
            <span className="font-headline-xl text-headline-xl group-hover:hidden">
              {recentPlayHours}
            </span>
            <span className="hidden group-hover:flex font-[DotGothic16,sans-serif] text-center leading-tight uppercase text-[16px]">
              {recentGameTitles}
              {/* <br />
              {recentPlayHours} */}
            </span>
          </div>
          <div className="p-6 flex flex-col items-center justify-center gap-2 hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-colors group cursor-default">
            <span className="font-label-caps text-[var(--gjc-secondary)] group-hover:text-[var(--gjc-surface-dim)]">
              스팀 친구 코드
            </span>
            <span className="font-headline-lg break-all text-center leading-tight">
              {friendCode}
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex justify-between items-end border-b-2 border-[var(--gjc-primary)] pb-2">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tight text-[var(--gjc-primary)]">
              ARCHIVE_LOG
            </h2>
            <span className="font-label-caps text-[var(--gjc-secondary)]">
              {archiveRecordLabel}
            </span>
          </div>

          {archiveMessage ? (
            <p className="font-label-caps text-[10px] uppercase text-[var(--gjc-secondary)]">
              {archiveMessage}
            </p>
          ) : null}

          {archiveReviews.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {archiveReviews.map((post) => {
                const game = post.game
                const platform = game.platforms?.[0] ?? 'DB'

                return (
                  <div className="flex flex-col gap-2" key={post.id}>
                    <article className="aspect-[3/4] border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] flex flex-col justify-between hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-all duration-200 cursor-pointer group relative overflow-hidden p-0">
                      <div className="flex-grow flex flex-col overflow-hidden">
                        {game.imageUrl ? (
                          <img
                            alt={`${game.title} cover`}
                            className="w-full object-cover filter grayscale contrast-125 border-b-2 border-[var(--gjc-primary)] h-full"
                            src={game.imageUrl}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[var(--gjc-surface-dim)] font-headline-xl text-5xl text-[var(--gjc-primary)]">
                            {gameInitials(game.title) || '??'}
                          </div>
                        )}
                      </div>
                      <div className="absolute top-2 left-2 z-10">
                        <span className="font-label-caps text-[10px] border border-current px-1 bg-[var(--gjc-surface-container-lowest)] text-[var(--gjc-primary)]">
                          {platform}
                        </span>
                      </div>
                      <div className="hidden group-hover:flex absolute inset-0 z-20 flex-col items-center justify-center p-4 text-center bg-[var(--gjc-primary)] text-[var(--gjc-on-primary)]">
                        <h3 className="font-headline-lg-mobile text-[18px] mb-2">
                          {game.title}
                        </h3>
                        <p className="font-label-caps text-[14px] mb-1">
                          RATING: {formatRating(post.rating)}
                        </p>
                        <p className="font-body-md text-[12px] leading-tight">
                          {reviewExcerpt(post.content)}
                        </p>
                      </div>
                    </article>
                    <span className="font-label-caps text-[10px] text-[var(--gjc-secondary)] uppercase">
                      LOGGED: {formatArchiveDate(post.createdAt)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="border-2 border-dashed border-[var(--gjc-primary)] p-8 text-center font-label-caps text-[10px] uppercase text-[var(--gjc-secondary)]">
              NO_REVIEW_LOGS
            </div>
          )}
        </section>
      </main>

      <EditProfileModal
        currentUser={user}
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        onSaved={refreshUser}
      />
    </PageChrome>
  )
}

export default Profile
