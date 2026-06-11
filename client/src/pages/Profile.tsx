import { useState } from 'react'
import { Link } from 'react-router-dom'
import EditProfileModal from './EditProfileModal'
import '../styles/Profile.css'

const logoTop =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB_LxM4GjqvESEBDiByFsths6jve9ylqYMo_olMXVBHSuYy-3NdXqyqSUu_MazoCLjd3IEbFPYuTwy8_hbEUN2q43ouBcc9d76wDqPzpq8W0QIPjZNx-2fYN4lkG_IGySYggaCOUU6P-05QmXe56P052Pv5-ebOJgON4E_jZC_p1rjHZnJaf8AcXYdePKGjPaDD-e1mllNljL7TlS6r16g0jZZa1HiduOWE3nDi0tc4Jo76Li1je2W1qV-eQG__tsDhAVlpQcgJaK3J'

const logoFooter =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBVOfUJJVLaTVQ1VrGuNFmBUXe_Sp53aEIeYJP1TElA3ZZxNpHQUAb7wJBLE9i-NU7QmLLAimringF0bEzEempCNdVjPp-sYfqGLf45T2H3qpAMBGAzd8x-CCE9VSdtHoghWMNKjA94shQekTdcKSrhdoiId8o5pCJBqxTxRMhhioRdGxl9oECghIug_--mFmnRpgbNkPs9zF8wiF-k1LOnJo6IvZJfUE2yx0WKDlQ2lIlRUlV3Wj7EhsbFKloCnf4tNmrDjscGN7D2'

const profileImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB2INfqYDy75U9V3EX90R4EVkkD1_HaUwUv8FtkImhBQBzInCho3Qs90M5KMn8BVDWnL6Q_2wcM3igbt7dpC0WOZ2Iefo5FZGkIbZEnmyB3ByvC98bl--faX-AfhY3_KZkFnbNfai1gnQwDNkE1uA0qo5as3JD8wSdy3a_8pK3ABjd2UXs5dJMuObGcJJYwNU2zGsDgLZladYk41fFUUMwP8JCqBLaZWxmMiS5QaRxzn5WvVInQYKw33pCwk4HUbkQOEdp_Q7Tx7d8y'

const editIcon =
  'https://lh3.googleusercontent.com/aida/AP1WRLsSTNtuQ7h1VU8TpNNl_4p2wG2th7UobNdrCFuDPkANbYeoq0wvUhiBCZ8Tf-sJCQU1yy0x61qPVv6ng0yhquEuRpxtyEtqafwKWOirfsBCEefADv5gJfuXcv9XKFQ6Kp39wnK8iPJKRVFPhxP6xZJEg1oINdgTUF0IERUliw4P1_xBFe_8vQxADtNr14TV2r81dvOtEgT4EqyTCmKVtAM_V4R8IBdURPOu2E77th_NpxvJkXddWU3YY_g'

const coverImages = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAspADwKDJ6DvPCJ3GhUPZadfHCjAIhcYp_cYZeQEhNQbSDN5XM24GdRqMY_7hPbAKQArEi5g_237tI41rLd8MJ9rihg7TTlEPqTOw6XY03gyTysuoC7Lp_t3kgpwZF7pj869dqx_DLY6q5c6mQzMXIEevrmAMKm78e2uPTV9vdrcgdAIImWbI6dxYmfLwDXoTEp9dO1wREBf9wsAuy8NXQPuQ681-5pnCwG1PZq-ifmx-oFfOGfgsiYby-4U3CnmToYHCH3-X7BR4a',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBMee8GX1cJ9AMOLeE5wuaKs2Zh172HOZC8vY0da2LdPE4lTwkgkQgcqBdGkAe4tSSSSsuVlr19IXgk5O4k8r2LgWLoUsgg1gExLWdAfP82kD5wfDXwwl1PO923FVxyZqsXw4hVfHqhoQFqESIITuoPPBo4u8Mk-FTvWbR0Ye0cl1V5IamuC0hkgTDr4TbpZmbz00ZhXKOHJ2fiHdpdxpWFzxqPM0c-Jtz58Fpr1QvYO6cNBJ2vJHLpYPUws_VgqdVPM22UQyquQkVa',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAgBwSMvTQ_FIAKj_u5llK5db8h6X0PEBNhbW67rd566l3mZfdvVXioIbAiUZqeToCSGqUmag4xaRjr4voyklEtIMKk5OEcfP_qetSzKBEA-wahlAyHW315NBxRk1kUkxQpVKdkSz4TpKKuY5Udxsex-Bj0S_Znct0RZiyaTjCVAmavtI-C-oXCszFPdsdIP-Mr9opEa7QQZzz-vYkx27187qf63foS2wDAe0Oju5dpa6xP_lJY9DL1_GWCyRjLMXMxnLhhgpPsIK6J',
] as const

