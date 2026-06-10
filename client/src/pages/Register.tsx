import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { api } from '../api'
import '../styles/Register.css'

type RegisterForm = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

type ApiErrorResponse = {
  message?: string | string[]
}

function Register() {
  const [form, setForm] = useState<RegisterForm>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    if (form.password !== form.confirmPassword) {
      setMessage('ACCESS CODE MISMATCH')
      return
    }

    setIsSubmitting(true)

    try {
      await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
      })
      setMessage('ACCOUNT INITIALIZED')
    } catch (error) {
      const axiosError = error as AxiosError<ApiErrorResponse>
      const responseMessage = axiosError.response?.data?.message

      if (!axiosError.response) {
        setMessage('SERVER CONNECTION FAILED')
      } else if (Array.isArray(responseMessage)) {
        setMessage(responseMessage.join(' / ').toUpperCase())
      } else if (responseMessage) {
        setMessage(responseMessage.toUpperCase())
      } else {
        setMessage('REGISTRATION FAILED')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField =
    (field: keyof RegisterForm) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }))
    }

  return (
    <main className="register-page">
      <section className="register-canvas">
        <div className="register-layout">
          <section className="register-logo" aria-label="Gaming Journal Club">
            <div>GAMING</div>
            <div>JOURNAL</div>
            <div>CLUB</div>
            <span className="register-logo-rule" aria-hidden="true" />
            <p>SYSTEMS.INITIALIZE // EST. 198X</p>
          </section>

          <section className="register-terminal" aria-labelledby="register-heading">
            <div className="register-terminal-bar" aria-hidden="true">
              <span>SYS_REGISTRATION.EXE</span>
              <div className="register-window-controls">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="register-terminal-body">
              <h1 id="register-heading">CREATE_ACCOUNT</h1>

              <form className="register-form" onSubmit={handleSubmit}>
                <label className="register-field" htmlFor="identifier">
                  <span>
                    <span className="material-symbols-outlined" aria-hidden="true">
                      terminal
                    </span>
                    IDENTIFIER
                  </span>
                  <input
                    autoComplete="username"
                    id="identifier"
                    name="identifier"
                    onChange={updateField('name')}
                    placeholder="ENTER_USERNAME_"
                    type="text"
                    value={form.name}
                  />
                </label>

                <label className="register-field" htmlFor="email">
                  <span>
                    <span className="material-symbols-outlined" aria-hidden="true">
                      mail
                    </span>
                    EMAIL ADDRESS
                  </span>
                  <input
                    autoComplete="email"
                    id="email"
                    name="email"
                    onChange={updateField('email')}
                    placeholder="ENTER_COMM_LINK_"
                    type="email"
                    value={form.email}
                  />
                </label>

                <label className="register-field" htmlFor="password">
                  <span>
                    <span className="material-symbols-outlined" aria-hidden="true">
                      key
                    </span>
                    ACCESS CODE
                  </span>
                  <input
                    autoComplete="new-password"
                    id="password"
                    name="password"
                    onChange={updateField('password')}
                    placeholder="********"
                    type="password"
                    value={form.password}
                  />
                </label>

                <label className="register-field" htmlFor="confirm-password">
                  <span>
                    <span className="material-symbols-outlined" aria-hidden="true">
                      lock
                    </span>
                    CONFIRM ACCESS CODE
                  </span>
                  <input
                    autoComplete="new-password"
                    id="confirm-password"
                    name="confirmPassword"
                    onChange={updateField('confirmPassword')}
                    placeholder="********"
                    type="password"
                    value={form.confirmPassword}
                  />
                </label>

                <button className="register-submit" disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'INITIALIZING...' : 'INITIALIZE_ACCOUNT'}
                </button>

                {message ? <p className="register-message">{message}</p> : null}

                <Link className="register-back-link" to="/login">
                  [ BACK_TO_LOGIN ]
                </Link>
              </form>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default Register
