import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import '../styles/login.css'

type LoginState = {
  email: string
  password: string
}

function Login() {
  const [form, setForm] = useState<LoginState>({
    email: '',
    password: '',
  })
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')
    setIsSubmitting(true)

    try {
      await api.post('/auth/login', form)
      setMessage('LOGIN SUCCESS')
    } catch {
      setMessage('LOGIN FAILED')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page blueprint-grid">
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

      <section className="login-panel" aria-labelledby="login-heading">
        <div className="login-form-shell">
          <h2 id="login-heading">LOGIN</h2>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>IDENTIFIER</span>
              <input
                autoComplete="email"
                name="email"
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

            <button className="login-submit" disabled={isSubmitting} type="submit">
              <span>{isSubmitting ? 'CONNECTING' : 'START_SESSION'}</span>
              <span className="material-symbols-outlined" aria-hidden="true">
                terminal
              </span>
            </button>

            {message ? <p className="login-message">{message}</p> : null}

            <Link className="create-account-link" to="/register">
              CREATE ACCOUNT
            </Link>
          </form>
        </div>

        <p className="secure-copy">SECURE TERMINAL CONNECTION</p>
      </section>
    </main>
  )
}

export default Login