const archiveGames = [
  { cover: coverImages[0], date: '24. 10. 12', genre: 'Classic RPG Experience', platform: 'PC', rating: '4.5', title: 'SHADOWS OF AETERNA' },
  { cover: coverImages[1], date: '24. 10. 12', genre: 'Action Platformer', platform: 'PC', rating: '4.2', title: 'RUIN QUEST' },
  { cover: coverImages[2], date: '24. 10. 12', genre: 'Sci-fi Adventure', platform: 'PC', rating: '4.8', title: 'STARFALL: THE VOID', variant: 'dim' },
  { cover: coverImages[0], date: '24. 10. 12', genre: 'Classic RPG Experience', platform: 'PC', rating: '4.5', title: 'SHADOWS OF AETERNA' },
  { cover: coverImages[1], date: '24. 10. 12', genre: 'Action Platformer', platform: 'PC', rating: '4.2', title: 'RUIN QUEST' },
  { cover: coverImages[2], date: '24. 10. 12', genre: 'Sci-fi Adventure', platform: 'PC', rating: '4.8', title: 'STARFALL: THE VOID' },
  { cover: coverImages[0], date: '24. 10. 12', genre: 'Classic RPG Experience', platform: 'PC', rating: '4.5', title: 'SHADOWS OF AETERNA' },
  { cover: coverImages[1], date: '24. 10. 12', genre: 'Action Platformer', platform: 'PC', rating: '4.2', title: 'RUIN QUEST' },
  { cover: coverImages[2], date: '24. 10. 12', genre: 'Sci-fi Adventure', platform: 'PC', rating: '4.8', title: 'STARFALL: THE VOID' },
  { cover: coverImages[0], date: '24. 10. 12', genre: 'Classic RPG Experience', platform: 'PC', rating: '4.5', title: 'SHADOWS OF AETERNA' },
]

