// src/pages/VerifyPending.jsx
// ── Single owner of all email verification resend logic ────────────────────
// Fully self-contained — no session required, no route state dependency.
// Pre-fills email from session if available. If not, user types it in.
// Works for all cases: just signed up, came back later, link expired.

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import styles from './VerifyPending.module.css'

const COUNTDOWN_KEY = 'rotapp_resend_ts'
const COUNTDOWN_SECONDS = 60

function getInitialCountdown() {
  try {
    const stored = sessionStorage.getItem(COUNTDOWN_KEY)
    if (!stored) return 0
    const secondsElapsed = Math.floor((Date.now() - Number(stored)) / 1000)
    const remaining = COUNTDOWN_SECONDS - secondsElapsed
    return remaining > 0 ? remaining : 0
  } catch {
    return 0
  }
}

function VerifyPending() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Pre-fill from session if available — user can edit if not
  const [email, setEmail] = useState(user?.email || '')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState('')
  const [resendError, setResendError] = useState('')
  const [countdown, setCountdown] = useState(getInitialCountdown)

  // ── If already verified, redirect forward immediately ──────────────────
  useEffect(() => {
    if (user?.emailVerified) {
      navigate('/org-setup', { replace: true })
    }
  }, [user?.emailVerified, navigate])

  // ── Sync email from session if it loads after mount ────────────────────
  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email)
    }
  }, [user?.email])

  // ── Countdown timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          try {
            sessionStorage.removeItem(COUNTDOWN_KEY)
          } catch {}
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [countdown])

  // ── Resend handler ─────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setResendError('Please enter your email address.')
      return
    }

    // If the session tells us this email is already verified,
    // skip the Supabase call and tell the user directly.
    if (user?.emailVerified) {
      setResendError('Your email is already verified. You can sign in now.')
      return
    }

    setResendSuccess('')
    setResendError('')
    setResendLoading(true)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error

      setResendSuccess('Verification email sent. Check your inbox.')
      try {
        sessionStorage.setItem(COUNTDOWN_KEY, String(Date.now()))
      } catch {}
      setCountdown(COUNTDOWN_SECONDS)
    } catch (err) {
      setResendError(err.message || 'Could not send — please try again.')
    } finally {
      setResendLoading(false)
    }
  }, [email])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          Rot<span className={styles.logoAccent}>app</span>
        </div>

        <div className={styles.centred}>
          <div className={styles.icon}>
            <FontAwesomeIcon icon='envelope' />
          </div>

          <h1 className={styles.title}>Verify your email</h1>

          <p className={styles.body}>
            Enter the email address you signed up with and we'll send you a
            fresh verification link.
          </p>

          <p className={styles.hint}>
            Check your spam or junk folder if you don't see it.
          </p>

          {/* Email input — pre-filled from session, editable if no session */}
          <div className={styles.emailInputWrap}>
            <FontAwesomeIcon
              icon='envelope'
              className={styles.emailInputIcon}
            />
            <input
              className={styles.emailInput}
              type='email'
              placeholder='you@example.com'
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setResendSuccess('')
                setResendError('')
              }}
              disabled={resendLoading}
            />
          </div>

          {resendSuccess && (
            <div className={styles.successNote}>
              <FontAwesomeIcon icon='circle-check' />
              {resendSuccess}
            </div>
          )}

          {resendError && (
            <div className={styles.errorNote}>
              <FontAwesomeIcon icon='triangle-exclamation' />
              {resendError}
            </div>
          )}

          <button
            className={styles.resendBtn}
            onClick={handleResend}
            disabled={resendLoading || countdown > 0}
          >
            {resendLoading
              ? 'Sending…'
              : countdown > 0
                ? `Resend in ${countdown}s`
                : 'Send verification email'}
          </button>

          {user ? (
            <button className={styles.signOutBtn} onClick={logout}>
              Sign out and use a different account
            </button>
          ) : (
            <button
              className={styles.signOutBtn}
              onClick={() => navigate('/login', { replace: true })}
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default VerifyPending
