import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { mockUsers } from '../data/mockUsers'
import { mockHomes } from '../data/mockHomes'

function Signup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    home: '',
    role: 'rcw',
    gender: '',
    driver: false,
  })

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleStep1 = (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    const exists = mockUsers.find((u) => u.email === form.email)
    if (exists) {
      setError('An account with this email already exists')
      return
    }
    setStep(2)
  }

  const handleStep2 = (e) => {
    e.preventDefault()
    setError('')
    if (!form.home) {
      setError('Please select a home')
      return
    }
    if (!form.gender) {
      setError('Please select a gender')
      return
    }
    setLoading(true)
    setTimeout(() => {
      setStep(3)
      setLoading(false)
    }, 800)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          Rot<span style={s.accent}>app</span>
        </div>

        {/* Step indicators */}
        <div style={s.steps}>
          {['Account', 'Details', 'Done'].map((label, i) => (
            <div key={label} style={s.stepItem}>
              <div
                style={{
                  ...s.stepNum,
                  background:
                    i + 1 < step
                      ? '#6c8fff'
                      : i + 1 === step
                        ? 'rgba(108,143,255,0.15)'
                        : 'transparent',
                  color: i + 1 <= step ? '#6c8fff' : '#5d6180',
                  border:
                    i + 1 === step
                      ? '1.5px solid #6c8fff'
                      : i + 1 < step
                        ? '1.5px solid #6c8fff'
                        : '1.5px solid rgba(255,255,255,0.1)',
                }}
              >
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <span
                style={{
                  ...s.stepLabel,
                  color: i + 1 === step ? '#e8eaf0' : '#5d6180',
                }}
              >
                {label}
              </span>
              {i < 2 && <div style={s.stepLine} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Account */}
        {step === 1 && (
          <>
            <h1 style={s.title}>Create account</h1>
            <p style={s.subtitle}>Step 1 of 2 — Your login details</p>
            <form onSubmit={handleStep1} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Full name</label>
                <input
                  style={s.input}
                  type='text'
                  placeholder='Your full name'
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  required
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Email</label>
                <input
                  style={s.input}
                  type='email'
                  placeholder='you@example.com'
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Password</label>
                <input
                  style={s.input}
                  type='password'
                  placeholder='Min 6 characters'
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Confirm password</label>
                <input
                  style={s.input}
                  type='password'
                  placeholder='Repeat password'
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  required
                />
              </div>
              {error && <div style={s.error}>{error}</div>}
              <button style={s.btn} type='submit'>
                Continue →
              </button>
            </form>
          </>
        )}

        {/* Step 2 — Details */}
        {step === 2 && (
          <>
            <h1 style={s.title}>Your details</h1>
            <p style={s.subtitle}>Step 2 of 2 — Home and role</p>
            <form onSubmit={handleStep2} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Home</label>
                <select
                  style={s.input}
                  value={form.home}
                  onChange={(e) => update('home', e.target.value)}
                  required
                >
                  <option value=''>Select your home</option>
                  {mockHomes.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Role</label>
                <select
                  style={s.input}
                  value={form.role}
                  onChange={(e) => update('role', e.target.value)}
                >
                  <option value='rcw'>Residential Care Worker (RCW)</option>
                  <option value='relief'>Relief / Bank Staff</option>
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Gender</label>
                <select
                  style={s.input}
                  value={form.gender}
                  onChange={(e) => update('gender', e.target.value)}
                  required
                >
                  <option value=''>Select gender</option>
                  <option value='M'>Male</option>
                  <option value='F'>Female</option>
                  <option value='O'>Prefer not to say</option>
                </select>
              </div>
              <div style={s.checkRow}>
                <input
                  type='checkbox'
                  id='driver'
                  checked={form.driver}
                  onChange={(e) => update('driver', e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor='driver' style={s.checkLabel}>
                  I am certified to drive the company vehicle
                </label>
              </div>
              {error && <div style={s.error}>{error}</div>}
              <div style={s.btnRow}>
                <button
                  type='button'
                  style={s.backBtn}
                  onClick={() => setStep(1)}
                >
                  ← Back
                </button>
                <button style={s.btn} type='submit' disabled={loading}>
                  {loading ? 'Submitting…' : 'Submit →'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* Step 3 — Pending */}
        {step === 3 && (
          <div style={s.pendingWrap}>
            <div style={s.pendingIcon}>⏳</div>
            <h1 style={s.title}>Request submitted</h1>
            <p style={s.pendingText}>
              Your account is pending approval. Your manager at{' '}
              <strong style={{ color: '#e8eaf0' }}>
                {mockHomes.find((h) => h.id === form.home)?.name}
              </strong>{' '}
              will review your request and you'll receive a confirmation email
              once approved.
            </p>
            <button style={s.btn} onClick={() => navigate('/login')}>
              Back to login
            </button>
          </div>
        )}

        {step < 3 && (
          <p style={s.footer}>
            Already have an account?{' '}
            <Link to='/login' style={s.link}>
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0f1117',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: 'DM Sans, sans-serif',
  },
  card: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
  },
  logo: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '24px',
    fontWeight: 700,
    color: '#e8eaf0',
    marginBottom: '28px',
    letterSpacing: '-0.5px',
  },
  accent: { color: '#6c8fff' },
  steps: { display: 'flex', alignItems: 'center', marginBottom: '28px' },
  stepItem: { display: 'flex', alignItems: 'center', gap: '6px' },
  stepNum: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 500,
    flexShrink: 0,
  },
  stepLabel: { fontSize: '12px', whiteSpace: 'nowrap' },
  stepLine: {
    width: '24px',
    height: '1px',
    background: 'rgba(255,255,255,0.1)',
    margin: '0 6px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 600,
    color: '#e8eaf0',
    marginBottom: '6px',
    letterSpacing: '-0.3px',
    fontFamily: 'Syne, sans-serif',
  },
  subtitle: { fontSize: '13px', color: '#9499b0', marginBottom: '24px' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: 500, color: '#9499b0' },
  input: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '11px 14px',
    fontSize: '14px',
    color: '#e8eaf0',
    outline: 'none',
    fontFamily: 'DM Sans, sans-serif',
    width: '100%',
  },
  checkRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  checkLabel: { fontSize: '13px', color: '#9499b0', cursor: 'pointer' },
  error: {
    background: 'rgba(232,92,61,0.12)',
    border: '1px solid rgba(232,92,61,0.3)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#e85c3d',
  },
  btn: {
    background: '#6c8fff',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  backBtn: {
    background: 'transparent',
    color: '#9499b0',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '12px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    flex: 1,
  },
  btnRow: { display: 'flex', gap: '8px' },
  footer: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#9499b0',
    marginTop: '24px',
  },
  link: { color: '#6c8fff', textDecoration: 'none' },
  pendingWrap: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignItems: 'center',
  },
  pendingIcon: { fontSize: '40px', marginBottom: '8px' },
  pendingText: {
    fontSize: '13px',
    color: '#9499b0',
    lineHeight: 1.7,
    textAlign: 'center',
  },
}

export default Signup
