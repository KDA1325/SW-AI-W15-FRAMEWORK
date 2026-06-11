import { useState } from 'react'
import { Link } from 'react-router-dom'
import RecommendAnalyzingModal from './RecommendAnalyzingModal'
import '../styles/Profile.css'
import '../styles/Recommend.css'

const logoUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB_LxM4GjqvESEBDiByFsths6jve9ylqYMo_olMXVBHSuYy-3NdXqyqSUu_MazoCLjd3IEbFPYuTwy8_hbEUN2q43ouBcc9d76wDqPzpq8W0QIPjZNx-2fYN4lkG_IGySYggaCOUU6P-05QmXe56P052Pv5-ebOJgON4E_jZC_p1rjHZnJaf8AcXYdePKGjPaDD-e1mllNljL7TlS6r16g0jZZa1HiduOWE3nDi0tc4Jo76Li1je2W1qV-eQG__tsDhAVlpQcgJaK3J'

const recommendationCards = [
  {
    badges: ['PC', 'STEAM'],
    cover:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDkWH8Rt6q2wJWsZaos0J6JV9mCJ6E55Vu4LZ-JuC9ehUh5T3uZhLEkS0Q4ygUikzdgw6kqmr1_41JAcJZBnXXDQ_SOoaBjG0kvTwJCiAE9y2QjcMmHBEBq9JCqEfcs0QzbGEptJKQGmBxSQhmyfqjpKslMuIx6bv-30KCveZvGZXLaR9kdyVwop16tS8zB0_JRFKkqQ0kCUAjsWu_k0XkJVmKyLUm3tEbi2-Y2l_EctNBKamTM_ohSZnwLste5P7qlt8o_ypEVe5II',
    genre: 'RPG / ROGUELIKE',
    title: 'ELDRITCH_VOID',
  },
  {
    badges: ['CONSOLE'],
    cover:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAlFEDZSWxFAo-HR5U0M7MXbZAhGvUD785QlaIeCRfegxjvkhElB-RwYfH06B9WuJCQoL93Y-mPoraGKN61sieKUqKzXfUOuyScACV2KiecT2-fLz6nfeUiQGULnchl5rV2cCK887T8SSfUplkMttAczQS6PDgYVzI6BeK4Bwhzl9EvuJfFNZcEFx85XDDFFCofGMu_CEDviBd3w3R0j_x1vSlMTQXd_X_Uojr2c2UxViWDDn5nXPGKCE9uWl666QT5SV1gkeYEIOzb',
    genre: 'ACTION / PLATFORMER',
    title: 'SYSTEM_CRITICAL',
  },
  {
    badges: ['MOBILE'],
    cover:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB1OgqYB14ytC_hzzQEX2-tnU7HvBau3nYm4S4Wkf6178S5zSQ1oHOErbw8g9GzCjYTIXBJE4teTNsQOdAk2aOdRsqNobC56rUkRjk1V3J8h6AcYP403cQsBL_e6SK56K8KY335fJd5x-1hWHFPBNwLdWMRpXqvQ7d65l6IpMXs7COg_79zNiqw6Bx4aoF0ZhKBYNVX6eg2RLm5fQ2QCAHcwYSnp_6O02JmVqaSYa4zat0Sf55clsWq0pgkqA1wjNdkI8sQOjzsi1jf',
    genre: 'PUZZLE / ADVENTURE',
    title: 'NEON_DRIFT_88',
  },
  {
    badges: ['PC'],
    cover:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBULMSe0jyJmVYB6RF6anX2A_NfpTyw-m8eGnPueA69ClPFJxQ6pFKIUREQwa2ajHL6AUiW0H-FLw7o36bHVyGe0MvOExkBbjLMNZLYmKu_Sy4PqdJB0Dfun-hLhM3ZnuNmZD0A0kzNmWg60rwExb9NgZQmNdGw5yJTZrtPviovdX-FvbXZ7CtOBNYiixJcHcfhXTeGdGt_3pvmgCJNnRcdYdvJVGJ16bHWsRcuNfxHa3IZq8AsWWE0lndhgyX_iU6fsveIgyQwMK3n',
    genre: 'SOULSLIKE / DARK',
    title: 'MONOLITH_X',
  },
]

