// src/pages/VerifyEmail.jsx
import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { supabase } from '../lib/supabase'
import styles from './VerifyEmail.module.css'

function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState('verifying')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function verify() {
      if (!token) {
        setErrorMessage('No verification token found in this link.')
        setStatus('error')
        return
      }

      try {
        // 1. Look up the token
        const { data, error } = await supabase
          .from('email_verifications')
          .select('*')
          .eq('token', token)
          .single()

        if (error || !data) {
          setErrorMessage(
            'This verification link is invalid or has already been used.'
          )
          setStatus('error')
          return
        }

        if (data.used_at) {
          setErrorMessage('This verification link has already been used.')
          setStatus('error')
          return
        }

        if (new Date(data.expires_at) < new Date()) {
          setErrorMessage(
            'This verification link has expired. Please request a new one.'
          )
          setStatus('error')
          return
        }

        // 2. Mark token as used
        await supabase
          .from('email_verifications')
          .update({ used_at: new Date().toISOString() })
          .eq('token', token)

        // 3. Set email_verified = true via backend — bypasses RLS
        const verifyRes = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/verify-email`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.user_id }),
          }
        )

        if (!verifyRes.ok) {
          setErrorMessage('Something went wrong. Please try again.')
          setStatus('error')
          return
        }

        setStatus('success')

        // 4. Redirect to login after 2.5s
        setTimeout(() => {
          window.location.href = '/login'
        }, 2500)
      } catch (err) {
        console.error('VerifyEmail error:', err)
        setErrorMessage('Something went wrong. Please try again.')
        setStatus('error')
      }
    }

    verify()
  }, [token])

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
            <p className={styles.subtitle}>Just a moment.</p>
          </div>
        )}

        {status === 'success' && (
          <div className={styles.centred}>
            <div className={styles.successIcon}>
              <FontAwesomeIcon icon='circle-check' />
            </div>
            <h1 className={styles.title}>Email verified</h1>
            <p className={styles.subtitle}>
              Your email has been confirmed. Redirecting you to login…
            </p>
            <div className={styles.redirectNote}>
              <FontAwesomeIcon icon='spinner' spin /> Redirecting…
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className={styles.centred}>
            <div className={styles.errorIcon}>
              <FontAwesomeIcon icon='triangle-exclamation' />
            </div>
            <h1 className={styles.title}>Verification failed</h1>
            <p className={styles.subtitle}>{errorMessage}</p>
            <Link to='/verify-pending' className={styles.linkBtn}>
              Request a new verification email
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default VerifyEmail
