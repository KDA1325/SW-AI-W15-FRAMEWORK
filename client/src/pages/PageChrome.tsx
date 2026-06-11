import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type PageChromeProps = {
  active: 'journals' | 'profile' | 'recommend' | 'timeline'
  children: ReactNode
}

const navItems = [
  { key: 'profile', label: 'PROFILE', to: '/profile' },
  { key: 'recommend', label: 'RECOMMEND', to: '/recommend' },
  { key: 'journals', label: 'JOURNALS', to: '/journals' },
  { key: 'timeline', label: 'TIMELINE', to: '/timeline' },
] as const

function PageChrome({ active, children }: PageChromeProps) {
  return (
    <div className="min-h-screen bg-surface-container-lowest text-primary selection:bg-primary selection:text-on-primary">
      {/* 원본 HTML마다 반복되던 header/footer를 React 공통 컴포넌트로 분리했습니다. */}
      <header className="sticky top-0 z-50 w-full border-b-2 border-primary bg-surface-container-lowest">
        <div className="mx-auto flex w-full max-w-container-max items-center justify-between px-margin py-4">
          <Link className="font-headline-lg text-2xl uppercase tracking-widest" to="/profile">
            GAMING JOURNAL CLUB
          </Link>

          <nav className="hidden items-center gap-8 font-label-caps text-label-caps md:flex">
            {navItems.map((item) => (
              <Link
                className={`px-2 py-1 transition-colors hover:bg-primary hover:text-on-primary ${
                  active === item.key
                    ? 'border-b-4 border-primary text-primary'
                    : 'text-secondary'
                }`}
                key={item.key}
                to={item.to}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-6 font-label-caps text-label-caps md:flex">
            <a className="text-secondary hover:text-primary hover:underline" href="#settings">
              SETTINGS
            </a>
            <Link
              className="border-2 border-primary px-4 py-2 uppercase hover:bg-primary hover:text-on-primary"
              to="/login"
            >
              LOGOUT
            </Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="mt-12 w-full border-t-2 border-primary bg-surface-container-lowest">
        <div className="mx-auto flex w-full max-w-container-max flex-col items-center justify-between gap-8 px-8 py-8 md:flex-row md:gap-0">
          <div className="font-headline-lg text-xl uppercase">GJC</div>
          <nav className="flex flex-wrap justify-center gap-6 font-label-caps text-sm tracking-widest">
            <a className="text-secondary hover:text-primary hover:underline" href="#terms">
              TERMS
            </a>
            <a className="text-secondary hover:text-primary hover:underline" href="#privacy">
              PRIVACY
            </a>
            <a className="text-primary underline decoration-2 underline-offset-4" href="#archive">
              ARCHIVE
            </a>
            <a className="text-secondary hover:text-primary hover:underline" href="#contact">
              CONTACT
            </a>
          </nav>
          <div className="font-label-caps text-sm uppercase tracking-widest text-primary">
            2026 GAMING JOURNAL CLUB
          </div>
        </div>
      </footer>
    </div>
  )
}

export default PageChrome
