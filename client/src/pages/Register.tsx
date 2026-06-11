import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { api } from '../api'
import '../styles/Register.css'

// Register.html의 네 개 입력 필드를 React 상태로 옮긴 형태입니다.
// confirmPassword는 서버로 보내지 않고 클라이언트에서 비밀번호 확인에만 사용합니다.
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
  // 정적 HTML input을 controlled input으로 바꾸기 위해 모든 입력값을 form 상태에 모읍니다.
  const [form, setForm] = useState<RegisterForm>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // HTML 시안의 submit 버튼에 실제 회원가입 흐름을 연결한 부분입니다.
  // preventDefault로 새로고침을 막고, 클라이언트 검증 후 NestJS 회원가입 API로 요청합니다.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage('')

    // Register.html에는 없던 동작입니다. 서버 요청 전에 비밀번호 확인값을 먼저 비교합니다.
    if (form.password !== form.confirmPassword) {
      setMessage('ACCESS CODE MISMATCH')
      return
    }

    setIsSubmitting(true)

    try {
      // confirmPassword는 검증용 상태라 API payload에서는 제외합니다.
      await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
      })
      setMessage('ACCOUNT INITIALIZED')
    } catch (error) {
      // NestJS ValidationPipe 에러는 message가 문자열 배열로 올 수 있어서 배열/문자열을 나눠 처리합니다.
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
      // HTML의 각 input value를 React 상태의 해당 key로 동기화하는 공통 핸들러입니다.
      // keyof RegisterForm 덕분에 존재하지 않는 필드명은 타입 단계에서 막을 수 있습니다.
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }))
    }

  return (
    <main className="register-page">
      {/* Register.html의 Main Content Canvas를 JSX 구조로 보존하고, 배경 격자/여백은 Register.css로 옮겼습니다. */}
      <section className="register-canvas">
        <div className="register-layout">
          {/* HTML의 Left Side: Stepped Logo 영역입니다. Tailwind margin 유틸리티는 CSS의 nth-child 규칙으로 분리했습니다. */}
          <section className="register-logo" aria-label="Gaming Journal Club">
            <div>GAMING</div>
            <div>JOURNAL</div>
            <div>CLUB</div>
            <span className="register-logo-rule" aria-hidden="true" />
            <p>SYSTEMS.INITIALIZE // EST. 198X</p>
          </section>

          {/* HTML의 Right Side: Terminal Registration Form을 터미널 카드 컴포넌트 구조로 옮겼습니다. */}
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

              {/* 정적 form에 onSubmit을 연결해 버튼 클릭, Enter 입력 모두 같은 제출 로직을 타게 했습니다. */}
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
                    // HTML의 identifier input은 서버 DTO의 name 필드로 매핑됩니다.
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
                    // email input은 상태에 저장된 뒤 /auth/register 요청 payload에 포함됩니다.
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
                    // password는 서버로 보내는 실제 비밀번호 값입니다.
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
                    // confirmPassword는 UI에는 필요하지만 서버 payload에는 포함하지 않는 검증 전용 값입니다.
                    onChange={updateField('confirmPassword')}
                    placeholder="********"
                    type="password"
                    value={form.confirmPassword}
                  />
                </label>

                {/* HTML 버튼 문구를 요청 상태와 연결해 제출 중에는 중복 클릭을 막고 진행 중임을 보여줍니다. */}
                <button className="register-submit" disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'INITIALIZING...' : 'INITIALIZE_ACCOUNT'}
                </button>

                {message ? <p className="register-message">{message}</p> : null}

                {/* href="#"였던 뒤로가기 링크는 React Router Link로 바꿔 로그인 페이지로 이동시킵니다. */}
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
