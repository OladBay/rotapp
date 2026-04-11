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
      setError(err.message || 'Invalid email or password')
      setLoading(false)
    }
  }

  // Blocked screens
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
            <input
              className={styles.input}
              type='email'
              placeholder='you@example.com'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type='password'
              placeholder='••••••••'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <Button
            type='submit'
            variant='primary'
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className={styles.footer}>
          Don't have an account? <Link to='/signup'>Sign up</Link>
        </p>

        <div className={styles.testAccounts}>
          <p className={styles.testTitle}>Test accounts</p>
          <div className={styles.testGrid}>
            <span>admin@rotapp.com</span>
            <span>admin123</span>
            <span>claire@rotapp.com</span>
            <span>test123</span>
            <span>dayo@rotapp.com</span>
            <span>test123</span>
            <span>tyler@rotapp.com</span>
            <span>test123</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
