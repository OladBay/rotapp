import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import styles from './Login.module.css'

const ls = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-base, #0f1117)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: 'DM Sans, sans-serif',
  },
  card: {
    background: 'var(--bg-card, #161820)',
    border: '1px solid var(--border-default)',
    borderRadius: '20px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
  },
  logo: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '28px',
    letterSpacing: '-0.5px',
  },
  accent: { color: 'var(--accent)' },
  blockedWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px',
  },
  blockedIcon: { fontSize: '40px' },
  blockedIconRed: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'rgba(232,92,61,0.12)',
    color: '#e85c3d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    fontWeight: 700,
  },
  blockedTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'Syne, sans-serif',
    margin: 0,
  },
  blockedText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    margin: 0,
  },
  blockedBtn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    marginTop: '8px',
  },
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, user } = useAuth()
  const navigate = useNavigate()

  // Must be before any early returns — React hook rules
  useEffect(() => {
    if (user && !user.blockedStatus) {
      const role = user.activeRole
      if (role === 'rcw' || role === 'relief') {
        navigate('/calendar')
      } else {
        navigate('/dashboard')
      }
    }
  }, [user])

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

  // Blocked screens — after hooks, before main render
  if (user?.blockedStatus === 'pending') {
    return (
      <div style={ls.page}>
        <div style={ls.card}>
          <div style={ls.logo}>
            Rot<span style={ls.accent}>app</span>
          </div>
          <div style={ls.blockedWrap}>
            <div style={ls.blockedIcon}>⏳</div>
            <h1 style={ls.blockedTitle}>Account pending approval</h1>
            <p style={ls.blockedText}>
              Your account is awaiting approval from your manager. You'll be
              able to log in once it's been approved.
            </p>
            <button
              style={ls.blockedBtn}
              onClick={() => {
                supabase.auth.signOut()
                window.location.reload()
              }}
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (user?.blockedStatus === 'suspended') {
    return (
      <div style={ls.page}>
        <div style={ls.card}>
          <div style={ls.logo}>
            Rot<span style={ls.accent}>app</span>
          </div>
          <div style={ls.blockedWrap}>
            <div style={ls.blockedIconRed}>✕</div>
            <h1 style={ls.blockedTitle}>Account suspended</h1>
            <p style={ls.blockedText}>
              Your account has been suspended. Please contact your manager or
              operational lead.
            </p>
            <button
              style={ls.blockedBtn}
              onClick={() => {
                supabase.auth.signOut()
                window.location.reload()
              }}
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          Rot<span>app</span>
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

          <button className={styles.btn} type='submit' disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
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
