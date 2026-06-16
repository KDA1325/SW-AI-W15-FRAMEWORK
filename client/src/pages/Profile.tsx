import { useEffect, useState } from 'react'
import { api, getApiErrorMessage } from '../api'
import { useAuth } from '../auth/AuthContext'
import EditProfileModal from './EditProfileModal'
import PageChrome from './PageChrome'

import '../styles/Profile.css'

const profileImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB2INfqYDy75U9V3EX90R4EVkkD1_HaUwUv8FtkImhBQBzInCho3Qs90M5KMn8BVDWnL6Q_2wcM3igbt7dpC0WOZ2Iefo5FZGkIbZEnmyB3ByvC98bl--faX-AfhY3_KZkFnbNfai1gnQwDNkE1uA0qo5as3JD8wSdy3a_8pK3ABjd2UXs5dJMuObGcJJYwNU2zGsDgLZladYk41fFUUMwP8JCqBLaZWxmMiS5QaRxzn5WvVInQYKw33pCwk4HUbkQOEdp_Q7Tx7d8y'

const fallbackBio =
  'Retro games, slow criticism, and difficult endings. Recently analyzing logged play data.'

const coverImages = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAspADwKDJ6DvPCJ3GhUPZadfHCjAIhcYp_cYZeQEhNQbSDN5XM24GdRqMY_7hPbAKQArEi5g_237tI41rLd8MJ9rihg7TTlEPqTOw6XY03gyTysuoC7Lp_t3kgpwZF7pj869dqx_DLY6q5c6mQzMXIEevrmAMKm78e2uPTV9vdrcgdAIImWbI6dxYmfLwDXoTEp9dO1wREBf9wsAuy8NXQPuQ681-5pnCwG1PZq-ifmx-oFfOGfgsiYby-4U3CnmToYHCH3-X7BR4a',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBMee8GX1cJ9AMOLeE5wuaKs2Zh172HOZC8vY0da2LdPE4lTwkgkQgcqBdGkAe4tSSSSsuVlr19IXgk5O4k8r2LgWLoUsgg1gExLWdAfP82kD5wfDXwwl1PO923FVxyZqsXw4hVfHqhoQFqESIITuoPPBo4u8Mk-FTvWbR0Ye0cl1V5IamuC0hkgTDr4TbpZmbz00ZhXKOHJ2fiHdpdxpWFzxqPM0c-Jtz58Fpr1QvYO6cNBJ2vJHLpYPUws_VgqdVPM22UQyquQkVa',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAgBwSMvTQ_FIAKj_u5llK5db8h6X0PEBNhbW67rd566l3mZfdvVXioIbAiUZqeToCSGqUmag4xaRjr4voyklEtIMKk5OEcfP_qetSzKBEA-wahlAyHW315NBxRk1kUkxQpVKdkSz4TpKKuY5Udxsex-Bj0S_Znct0RZiyaTjCVAmavtI-C-oXCszFPdsdIP-Mr9opEa7QQZzz-vYkx27187qf63foS2wDAe0Oju5dpa6xP_lJY9DL1_GWCyRjLMXMxnLhhgpPsIK6J',
] as const

const archiveGames = [
  {
    cover: coverImages[0],
    date: '24. 10. 12',
    genre: 'Classic RPG Experience',
    platform: 'PC',
    rating: '4.5',
    title: 'SHADOWS OF AETERNA',
  },
  {
    cover: coverImages[1],
    date: '24. 10. 12',
    genre: 'Action Platformer',
    platform: 'PC',
    rating: '4.2',
    title: 'RUIN QUEST',
  },
  {
    cover: coverImages[2],
    date: '24. 10. 12',
    genre: 'Sci-fi Adventure',
    platform: 'PC',
    rating: '4.8',
    title: 'STARFALL: THE VOID',
    variant: 'dim',
  },
  {
    cover: coverImages[0],
    date: '24. 10. 12',
    genre: 'Classic RPG Experience',
    platform: 'PC',
    rating: '4.5',
    title: 'SHADOWS OF AETERNA',
  },
  {
    cover: coverImages[1],
    date: '24. 10. 12',
    genre: 'Action Platformer',
    platform: 'PC',
    rating: '4.2',
    title: 'RUIN QUEST',
  },
  {
    cover: coverImages[2],
    date: '24. 10. 12',
    genre: 'Sci-fi Adventure',
    platform: 'PC',
    rating: '4.8',
    title: 'STARFALL: THE VOID',
  },
  {
    cover: coverImages[0],
    date: '24. 10. 12',
    genre: 'Classic RPG Experience',
    platform: 'PC',
    rating: '4.5',
    title: 'SHADOWS OF AETERNA',
  },
  {
    cover: coverImages[1],
    date: '24. 10. 12',
    genre: 'Action Platformer',
    platform: 'PC',
    rating: '4.2',
    title: 'RUIN QUEST',
  },
  {
    cover: coverImages[2],
    date: '24. 10. 12',
    genre: 'Sci-fi Adventure',
    platform: 'PC',
    rating: '4.8',
    title: 'STARFALL: THE VOID',
  },
  {
    cover: coverImages[0],
    date: '24. 10. 12',
    genre: 'Classic RPG Experience',
    platform: 'PC',
    rating: '4.5',
    title: 'SHADOWS OF AETERNA',
  },
]

