// src/pages/VerifyPending.jsx
// ── Single owner of all email verification resend logic ────────────────────
// Fully self-contained — no session required, no route state dependency.
// Looks up the user by email, generates a new verification token via our
// own backend, and sends it via Resend. No Supabase email dependency.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import styles from './VerifyPending.module.css'

const COUNTDOWN_SECONDS = 60
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function VerifyPending() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState(user?.email || '')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)

  // ── If already verified, redirect forward ─────────────────────────────
  useEffect(() => {
    if (user?.emailVerified) {
      navigate('/org-setup', { replace: true })
    }
  }, [user?.emailVerified, navigate])

  // ── Sync email from session if it loads after mount ───────────────────
  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email)
    }
  }, [user?.email])

  // ── Countdown timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [countdown])

  // ── Resend handler ────────────────────────────────────────────────────
  const handleResend = async () => {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }

    setSuccess('')
    setError('')
    setLoading(true)

    try {
      // 1. Look up user via backend — bypasses RLS
      const lookupRes = await fetch(`${API_BASE}/api/auth/lookup-unverified`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      })

      if (!lookupRes.ok) throw new Error('Lookup failed')

      const lookup = await lookupRes.json()

      if (lookup.alreadyVerified) {
        setError('This email is already verified. You can sign in now.')
        setLoading(false)
        return
      }

      if (!lookup.found || !lookup.userId) {
        // Don't reveal whether email exists
        setSuccess(
          'If that email is registered, a verification link has been sent.'
        )
        setCountdown(COUNTDOWN_SECONDS)
        setLoading(false)
        return
      }

      // 2. Generate a new verification token via backend
      const tokenRes = await fetch(
        `${API_BASE}/api/auth/generate-verify-token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: lookup.userId }),
        }
      )

      if (!tokenRes.ok) throw new Error('Failed to generate verification token')

      const { token } = await tokenRes.json()
      const verifyUrl = `${window.location.origin}/verify-email?token=${token}`

      // 3. Send verification email via Resend
      const emailRes = await fetch(`${API_BASE}/api/email/ol-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: trimmedEmail,
          name: '',
          verifyUrl,
        }),
      })

      if (!emailRes.ok) throw new Error('Failed to send verification email')

      setSuccess('Verification email sent. Check your inbox.')
      setCountdown(COUNTDOWN_SECONDS)
    } catch (err) {
      setError(err.message || 'Could not send — please try again.')
    } finally {
      setLoading(false)
    }
  }

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
                setSuccess('')
                setError('')
              }}
              disabled={loading}
            />
          </div>

          {success && (
            <div className={styles.successNote}>
              <FontAwesomeIcon icon='circle-check' />
              {success}
            </div>
          )}

          {error && (
            <div className={styles.errorNote}>
              <FontAwesomeIcon icon='triangle-exclamation' />
              {error}
            </div>
          )}

          <button
            className={styles.resendBtn}
            onClick={handleResend}
            disabled={loading || countdown > 0}
          >
            {loading
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