function Profile() {
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)

  return (
    <div className="profile-page text-on-surface font-body-md antialiased min-h-screen flex flex-col selection:bg-primary selection:text-on-primary">
      <header className="sticky w-full top-0 border-b-2 border-primary bg-surface-container-lowest z-50">
        <div className="flex justify-between items-center px-margin py-4 w-full max-w-container-max mx-auto">
          <Link className="block w-[180px] hover:opacity-80 transition-opacity group" title="Go to Title Screen" to="/profile">
            <img
              alt="Gaming Journal Club Logo"
              className="h-12 w-auto object-contain transition-transform duration-200 animate-logo-float mt-[2px]"
              src={logoTop}
            />
          </Link>

          <nav className="hidden md:flex gap-8 items-center font-label-caps text-label-caps">
            <Link className="relative nav-link-indicator text-primary underline decoration-4 underline-offset-8 px-2 py-1 active:scale-95 transition-transform hover:bg-primary hover:text-on-primary transition-colors duration-100" to="/profile">
              PROFILE
            </Link>
            <Link className="relative nav-link-indicator text-secondary hover:text-primary px-2 py-1 active:scale-95 transition-transform hover:bg-primary hover:text-on-primary transition-colors duration-100 hover:text-white" to="/recommend">
              RECOMMEND
            </Link>
            <Link className="relative nav-link-indicator text-secondary hover:text-primary px-2 py-1 active:scale-95 transition-transform hover:bg-primary hover:text-on-primary transition-colors duration-100 hover:text-white" to="/journals">
              JOURNALS
            </Link>
            <Link className="relative nav-link-indicator text-secondary hover:text-primary px-2 py-1 active:scale-95 transition-transform hover:bg-primary hover:text-on-primary transition-colors duration-100 hover:text-white" to="/timeline">
              TIMELINE
            </Link>
          </nav>

          <div className="hidden md:flex gap-6 items-center font-label-caps text-label-caps">
            <a className="text-secondary hover:text-primary hover:underline decoration-2 underline-offset-4" href="#settings">
              SETTINGS
            </a>
            <Link className="text-primary border-2 border-primary px-4 py-2 hover:bg-primary hover:text-on-primary transition-colors duration-100 uppercase" to="/login">
              LOGOUT
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-container-max mx-auto px-margin py-20 flex flex-col gap-[80px]">
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="col-span-1 md:col-span-3 aspect-square border-2 border-primary bg-surface-dim relative group overflow-hidden flex items-center justify-center p-2">
            <img
              alt="Pixelated retro monitor portrait"
              className="w-full h-full object-cover filter grayscale contrast-125 mix-blend-multiply opacity-80"
              src={profileImage}
            />
            <div className="absolute inset-0 border-4 border-primary m-2 pointer-events-none hidden group-hover:block" />
          </div>

          <div className="col-span-1 md:col-span-3 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-secondary text-[10px]">ID_TERMINAL</span>
              </div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary">PLAYER1</h1>
                <button
                  className="w-5 h-5 flex items-center justify-center bg-transparent border-none hover:opacity-70 active:scale-95 transition-all duration-100"
                  onClick={() => setIsEditProfileOpen(true)}
                  title="Edit Profile"
                  type="button"
                >
                  <img
                    alt="Edit Icon"
                    className="w-full h-full object-contain grayscale contrast-125"
                    src={editIcon}
                  />
                </button>
              </div>
            </div>

            <div className="flex-grow flex flex-col gap-2">
              <span className="font-label-caps text-secondary text-[10px]">SYSTEM_BIO</span>
              <p className="font-body-md text-on-surface leading-relaxed">
                Retro games, slow criticism, and difficult endings. Recently analyzing
                logged play data.
                <span className="animate-pulse">_</span>
              </p>
            </div>
          </div>

          <div className="col-span-1 md:col-span-6 flex flex-col justify-center items-end gap-4 relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-end gap-2 text-right">
              {['# HARDCORE_GAMER', '# NARRATIVE_FOCUSED', '# CRPG_MANIA'].map((tag) => (
                <span
                  className="font-headline-lg-mobile text-headline-lg-mobile text-primary hover:bg-primary hover:text-on-primary px-2 transition-colors inline-block"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        <hr className="border-t-2 border-primary border-dashed w-full" />

        <section className="grid grid-cols-2 gap-0 border-y-2 border-primary bg-surface-container-lowest divide-x-2 divide-y-2 md:divide-y-0 divide-primary relative md:grid-cols-4">
          <div className="p-6 flex flex-col items-center justify-center hover:bg-primary hover:text-on-primary transition-all step-transition group cursor-default relative hover:z-10 hover:scale-105 hover:ring-4 hover:ring-primary">
            <span className="font-label-caps text-secondary group-hover:text-surface-dim transition-colors duration-100 mb-2">GAMES</span>
            <span className="font-headline-xl text-headline-xl group-hover:hidden">142</span>
            <span className="hidden group-hover:flex font-headline-lg text-[16px] text-center leading-tight">
              OWNED GAMES: 142 <br />
              RATED GAMES: 87
            </span>
          </div>
          <div className="p-6 flex flex-col items-center justify-center hover:bg-primary hover:text-on-primary transition-all step-transition group cursor-default relative hover:z-10 hover:scale-105 hover:ring-4 hover:ring-primary">
            <span className="font-label-caps text-secondary group-hover:text-surface-dim transition-colors duration-100 mb-2">ACHIEVEMENTS</span>
            <span className="font-headline-xl text-headline-xl group-hover:hidden">120</span>
            <span className="hidden group-hover:flex font-headline-lg text-[16px] text-center leading-tight">
              120 ACHIEVEMENTS <br />
              ACROSS 34 GAMES
            </span>
          </div>
          <div className="p-6 flex flex-col items-center justify-center hover:bg-primary hover:text-on-primary transition-all step-transition group cursor-default relative hover:z-10 hover:scale-105 hover:ring-4 hover:ring-primary">
            <span className="font-label-caps text-secondary group-hover:text-surface-dim transition-colors duration-100 group-hover:hidden mb-2">
              WEEK PLAY
            </span>
            <span className="hidden group-hover:block font-label-caps text-surface-dim transition-colors duration-100">
              RECENT GAME
            </span>
            <span className="font-headline-xl text-headline-xl group-hover:hidden">34H</span>
            <span className="hidden group-hover:flex font-headline-lg text-center leading-tight uppercase text-[16px]">
              SHADOWS OF AETERNA
              <br />
              ...
            </span>
          </div>
          <div className="p-6 flex flex-col items-center justify-center gap-2 hover:bg-primary hover:text-on-primary transition-colors group cursor-default">
            <span className="font-label-caps text-secondary group-hover:text-surface-dim">GAMER ID</span>
            <span className="font-headline-xl text-headline-xl text-[24px]">#9904A</span>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex justify-between items-end border-b-2 border-primary pb-2">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-tight text-primary">
              ARCHIVE_LOG
            </h2>
            <span className="font-label-caps text-secondary">DISPLAYING 10 RECORDS</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {archiveGames.map((game, index) => (
              <div className="flex flex-col gap-2" key={`${game.title}-${index}`}>
                <article
                  className={`aspect-[3/4] border-2 border-primary ${game.variant === 'dim' ? 'bg-surface-dim' : 'bg-surface-container-lowest'
                    } flex flex-col justify-between hover:bg-primary hover:text-on-primary transition-all duration-200 cursor-pointer group relative overflow-hidden p-0`}
                >
                  <div className="flex-grow flex flex-col overflow-hidden">
                    <img
                      alt="Game Cover"
                      className="w-full object-cover filter grayscale contrast-125 border-b-2 border-primary h-full"
                      src={game.cover}
                    />
                  </div>
                  <div className="absolute top-2 left-2 z-10">
                    <span className="font-label-caps text-[10px] border border-current px-1 bg-surface-container-lowest text-primary">
                      {game.platform}
                    </span>
                  </div>
                  <div className="hidden group-hover:flex absolute inset-0 z-20 flex-col items-center justify-center p-4 text-center bg-primary text-on-primary">
                    <h3 className="font-headline-lg-mobile text-[18px] mb-2">{game.title}</h3>
                    <p className="font-label-caps text-[14px] mb-1">RATING: {game.rating}</p>
                    <p className="font-body-md text-[12px] leading-tight">{game.genre}</p>
                  </div>
                </article>
                <span className="font-label-caps text-[10px] text-secondary uppercase">
                  LOGGED: {game.date}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="w-full border-t-2 border-primary mt-20 bg-surface-container-lowest">
        <div className="flex flex-col md:flex-row justify-between items-center px-margin py-gutter w-full max-w-container-max mx-auto gap-8 md:gap-0">
          <div className="w-[180px] flex items-center justify-center md:justify-start">
            <img
              alt="Gaming Journal Club Logo"
              className="h-12 w-auto object-contain"
              src={logoFooter}
            />
          </div>
          <nav className="flex flex-wrap justify-center md:justify-end gap-6 font-label-caps text-label-caps">
            <a className="text-secondary hover:text-primary hover:underline decoration-1 transition-colors" href="#terms">
              Terms
            </a>
            <a className="text-secondary hover:text-primary hover:underline decoration-1 transition-colors" href="#privacy">
              Privacy
            </a>
            <a className="text-secondary hover:text-primary hover:underline decoration-1 transition-colors" href="#archive">
              Archive
            </a>
            <a className="text-secondary hover:text-primary hover:underline decoration-1 transition-colors" href="#contact">
              Contact
            </a>
          </nav>
          <div className="font-label-caps text-label-caps text-primary w-full md:w-auto text-center mt-4 md:mt-0 order-last md:order-none">
            2026 GAMING JOURNAL CLUB. ALL RIGHTS RESERVED.
          </div>
        </div>
      </footer>

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
    </div>
  )
}

export default Profile
