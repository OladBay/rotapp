// src/pages/VerifyPending.jsx
// ── Holding page for unverified users ─────────────────────────
// Any authenticated user whose email is not yet verified lands here.
// Shows their email, a resend button, and nothing else.
// Publicly accessible — no auth required to render it.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import styles from './VerifyPending.module.css'

function VerifyPending() {
  const { user, logout } = useAuth()
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState('')

  const email = user?.email || ''

  const handleResend = async () => {
    setResendMessage('')
    setResendError('')
    setResendLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/org-setup`,
        },
      })
      if (error) throw error
      setResendMessage('Verification email resent. Check your inbox.')
    } catch (err) {
      setResendError('Could not resend — please try again.')
    } finally {
      setResendLoading(false)
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
            We sent a verification link to{' '}
            {email ? <strong>{email}</strong> : 'your email address'}. Click the
            link to continue setting up your organisation.
          </p>

          <p className={styles.hint}>
            Can't find it? Check your spam or junk folder.
          </p>

          {resendMessage && (
            <div className={styles.successNote}>
              <FontAwesomeIcon icon='circle-check' />
              {resendMessage}
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
            disabled={resendLoading}
          >
            {resendLoading ? 'Resending…' : 'Resend verification email'}
          </button>

          <button className={styles.signOutBtn} onClick={logout}>
            Sign out and use a different account
          </button>
        </div>
      </div>
    </div>
  )
}

export default VerifyPending
