import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { mockUsers } from '../data/mockUsers'
import styles from './Login.module.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    setTimeout(() => {
      const user = mockUsers.find(
        (u) => u.email === email && u.password === password
      )

      if (!user) {
        setError('Invalid email or password')
        setLoading(false)
        return
      }

      login(user)

      const role = user.activeRole
      if (role === 'rcw' || role === 'relief') {
        navigate('/calendar')
      } else {
        navigate('/dashboard')
      }
    }, 600)
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
