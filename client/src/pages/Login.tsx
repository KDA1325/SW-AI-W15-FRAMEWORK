import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, getApiErrorMessage } from '../api'
import '../styles/login.css'
import LoginPendingView from './LoginPendingView'

// Login.html의 정적 입력 화면을 React 컴포넌트로 옮기면서,
// 사용자가 바꾸는 값은 DOM에 직접 두지 않고 상태로 관리합니다.
type LoginState = {
  email: string
  password: string
}

function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState<LoginState>({
    email: '',
    password: '',
  })
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // HTML 시안의 type="button"을 실제 로그인 폼 제출 흐름으로 바꾼 부분입니다.
  // preventDefault로 브라우저 새로고침을 막고 axios 공통 인스턴스로 NestJS API에 요청합니다.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)

    try {
      await api.post('/auth/login', form)
      setMessage('LOGIN SUCCESS')
      navigate('/profile')
    } catch (error) {
      // 서버가 보낸 UnauthorizedException 메시지나 ValidationPipe 메시지를 공통 함수로 꺼냅니다.
      // 이렇게 하면 로그인 화면도 회원가입 화면과 같은 에러 처리 기준을 사용합니다.
      setMessage(getApiErrorMessage(error, 'LOGIN FAILED'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page blueprint-grid">
      {/* Login.html의 왼쪽 히어로 영역을 JSX 구조로 보존하고, Tailwind 유틸리티는 login.css의 의미 있는 클래스명으로 옮겼습니다. */}
      <section className="login-hero" aria-label="Gaming Journal Club">
        <nav className="login-nav" aria-label="Primary">
          <a className="nav-link-hover" href="#archive">
            ARCHIVE
          </a>
          <a className="nav-link-hover" href="#review">
            REVIEW
          </a>
          <a className="nav-link-hover" href="#latest">
            LATEST
          </a>
        </nav>

        <div className="login-title-wrap">
          <h1 className="login-title">
            <span>GAMING</span>
            <span>JOURNAL</span>
            <span>CLUB</span>
          </h1>
        </div>

        <div className="login-status">
          <span>DOWNLOADING</span>
          <span className="status-cursor" aria-hidden="true" />
        </div>
      </section>

      <section
        className={`login-panel${isSubmitting ? ' is-pending' : ''}`}
        aria-labelledby="login-heading"
      >
        {/* 정적 HTML에는 없던 비동기 상태입니다. 요청 중에는 폼 대신 대기 컴포넌트를 보여줘 중복 제출을 막고 진행 중임을 표현합니다. */}
        {isSubmitting ? (
          <LoginPendingView email={form.email} />
        ) : (
          <>
            <div className="login-form-shell">
              <h2 id="login-heading">LOGIN</h2>

              <form className="login-form" onSubmit={handleSubmit}>
                <label className="login-field">
                  <span>IDENTIFIER</span>
                  <input
                    autoComplete="email"
                    name="email"
                    // HTML input의 현재 값은 value와 onChange로 React 상태에 동기화합니다.
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="USER_EMAIL"
                    type="email"
                    value={form.email}
                  />
                </label>

                <label className="login-field">
                  <span>ACCESS CODE</span>
                  <input
                    autoComplete="current-password"
                    name="password"
                    // password도 같은 방식으로 상태에 저장해 submit 시 form 객체를 그대로 API payload로 보냅니다.
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="PASSWORD"
                    type="password"
                    value={form.password}
                  />
                </label>

                {/* HTML의 hover 아이콘 효과는 CSS로 유지하고, 버튼은 submit 타입으로 바꿔 form onSubmit과 연결했습니다. */}
                <button className="login-submit" disabled={isSubmitting} type="submit">
                  <span>START_SESSION</span>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    terminal
                  </span>
                </button>

                {message ? <p className="login-message">{message}</p> : null}

                {/* 정적 a 태그의 href="#"는 React Router Link로 바꿔 새로고침 없는 페이지 이동을 사용합니다. */}
                <Link className="create-account-link" to="/register">
                  CREATE ACCOUNT
                </Link>
              </form>
            </div>

            <p className="secure-copy">SECURE TERMINAL CONNECTION</p>
          </>
        )}
      </section>
    </main>
  )
}

export default Login