type SteamProfileResponse = {
  connected: boolean
  error: string | null
  errorCode:
    | 'missing_credentials'
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

function Profile() {
  const { refreshUser, user } = useAuth()
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [isSteamLoading, setIsSteamLoading] = useState(false)
  const [steamInput, setSteamInput] = useState(user?.steamId ?? '')
  const [steamMessage, setSteamMessage] = useState<string | null>(null)
  const [steamState, setSteamState] = useState<SteamProfileResponse | null>(
    null,
  )

  useEffect(() => {
    let isMounted = true

    const loadSteamProfile = async () => {
      try {
        const response = await api.get<SteamProfileResponse>(
          '/auth/steam/profile',
        )

        if (isMounted) {
          setSteamState(response.data)
          setSteamInput(response.data.steamId ?? user?.steamId ?? '')
        }
      } catch (error) {
        if (isMounted) {
          setSteamMessage(
            getApiErrorMessage(error, 'STEAM PROFILE LOAD FAILED'),
          )
        }
      }
    }

    void loadSteamProfile()

    return () => {
      isMounted = false
    }
  }, [user?.steamId])

  const linkSteamProfile = async () => {
    setIsSteamLoading(true)
    setSteamMessage(null)

    try {
      const response = await api.post<SteamProfileResponse>(
        '/auth/steam/link',
        {
          steamProfile: steamInput,
        },
      )
      setSteamState(response.data)

      // 연결에 성공했을 때만 /auth/me의 steamId도 다시 맞춥니다.
      if (response.data.connected) {
        setSteamMessage('STEAM_PROFILE_CONNECTED')
        await refreshUser()
      } else {
        setSteamMessage(response.data.error ?? 'STEAM_PROFILE_NOT_CONNECTED')
      }
    } catch (error) {
      setSteamMessage(getApiErrorMessage(error, 'STEAM PROFILE LINK FAILED'))
    } finally {
      setIsSteamLoading(false)
    }
  }

  const unlinkSteamProfile = async () => {
    setIsSteamLoading(true)
    setSteamMessage(null)

    try {
      const response =
        await api.delete<SteamProfileResponse>('/auth/steam/link')
      setSteamState(response.data)
      setSteamInput('')
      setSteamMessage('STEAM_PROFILE_DISCONNECTED')
      await refreshUser()
    } catch (error) {
      setSteamMessage(getApiErrorMessage(error, 'STEAM PROFILE UNLINK FAILED'))
    } finally {
      setIsSteamLoading(false)
    }
  }

  const steamProfile = steamState?.profile
  const gamerTags = user?.gamerTags?.length ? user.gamerTags : ['NO_TAGS']

  return (
    <PageChrome active="profile">
      <main className="profile-page flex-grow w-full max-w-[1200px] mx-auto px-8 py-20 flex flex-col gap-[80px]">
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="col-span-1 md:col-span-3 aspect-square border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-dim)] relative group overflow-hidden flex items-center justify-center p-2">
            <img
              alt="Pixelated retro monitor portrait"
              className="w-full h-full object-cover filter grayscale contrast-125 mix-blend-multiply opacity-80"
              src={user?.profileImageUrl ?? profileImage}
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
          <div className="md:col-span-4 flex flex-col gap-2">
            <span className="font-label-caps text-[var(--gjc-secondary)] text-[10px]">
              STEAM_PROFILE
            </span>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-[var(--gjc-primary)] uppercase">
              {steamProfile?.personaName ?? 'NOT_LINKED'}
            </h2>
            <span className="font-label-caps text-[10px] text-[var(--gjc-secondary)] uppercase">
              {steamState?.steamId
                ? `STEAMID_${steamState.steamId}`
                : 'STEAMID_EMPTY'}
            </span>
          </div>

          <div className="md:col-span-3 flex items-center justify-center">
            {steamProfile ? (
              <img
                alt={`${steamProfile.personaName} Steam avatar`}
                className="h-24 w-24 border-2 border-[var(--gjc-primary)] object-cover grayscale contrast-125"
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

          <div className="md:col-span-5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2">
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
              <button
                className="border-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] px-4 py-2 font-ui-button text-xs uppercase tracking-widest text-[var(--gjc-primary)] transition-colors hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isSteamLoading || !steamState?.steamId}
                onClick={unlinkSteamProfile}
                type="button"
              >
                UNLINK
              </button>
            </div>

            {steamProfile?.profileUrl ? (
              <a
                className="font-label-caps text-[10px] text-[var(--gjc-primary)] uppercase underline"
                href={steamProfile.profileUrl}
                rel="noreferrer"
                target="_blank"
              >
                OPEN_STEAM_PROFILE
              </a>
            ) : null}

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
          </div>
        </section>

        <hr className="border-t-2 border-[var(--gjc-primary)] border-dashed w-full" />

        <section className="grid grid-cols-2 gap-0 border-y-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] divide-x-2 divide-y-2 md:divide-y-0 divide-[var(--gjc-primary)] relative md:grid-cols-4">
          <div className="p-6 flex flex-col items-center justify-center hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-all step-transition group cursor-default relative hover:z-10 hover:scale-105 hover:ring-4 hover:ring-[var(--gjc-primary)]">
            <span className="font-label-caps text-[var(--gjc-secondary)] group-hover:text-[var(--gjc-surface-dim)] transition-colors duration-100 mb-2">
              GAMES
            </span>
            <span className="font-headline-xl text-headline-xl group-hover:hidden">
              142
            </span>
            <span className="hidden group-hover:flex font-[DotGothic16,sans-serif] text-[16px] text-center leading-tight">
              OWNED GAMES: 142 <br />
              RATED GAMES: 87
            </span>
          </div>
          <div className="p-6 flex flex-col items-center justify-center hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-all step-transition group cursor-default relative hover:z-10 hover:scale-105 hover:ring-4 hover:ring-[var(--gjc-primary)]">
            <span className="font-label-caps text-[var(--gjc-secondary)] group-hover:text-[var(--gjc-surface-dim)] transition-colors duration-100 mb-2">
              ACHIEVEMENTS
            </span>
            <span className="font-headline-xl text-headline-xl group-hover:hidden">
              120
            </span>
            <span className="hidden group-hover:flex font-[DotGothic16,sans-serif] text-[16px] text-center leading-tight">
              120 ACHIEVEMENTS <br />
              ACROSS 34 GAMES
            </span>
          </div>
          <div className="p-6 flex flex-col items-center justify-center hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-all step-transition group cursor-default relative hover:z-10 hover:scale-105 hover:ring-4 hover:ring-[var(--gjc-primary)]">
            <span className="font-label-caps text-[var(--gjc-secondary)] group-hover:text-[var(--gjc-surface-dim)] transition-colors duration-100 group-hover:hidden mb-2">
              WEEK PLAY
            </span>
            <span className="hidden group-hover:block font-label-caps text-[var(--gjc-surface-dim)] transition-colors duration-100">
              RECENT GAME
            </span>
            <span className="font-headline-xl text-headline-xl group-hover:hidden">
              34H
            </span>
            <span className="hidden group-hover:flex font-[DotGothic16,sans-serif] text-center leading-tight uppercase text-[16px]">
              SHADOWS OF AETERNA
              <br />
              ...
            </span>
          </div>
          <div className="p-6 flex flex-col items-center justify-center gap-2 hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-colors group cursor-default">
            <span className="font-label-caps text-[var(--gjc-secondary)] group-hover:text-[var(--gjc-surface-dim)]">
              GAMER ID
            </span>
            <span className="font-headline-xl text-headline-xl text-[24px]">
              #9904A
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex justify-between items-end border-b-2 border-[var(--gjc-primary)] pb-2">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tight text-[var(--gjc-primary)]">
              ARCHIVE_LOG
            </h2>
            <span className="font-label-caps text-[var(--gjc-secondary)]">
              DISPLAYING 10 RECORDS
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {archiveGames.map((game, index) => (
              <div
                className="flex flex-col gap-2"
                key={`${game.title}-${index}`}
              >
                <article
                  className={`aspect-[3/4] border-2 border-[var(--gjc-primary)] ${
                    game.variant === 'dim'
                      ? 'bg-[var(--gjc-surface-dim)]'
                      : 'bg-[var(--gjc-surface-container-lowest)]'
                  } flex flex-col justify-between hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-all duration-200 cursor-pointer group relative overflow-hidden p-0`}
                >
                  <div className="flex-grow flex flex-col overflow-hidden">
                    <img
                      alt="Game Cover"
                      className="w-full object-cover filter grayscale contrast-125 border-b-2 border-[var(--gjc-primary)] h-full"
                      src={game.cover}
                    />
                  </div>
                  <div className="absolute top-2 left-2 z-10">
                    <span className="font-label-caps text-[10px] border border-current px-1 bg-[var(--gjc-surface-container-lowest)] text-[var(--gjc-primary)]">
                      {game.platform}
                    </span>
                  </div>
                  <div className="hidden group-hover:flex absolute inset-0 z-20 flex-col items-center justify-center p-4 text-center bg-[var(--gjc-primary)] text-[var(--gjc-on-primary)]">
                    <h3 className="font-headline-lg-mobile text-[18px] mb-2">
                      {game.title}
                    </h3>
                    <p className="font-label-caps text-[14px] mb-1">
                      RATING: {game.rating}
                    </p>
                    <p className="font-body-md text-[12px] leading-tight">
                      {game.genre}
                    </p>
                  </div>
                </article>
                <span className="font-label-caps text-[10px] text-[var(--gjc-secondary)] uppercase">
                  LOGGED: {game.date}
                </span>
              </div>
            ))}
          </div>
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
