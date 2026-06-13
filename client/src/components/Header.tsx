import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
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
  // useNavigate는 React Router가 제공하는 페이지 이동 함수입니다.
  // Link처럼 JSX 태그를 클릭해서 이동하는 방식이 아니라, 함수 안에서 원하는 시점에 이동시킬 때 사용합니다.
  const navigate = useNavigate()

  // useAuth는 AuthContext에 저장된 인증 관련 값과 함수를 꺼내는 커스텀 Hook입니다.
  // 여기서는 서버 로그아웃 API 호출과 프론트 user 상태 초기화를 함께 처리하는 logout 함수만 꺼냅니다.
  const { logout } = useAuth()

  // 로그아웃은 단순 페이지 이동이 아니라 서버 쿠키를 지우는 API 요청이 먼저 필요합니다.
  // async 함수로 만든 이유는 await logout()이 끝난 뒤에 /login으로 이동시키기 위해서입니다.
  const handleLogout = async () => {
    // AuthContext의 logout 내부에서 api.post('/auth/logout')을 호출하고 user 상태를 null로 비웁니다.
    await logout()

    // 서버/프론트 로그아웃 처리가 끝난 뒤 로그인 페이지로 이동합니다.
    navigate('/login')
  }

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
          {/* 클릭하면 login 페이지로 이동하는 링크 
          <Link className="header-logout" to="/login">
            LOGOUT
          </Link>
          */}
          {/* 서버에 요청을 보내는 동작을 하는 버튼으로 바꿔야 함 */}
          <button className="header-logout" onClick={handleLogout} type="button">
            LOGOUT
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
