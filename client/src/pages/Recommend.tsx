import { useState } from 'react'
import RecommendAnalyzingModal from './RecommendAnalyzingModal'
import PageChrome from './PageChrome'
import '../styles/Profile.css'
import '../styles/Recommend.css'

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
  { className: 'font-body-md text-2xl text-[var(--gjc-primary)]', label: 'QUIET', style: { left: '15%', top: '20%' } },
  { className: 'font-headline-xl text-5xl font-bold text-[var(--gjc-primary)]', label: 'TACTICAL', style: { left: '30%', top: '25%' } },
  { className: 'font-headline-lg text-3xl font-bold text-[var(--gjc-primary)]', label: 'NARRATIVE', style: { right: '25%', top: '15%' } },
  { className: 'font-body-md text-xl text-[var(--gjc-secondary)]', label: 'WORLDBUILDING', style: { right: '15%', top: '25%' } },
  { className: 'font-headline-lg text-4xl font-bold text-[var(--gjc-primary)]', label: 'ROGUE', style: { left: '15%', top: '35%' } },
  { className: 'font-headline-xl text-6xl font-bold text-[var(--gjc-primary)]', label: 'RETRO', style: { left: '35%', top: '50%' } },
  { className: 'font-headline-xl text-5xl font-bold text-[var(--gjc-primary)]', label: 'ERROR', style: { right: '15%', top: '45%' } },
  { className: 'font-headline-lg text-3xl font-bold text-[var(--gjc-primary)]', label: 'STRATEGY', style: { left: '20%', top: '65%' } },
  { className: 'font-headline-lg text-4xl font-bold text-[var(--gjc-primary)]', label: 'LORE', style: { left: '45%', top: '65%' } },
  { className: 'font-headline-lg text-3xl font-bold text-[var(--gjc-primary)]', label: 'FOCUS', style: { right: '20%', top: '65%' } },
  { className: 'font-headline-lg text-4xl font-bold text-[var(--gjc-primary)]', label: 'ENDING', style: { left: '35%', top: '80%' } },
  { className: 'font-body-md text-2xl text-[var(--gjc-secondary)]', label: 'PARTY', style: { right: '25%', top: '80%' } },
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
    <PageChrome active="recommend">
      <main className="recommend-page flex-grow w-full max-w-[1200px] mx-auto px-8 py-20 flex flex-col gap-[80px]">
        <div className="flex flex-col items-center gap-4 w-full mb-2">
          <div className="w-full flex flex-col items-center gap-4">
            <button
              className="w-full border-2 border-[var(--gjc-primary)] rounded-xl p-4 flex items-center justify-center gap-4 bg-white hover:bg-[var(--gjc-surface-container)] transition-colors group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              onClick={openAnalyzingModal}
              type="button"
            >
              <div className="border-2 border-[var(--gjc-primary)] p-1 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl font-bold group-hover:rotate-180 transition-transform duration-500">
                  sync
                </span>
              </div>
              <span className="font-headline-lg text-headline-lg tracking-tighter">SYNC_DATA</span>
            </button>

            <p className="font-label-caps text-label-caps text-[var(--gjc-secondary)] text-center leading-relaxed recommend-nowrap">
              Press sync to refresh recent ratings, journals, and play records so AI can analyze your data and recommend matching games.
            </p>

            <div className="bg-white border border-[var(--gjc-outline-variant)] px-3 py-1">
              <span className="font-label-caps text-[10px] text-[var(--gjc-secondary)] uppercase">
                LAST_SYNC: 2024. 10. 12 14:30
              </span>
            </div>
          </div>
        </div>

        <section className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 bg-[var(--gjc-surface-container-lowest)] p-8 border-2 border-[var(--gjc-primary)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile mb-2 text-[var(--gjc-primary)] uppercase">
              YOUR PLAY STYLE
            </h2>
            <p className="font-label-caps text-label-caps mb-8 text-[var(--gjc-secondary)]">
              (BASED ON ACHIEVEMENTS, RATINGS, AND JOURNAL LOGS)
            </p>
            <div className="bg-[var(--gjc-surface-container-lowest)] p-8 flex items-center justify-center min-h-[300px] relative overflow-hidden border-2 border-[var(--gjc-primary)]">
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

          <div className="flex-1 bg-[var(--gjc-surface-container-lowest)] p-8 border-2 border-[var(--gjc-primary)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile mb-2 text-[var(--gjc-primary)] uppercase">
              GAMES YOU ENJOY
            </h2>
            <p className="font-label-caps text-label-caps mb-8 text-[var(--gjc-secondary)]">
              (BASED ON GAME RATINGS AND PLAY HISTORY)
            </p>
            <div className="relative min-h-[300px] flex items-center justify-center p-8">
              {tasteTags.map((tag) => (
                <span
                  className="absolute text-xl font-body-md text-[var(--gjc-primary)] border border-[var(--gjc-primary)] px-3 py-1"
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
          <h2 className="font-headline-lg text-headline-lg mb-12 text-[var(--gjc-primary)] uppercase">
            RECOMMENDED GAMES
          </h2>
          <div className="flex items-center gap-6">
            <button className="p-2 text-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] border-2 border-[var(--gjc-primary)] hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-colors focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none" type="button">
              <span className="material-symbols-outlined text-4xl">chevron_left</span>
            </button>

            <div className="flex-1 overflow-hidden">
              <div className="flex gap-6">
                {recommendationCards.map((card) => (
                  <div
                    className="w-[280px] h-[400px] bg-[var(--gjc-surface-container-lowest)] flex-shrink-0 flex flex-col border-2 border-[var(--gjc-primary)] transition-all cursor-pointer group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px]"
                    key={card.title}
                  >
                    <div className="relative flex-1 p-2">
                      <img
                        alt="Game Cover"
                        className="w-full h-full object-cover border-2 border-[var(--gjc-primary)] grayscale group-hover:grayscale-0 transition-all duration-300"
                        src={card.cover}
                      />
                      {card.badges.map((badge, index) => (
                        <span
                          className={`absolute top-4 ${index === 0 ? 'left-4' : 'left-12 ml-2'
                            } bg-[var(--gjc-primary)] text-[var(--gjc-on-primary)] px-2 py-1 font-label-caps text-xs`}
                          key={badge}
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                    <div className="p-4 border-t-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] flex justify-between items-end">
                      <span className="font-label-caps text-xs text-[var(--gjc-primary)] uppercase group-hover:hidden">
                        {card.title}
                      </span>
                      <span className="font-label-caps text-xs text-[var(--gjc-primary)] uppercase hidden group-hover:block">
                        {card.genre}
                      </span>
                    </div>
                  </div>
                ))}

                <div className="w-[100px] h-[400px] bg-[var(--gjc-surface-container-lowest)] flex-shrink-0 flex flex-col border-y-2 border-l-2 border-[var(--gjc-primary)] transition-all cursor-pointer group overflow-hidden">
                  <div className="relative flex-1 p-2">
                    <div className="w-full h-full bg-[var(--gjc-surface-variant)] border-2 border-[var(--gjc-primary)]" />
                  </div>
                  <div className="p-4 border-t-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)]" />
                </div>
              </div>
            </div>

            <button className="p-2 text-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)] border-2 border-[var(--gjc-primary)] hover:bg-[var(--gjc-primary)] hover:text-[var(--gjc-on-primary)] transition-colors focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none" type="button">
              <span className="material-symbols-outlined text-4xl">chevron_right</span>
            </button>
          </div>
        </section>
      </main>

      <RecommendAnalyzingModal
        isOpen={isAnalyzingOpen}
        onClose={() => setIsAnalyzingOpen(false)}
      />
    </PageChrome>
  )
}

export default Recommend
