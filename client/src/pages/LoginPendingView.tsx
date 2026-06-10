import { Link } from 'react-router-dom'
import '../styles/loginPendingView.css'

type LoginPendingViewProps = {
  email: string
}

function LoginPendingView({ email }: LoginPendingViewProps) {
  return (
    <>
      <div className="login-pending-shell">
        <h2 className="login-pending-heading" id="login-heading">
          LOGIN
        </h2>

        <div className="login-pending-form" aria-busy="true">
          <label className="login-pending-field">
            <span>IDENTIFIER</span>
            <input disabled placeholder="USER_ID" readOnly type="text" value={email} />
          </label>

          <label className="login-pending-field">
            <span>ACCESS CODE</span>
            <input
              disabled
              placeholder="********"
              readOnly
              type="password"
              value="********"
            />
          </label>

          <button className="login-pending-button" disabled type="button">
            <span>ESTABLISHING_CONNECTION...</span>
            <span className="material-symbols-outlined pending-spin" aria-hidden="true">
              progress_activity
            </span>
          </button>

          <Link className="login-pending-create-link" to="/register">
            CREATE ACCOUNT
          </Link>
        </div>
      </div>

      <p className="login-pending-secure-copy">SECURE TERMINAL CONNECTION</p>
    </>
  )
}

export default LoginPendingView
