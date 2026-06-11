import { Link } from 'react-router-dom'
import '../styles/Header.css'

export type NavKey = 'profile' | 'recommend' | 'journals' | 'timeline'

type HeaderProps = {
  active: NavKey
}

const navItems = [
  { key: 'profile', label: 'PROFILE', to: '/profile' },
  { key: 'recommend', label: 'RECOMMEND', to: '/recommend' },
  { key: 'journals', label: 'JOURNALS', to: '/journals' },
  { key: 'timeline', label: 'TIMELINE', to: '/timeline' },
] as const

const logoUrl =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB_LxM4GjqvESEBDiByFsths6jve9ylqYMo_olMXVBHSuYy-3NdXqyqSUu_MazoCLjd3IEbFPYuTwy8_hbEUN2q43ouBcc9d76wDqPzpq8W0QIPjZNx-2fYN4lkG_IGySYggaCOUU6P-05QmXe56P052Pv5-ebOJgON4E_jZC_p1rjHZnJaf8AcXYdePKGjPaDD-e1mllNljL7TlS6r16g0jZZa1HiduOWE3nDi0tc4Jo76Li1je2W1qV-eQG__tsDhAVlpQcgJaK3J'

function Header({ active }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-inner">
        <Link className="header-logo" title="Go to Profile" to="/profile">
          <img
            alt="Gaming Journal Club Logo"
            className="header-logo-image"
            src={logoUrl}
          />
        </Link>

        <nav className="header-nav">
          {navItems.map((item) => {
            // PageChrome passes the current page key through active.
            // Only the matching menu item receives the underline style.
            const isActive = active === item.key

            return (
              <Link
                className={`header-link ${isActive ? 'header-link-active' : ''}`}
                key={item.key}
                to={item.to}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="header-actions">
          <a className="header-settings" href="#settings">
            SETTINGS
          </a>
          <Link className="header-logout" to="/login">
            LOGOUT
          </Link>
        </div>
      </div>
    </header>
  )
}

export default Header
