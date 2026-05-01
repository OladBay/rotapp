// src/pages/AuthCallback.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { supabase } from '../lib/supabase'
import styles from './AuthCallback.module.css'

function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let redirectTimer = null
    let handled = false

    const handleSuccess = () => {
      if (handled) return
      handled = true
      setStatus('success')
      redirectTimer = setTimeout(() => {
        navigate('/org-setup', { replace: true })
      }, 2500)
    }

    const handleError = (msg) => {
      if (handled) return
      handled = true
      setErrorMessage(
        msg ||
          'This verification link has expired or has already been used. Please request a new one.'
      )
      setStatus('error')
    }

    const processCallback = async () => {
      try {
        const query = new URLSearchParams(window.location.search)
        const hash = window.location.hash

        // ── PKCE flow — code in query string ──────────────────────────
        const code = query.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            handleError(error.message)
          } else {
            handleSuccess()
          }
          return
        }

        // ── Implicit flow — tokens in hash fragment ────────────────────
        // Parse access_token and refresh_token directly from the hash.
        // We do not rely on onAuthStateChange — we drive this actively.
        if (hash && hash.includes('access_token')) {
          const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (!accessToken || !refreshToken) {
            handleError(
              'Verification link is malformed. Please request a new one.'
            )
            return
          }

          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (error) {
            handleError(error.message)
          } else {
            handleSuccess()
          }
          return
        }

        // ── Neither code nor hash — check if session already exists ───
        // Handles the case where the link was already processed
        // (e.g. user clicked back after verifying).
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          handleError(error.message)
          return
        }
        if (data?.session) {
          handleSuccess()
          return
        }

        // Nothing found — link expired, invalid, or already consumed
        handleError(
          'This verification link has expired or has already been used. Please request a new one.'
        )
      } catch (err) {
        handleError(err.message)
      }
    }

    processCallback()

    return () => {
      clearTimeout(redirectTimer)
    }
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          Rot<span className={styles.logoAccent}>app</span>
        </div>

        {status === 'verifying' && (
          <div className={styles.centred}>
            <div className={styles.spinner} />
            <h1 className={styles.title}>Verifying your email…</h1>
            <p className={styles.body}>Just a moment.</p>
          </div>
        )}

        {status === 'success' && (
          <div className={styles.centred}>
            <div className={styles.iconSuccess}>
              <FontAwesomeIcon icon='circle-check' />
            </div>
            <h1 className={styles.title}>Email verified</h1>
            <p className={styles.body}>
              Your email address has been confirmed. You'll be redirected to set
              up your organisation in a moment.
            </p>
            <div className={styles.redirectNote}>
              <FontAwesomeIcon icon='spinner' spin />
              Redirecting to organisation setup…
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className={styles.centred}>
            <div className={styles.iconError}>
              <FontAwesomeIcon icon='triangle-exclamation' />
            </div>
            <h1 className={styles.title}>Verification failed</h1>
            <p className={styles.body}>{errorMessage}</p>
            <button
              className={styles.retryBtn}
              onClick={() => navigate('/verify-pending', { replace: true })}
            >
              Request a new verification email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AuthCallback