const wordCloud = [
  { className: 'font-body-md text-2xl text-primary', label: 'QUIET', style: { left: '15%', top: '20%' } },
  { className: 'font-headline-xl text-5xl font-bold text-primary', label: 'TACTICAL', style: { left: '30%', top: '25%' } },
  { className: 'font-headline-lg text-3xl font-bold text-primary', label: 'NARRATIVE', style: { right: '25%', top: '15%' } },
  { className: 'font-body-md text-xl text-secondary', label: 'WORLDBUILDING', style: { right: '15%', top: '25%' } },
  { className: 'font-headline-lg text-4xl font-bold text-primary', label: 'ROGUE', style: { left: '15%', top: '35%' } },
  { className: 'font-headline-xl text-6xl font-bold text-primary', label: 'RETRO', style: { left: '35%', top: '50%' } },
  { className: 'font-headline-xl text-5xl font-bold text-primary', label: 'ERROR', style: { right: '15%', top: '45%' } },
  { className: 'font-headline-lg text-3xl font-bold text-primary', label: 'STRATEGY', style: { left: '20%', top: '65%' } },
  { className: 'font-headline-lg text-4xl font-bold text-primary', label: 'LORE', style: { left: '45%', top: '65%' } },
  { className: 'font-headline-lg text-3xl font-bold text-primary', label: 'FOCUS', style: { right: '20%', top: '65%' } },
  { className: 'font-headline-lg text-4xl font-bold text-primary', label: 'ENDING', style: { left: '35%', top: '80%' } },
  { className: 'font-body-md text-2xl text-secondary', label: 'PARTY', style: { right: '25%', top: '80%' } },
] as const

const tasteTags = [
  { label: '#METAVERSE', style: { left: '20%', top: '20%' } },
  { label: '#STORY_DRIVEN', style: { right: '20%', top: '15%' } },
  { label: '#WORLDBOX', style: { left: '45%', top: '45%', transform: 'translate(-50%, -50%)' } },
  { label: '#TURN_BASED', style: { left: '15%', top: '65%' } },
  { label: '#RPG', style: { right: '25%', top: '75%' } },
] as const

