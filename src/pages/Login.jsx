// src/pages/Login.jsx
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Button from '../components/ui/Button/Button'
import styles from './Login.module.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && !user.blockedStatus) {
      const role = user.activeRole
      if (role === 'rcw' || role === 'relief') {
        navigate('/calendar')
      } else {
        navigate('/dashboard')
      }
    }
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      // Supabase returns "Email not confirmed" when the user has not
      // yet verified their email. Intercept this, show friendly copy,
      // and redirect to /verify-pending so they can resend.
      if (
        err.message?.toLowerCase().includes('email not confirmed') ||
        err.message?.toLowerCase().includes('not confirmed')
      ) {
        navigate('/verify-pending', { replace: true })
        return
      }
      setError(err.message || 'Invalid email or password')
      setLoading(false)
    }
  }

  if (user?.blockedStatus === 'pending') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>
            Rot<span className={styles.logoAccent}>app</span>
          </div>
          <div className={styles.blockedWrap}>
            <div className={styles.blockedIcon}>
              <FontAwesomeIcon icon='hourglass' />
            </div>
            <h1 className={styles.blockedTitle}>Account pending approval</h1>
            <p className={styles.blockedText}>
              Your account is awaiting approval from your manager. You'll be
              able to log in once it's been approved.
            </p>
            <Button
              variant='primary'
              onClick={() => {
                supabase.auth.signOut()
                window.location.reload()
              }}
            >
              Back to login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (user?.blockedStatus === 'suspended') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>
            Rot<span className={styles.logoAccent}>app</span>
          </div>
          <div className={styles.blockedWrap}>
            <div className={styles.blockedIconRed}>
              <FontAwesomeIcon icon='xmark' />
            </div>
            <h1 className={styles.blockedTitle}>Account suspended</h1>
            <p className={styles.blockedText}>
              Your account has been suspended. Please contact your manager or
              operational lead.
            </p>
            <Button
              variant='primary'
              onClick={() => {
                supabase.auth.signOut()
                window.location.reload()
              }}
            >
              Back to login
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          Rot<span className={styles.logoAccent}>app</span>
        </div>

        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to your account</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <div className={styles.inputWrap}>
              <FontAwesomeIcon icon='envelope' className={styles.inputIcon} />
              <input
                className={styles.input}
                type='email'
                placeholder='you@example.com'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <div className={styles.inputWrap}>
              <FontAwesomeIcon icon='shield' className={styles.inputIcon} />
              <input
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder='••••••••'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type='button'
                className={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                <FontAwesomeIcon icon={showPassword ? 'eye-slash' : 'eye'} />
              </button>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <Button
            type='submit'
            variant='primary'
            size='lg'
            loading={loading}
            disabled={loading}
            className={styles.submitBtn}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default Login
