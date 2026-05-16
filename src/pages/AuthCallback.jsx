// src/pages/AuthCallback.jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { supabase } from '../lib/supabase'
import styles from './AuthCallback.module.css'

const STAFF_ROLES = ['manager', 'deputy', 'senior', 'rcw', 'relief']
const OL_ROLES = ['operationallead', 'superadmin']

function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let redirectTimer = null
    let handled = false

    const handleSuccess = async () => {
      if (handled) return
      handled = true
      setStatus('success')

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const userId = session?.user?.id

        if (userId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single()

          const role = profile?.role

          // Mark email as verified on the profile
          await supabase
            .from('profiles')
            .update({ email_verified: true })
            .eq('id', userId)

          if (STAFF_ROLES.includes(role)) {
            redirectTimer = setTimeout(() => {
              navigate('/login', { replace: true })
            }, 2500)
            return
          }
        }
      } catch {
        // If profile fetch fails, fall through to default OL redirect
      }

      // OL / superadmin / unknown — go to org-setup
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
            await handleSuccess()
          }
          return
        }

        // ── Implicit flow — tokens in hash fragment ────────────────────
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
            await handleSuccess()
          }
          return
        }

        // ── Neither code nor hash — check existing session ────────────
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          handleError(error.message)
          return
        }
        if (data?.session) {
          await handleSuccess()
          return
        }

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

  // ── Success message differs by flow ───────────────────────────
  const successBody =
    status === 'success'
      ? "Your email has been confirmed. Your account is awaiting approval from your manager. You'll be redirected to login in a moment."
      : ''

  const successRedirectNote =
    status === 'success' ? 'Redirecting to login…' : ''

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
            <p className={styles.body}>{successBody}</p>
            <div className={styles.redirectNote}>
              <FontAwesomeIcon icon='spinner' spin />
              {successRedirectNote}
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
