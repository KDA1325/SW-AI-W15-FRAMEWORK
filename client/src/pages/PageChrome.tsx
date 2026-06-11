import type { ReactNode } from 'react'
import Header, { type NavKey } from '../components/Header'

type PageChromeProps = {
  active: NavKey
  children: ReactNode
}

function PageChrome({ active, children }: PageChromeProps) {
  return (
    <div className="min-h-screen bg-[var(--gjc-surface-container-lowest)] text-[var(--gjc-primary)] selection:bg-[var(--gjc-primary)] selection:text-[var(--gjc-on-primary)]">
      {/* Header uses active to show which top-level page is currently selected. */}
      <Header active={active} />

      {children}

      <footer className="mt-12 w-full border-t-2 border-[var(--gjc-primary)] bg-[var(--gjc-surface-container-lowest)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-between gap-8 px-8 py-8 md:flex-row md:gap-0">
          <div className="font-headline-lg text-xl uppercase">GJC</div>
          <nav className="flex flex-wrap justify-center gap-6 font-label-caps text-sm tracking-widest">
            <a className="text-[var(--gjc-secondary)] hover:text-[var(--gjc-primary)] hover:underline" href="#terms">
              TERMS
            </a>
            <a className="text-[var(--gjc-secondary)] hover:text-[var(--gjc-primary)] hover:underline" href="#privacy">
              PRIVACY
            </a>
            <a className="text-[var(--gjc-primary)] underline decoration-2 underline-offset-4" href="#archive">
              ARCHIVE
            </a>
            <a className="text-[var(--gjc-secondary)] hover:text-[var(--gjc-primary)] hover:underline" href="#contact">
              CONTACT
            </a>
          </nav>
          <div className="font-label-caps text-sm uppercase tracking-widest text-[var(--gjc-primary)]">
            2026 GAMING JOURNAL CLUB
          </div>
        </div>
      </footer>
    </div>
  )
}

export default PageChrome