function Recommend() {
  const [isAnalyzingOpen, setIsAnalyzingOpen] = useState(false)

  const openAnalyzingModal = () => {
    setIsAnalyzingOpen(true)
    window.setTimeout(() => setIsAnalyzingOpen(false), 1800)
  }

  return (
    <div className="profile-page recommend-page text-on-surface font-body-md antialiased min-h-screen flex flex-col selection:bg-primary selection:text-on-primary">
      <header className="sticky w-full top-0 border-b-2 border-primary bg-surface-container-lowest z-50">
        <div className="flex justify-between items-center px-margin py-4 w-full max-w-container-max mx-auto">
          <Link className="block w-[180px] hover:opacity-80 transition-opacity group" title="Go to Title Screen" to="/profile">
            <img
              alt="Gaming Journal Club Logo"
              className="h-12 w-auto object-contain transition-transform duration-200 animate-logo-float mt-[2px]"
              src={logoUrl}
            />
          </Link>

          <nav className="hidden md:flex gap-8 items-center font-label-caps text-label-caps">
            <Link className="relative nav-link-indicator text-secondary hover:text-primary px-2 py-1 active:scale-95 transition-transform hover:bg-primary hover:text-on-primary transition-colors duration-100 hover:text-white" to="/profile">
              PROFILE
            </Link>
            <Link className="relative nav-link-indicator text-primary underline decoration-4 underline-offset-8 px-2 py-1 hover:text-primary px-2 py-1 active:scale-95 transition-transform hover:bg-primary hover:text-on-primary transition-colors duration-100" to="/recommend">
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
        <div className="flex flex-col items-center gap-4 w-full mb-2">
          <div className="w-full flex flex-col items-center gap-4">
            <button
              className="w-full border-2 border-primary rounded-xl p-4 flex items-center justify-center gap-4 bg-white hover:bg-surface-container transition-colors group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              onClick={openAnalyzingModal}
              type="button"
            >
              <div className="border-2 border-primary p-1 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl font-bold group-hover:rotate-180 transition-transform duration-500">
                  sync
                </span>
              </div>
              <span className="font-headline-lg text-headline-lg tracking-tighter">SYNC_DATA</span>
            </button>

            <p className="font-label-caps text-label-caps text-secondary text-center leading-relaxed recommend-nowrap">
              Press sync to refresh recent ratings, journals, and play records so AI can analyze your data and recommend matching games.
            </p>

            <div className="bg-white border border-outline-variant px-3 py-1">
              <span className="font-label-caps text-[10px] text-secondary uppercase">
                LAST_SYNC: 2024. 10. 12 14:30
              </span>
            </div>
          </div>
        </div>

        <section className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 bg-surface-container-lowest p-8 border-2 border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile mb-2 text-primary uppercase">
              YOUR PLAY STYLE
            </h2>
            <p className="font-label-caps text-label-caps mb-8 text-secondary">
              (BASED ON ACHIEVEMENTS, RATINGS, AND JOURNAL LOGS)
            </p>
            <div className="bg-surface-container-lowest p-8 flex items-center justify-center min-h-[300px] relative overflow-hidden border-2 border-primary">
              {wordCloud.map((word) => (
                <span
                  className={`absolute ${word.className}`}
                  key={word.label}
                  style={word.style}
                >
                  {word.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex-1 bg-surface-container-lowest p-8 border-2 border-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile mb-2 text-primary uppercase">
              GAMES YOU ENJOY
            </h2>
            <p className="font-label-caps text-label-caps mb-8 text-secondary">
              (BASED ON GAME RATINGS AND PLAY HISTORY)
            </p>
            <div className="relative min-h-[300px] flex items-center justify-center p-8">
              {tasteTags.map((tag) => (
                <span
                  className="absolute text-xl font-body-md text-primary border border-primary px-3 py-1"
                  key={tag.label}
                  style={tag.style}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full">
          <h2 className="font-headline-lg text-headline-lg mb-12 text-primary uppercase">
            RECOMMENDED GAMES
          </h2>
          <div className="flex items-center gap-6">
            <button className="p-2 text-primary bg-surface-container-lowest border-2 border-primary hover:bg-primary hover:text-on-primary transition-colors focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none" type="button">
              <span className="material-symbols-outlined text-4xl">chevron_left</span>
            </button>

            <div className="flex-1 overflow-hidden">
              <div className="flex gap-6">
                {recommendationCards.map((card) => (
                  <div
                    className="w-[280px] h-[400px] bg-surface-container-lowest flex-shrink-0 flex flex-col border-2 border-primary transition-all cursor-pointer group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px]"
                    key={card.title}
                  >
                    <div className="relative flex-1 p-2">
                      <img
                        alt="Game Cover"
                        className="w-full h-full object-cover border-2 border-primary grayscale group-hover:grayscale-0 transition-all duration-300"
                        src={card.cover}
                      />
                      {card.badges.map((badge, index) => (
                        <span
                          className={`absolute top-4 ${index === 0 ? 'left-4' : 'left-12 ml-2'
                            } bg-primary text-on-primary px-2 py-1 font-label-caps text-xs`}
                          key={badge}
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                    <div className="p-4 border-t-2 border-primary bg-surface-container-lowest flex justify-between items-end">
                      <span className="font-label-caps text-xs text-primary uppercase group-hover:hidden">
                        {card.title}
                      </span>
                      <span className="font-label-caps text-xs text-primary uppercase hidden group-hover:block">
                        {card.genre}
                      </span>
                    </div>
                  </div>
                ))}

                <div className="w-[100px] h-[400px] bg-surface-container-lowest flex-shrink-0 flex flex-col border-y-2 border-l-2 border-primary transition-all cursor-pointer group overflow-hidden">
                  <div className="relative flex-1 p-2">
                    <div className="w-full h-full bg-surface-variant border-2 border-primary" />
                  </div>
                  <div className="p-4 border-t-2 border-primary bg-surface-container-lowest" />
                </div>
              </div>
            </div>

            <button className="p-2 text-primary bg-surface-container-lowest border-2 border-primary hover:bg-primary hover:text-on-primary transition-colors focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none" type="button">
              <span className="material-symbols-outlined text-4xl">chevron_right</span>
            </button>
          </div>
        </section>
      </main>

      <footer className="w-full border-t-2 border-primary mt-20 bg-surface-container-lowest">
        <div className="flex flex-col md:flex-row justify-between items-center px-margin py-gutter w-full max-w-container-max mx-auto gap-8 md:gap-0">
          <div className="w-[180px] flex items-center justify-center md:justify-start">
            <img alt="Gaming Journal Club Logo" className="h-12 w-auto object-contain" src={logoUrl} />
          </div>
          <nav className="flex flex-wrap justify-center md:justify-end gap-6 font-label-caps text-label-caps">
            <a className="text-secondary hover:text-primary hover:underline decoration-1 transition-colors" href="#terms">
              Terms
            </a>
            <div className="relative flex flex-col items-center">
              <span className="text-[10px] font-bold text-[#5555FF] mb-1 animate-pulse">
                AI RECOMMEND
              </span>
              <Link className="relative nav-link-indicator text-primary underline decoration-4 underline-offset-8 px-2 py-1 active:scale-95 transition-transform hover:bg-primary hover:text-on-primary transition-colors duration-100" to="/recommend">
                RECOMMEND
              </Link>
            </div>
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

      <RecommendAnalyzingModal
        isOpen={isAnalyzingOpen}
        onClose={() => setIsAnalyzingOpen(false)}
      />
    </div>
  )
}

export default Recommend
