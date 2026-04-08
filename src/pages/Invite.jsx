import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  fetchInviteToken,
  markTokenUsed,
  ROLE_LABELS,
} from '../utils/inviteTokens'

function Invite() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [tokenState, setTokenState] = useState('loading')
  const [tokenData, setTokenData] = useState(null)
  const [tokenError, setTokenError] = useState('')
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    gender: '',
    driver: false,
  })

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  useEffect(() => {
    async function validate() {
      const result = await fetchInviteToken(token)
      if (!result.valid) {
        setTokenError(result.reason)
        setTokenState('invalid')
      } else {
        setTokenData(result.tokenData)
        setTokenState('valid')
      }
    }
    validate()
  }, [token])

  const [homeName, setHomeName] = useState(null)

  useEffect(() => {
    if (!tokenData?.home_id) return
    supabase
      .from('homes')
      .select('name')
      .eq('id', tokenData.home_id)
      .single()
      .then(({ data }) => {
        if (data) setHomeName(data.name)
      })
  }, [tokenData])

  const handleStep1 = (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setStep(2)
  }

  const handleStep2 = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.gender) {
      setError('Please select a gender')
      return
    }
    setLoading(true)

    try {
      // 1. Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp(
        {
          email: form.email,
          password: form.password,
        }
      )

      if (signUpError) throw signUpError
      if (!authData.user) throw new Error('Signup failed — no user returned')

      const userId = authData.user.id

      // 2. Wait for session to be fully established
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session && authData.session) {
        await supabase.auth.setSession({
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
        })
      }

      // 3. Update the profile row created by the trigger
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: form.name,
          role: tokenData.role,
          active_role: tokenData.role,
          home: tokenData.home_id || null,
          org_id: tokenData.org_id,
          gender: form.gender,
          driver: form.driver,
          status: 'pending',
          invited_by: tokenData.invited_by,
        })
        .eq('id', userId)

      if (profileError) {
        console.error('Profile update error:', profileError)
        throw profileError
      }

      // 4. Stamp role and home into auth metadata for RLS
      try {
        await supabase.auth.updateUser({
          data: {
            role: tokenData.role,
            home: tokenData.home_id || null,
          },
        })
      } catch (metaErr) {
        console.warn('Metadata stamp failed (non-critical):', metaErr)
      }

      // 5. Mark token as used
      await markTokenUsed(token, userId)

      // 5. Sign out so they don't land on dashboard as pending user
      await supabase.auth.signOut()

      // 6. Done
      setStep(3)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Loading ──
  if (tokenState === 'loading') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.logo}>
            Rot<span style={s.accent}>app</span>
          </div>
          <div style={s.centred}>
            <div style={s.spinner} />
            <p style={s.subtitle}>Validating your invite link…</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Invalid token ──
  if (tokenState === 'invalid') {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.logo}>
            Rot<span style={s.accent}>app</span>
          </div>
          <div style={s.centred}>
            <div style={s.errorIcon}>✕</div>
            <h1 style={s.title}>Invalid invite link</h1>
            <p style={s.subtitle}>{tokenError}</p>
            <p style={s.hint}>
              Please ask your manager to generate a new onboarding link.
            </p>
            <Link to='/login' style={s.linkBtn}>
              Back to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3 — Done ──
  if (step === 3) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.logo}>
            Rot<span style={s.accent}>app</span>
          </div>
          <div style={s.centred}>
            <div style={s.pendingIcon}>⏳</div>
            <h1 style={s.title}>Request submitted</h1>
            <p style={s.subtitle}>
              Your account is pending approval.
              {homeName
                ? ` Your manager at ${homeName} will review your request.`
                : ` Your operational lead will review your request.`}
            </p>
            <p style={s.hint}>
              You'll be able to log in once your account has been approved.
            </p>
            <button style={s.primaryBtn} onClick={() => navigate('/login')}>
              Back to login
            </button>
          </div>
        </div>
      </div>
    )
  }

  const steps = ['Account', 'Details', 'Done']

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          Rot<span style={s.accent}>app</span>
        </div>

        {/* Step indicators */}
        <div style={s.steps}>
          {steps.map((label, i) => (
            <div key={label} style={s.stepItem}>
              <div
                style={{
                  ...s.stepNum,
                  background:
                    i + 1 < step
                      ? 'var(--accent)'
                      : i + 1 === step
                        ? 'rgba(108,143,255,0.15)'
                        : 'transparent',
                  color:
                    i + 1 <= step ? 'var(--accent)' : 'var(--text-secondary)',
                  border:
                    i + 1 <= step
                      ? '1.5px solid var(--accent)'
                      : '1.5px solid var(--border-default)',
                }}
              >
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <span
                style={{
                  ...s.stepLabel,
                  color:
                    i + 1 === step
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                }}
              >
                {label}
              </span>
              {i < steps.length - 1 && <div style={s.stepLine} />}
            </div>
          ))}
        </div>

        {/* Context strip */}
        <div style={s.contextStrip}>
          <span style={s.contextItem}>
            <span style={s.contextLabel}>Role</span>
            <span style={s.contextVal}>{ROLE_LABELS[tokenData?.role]}</span>
          </span>
          {homeName ? (
            <span style={s.contextItem}>
              <span style={s.contextLabel}>Home</span>
              <span style={s.contextVal}>{homeName}</span>
            </span>
          ) : (
            <span style={s.contextItem}>
              <span style={s.contextLabel}>Pool</span>
              <span style={s.contextVal}>Org-wide relief</span>
            </span>
          )}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <>
            <h1 style={s.title}>Create your account</h1>
            <p style={s.subtitle}>Step 1 of 2 — Login details</p>
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
                <label style={s.label}>Email address</label>
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
                  placeholder='At least 8 characters'
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
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
              <button style={s.primaryBtn} type='submit'>
                Continue →
              </button>
            </form>
          </>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <>
            <h1 style={s.title}>Your details</h1>
            <p style={s.subtitle}>Step 2 of 2 — Personal info</p>
            <form onSubmit={handleStep2} style={s.form}>
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
                  onClick={() => {
                    setStep(1)
                    setError('')
                  }}
                >
                  ← Back
                </button>
                <button style={s.primaryBtn} type='submit' disabled={loading}>
                  {loading ? 'Submitting…' : 'Submit →'}
                </button>
              </div>
            </form>
          </>
        )}

        <p style={s.footer}>
          Already have an account?{' '}
          <Link to='/login' style={s.footerLink}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

const s = {
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
    maxWidth: '420px',
  },
  logo: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: '24px',
    letterSpacing: '-0.5px',
  },
  accent: { color: 'var(--accent)' },
  steps: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '4px',
  },
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
    width: '20px',
    height: '1px',
    background: 'var(--border-default)',
    margin: '0 4px',
  },
  contextStrip: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    background: 'rgba(108,143,255,0.06)',
    border: '1px solid rgba(108,143,255,0.15)',
    borderRadius: '8px',
    padding: '10px 14px',
    marginBottom: '20px',
  },
  contextItem: { display: 'flex', flexDirection: 'column', gap: '2px' },
  contextLabel: {
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  contextVal: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--accent)',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '4px',
    letterSpacing: '-0.3px',
    fontFamily: 'Syne, sans-serif',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '20px',
    lineHeight: 1.5,
  },
  hint: {
    fontSize: '12.5px',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    marginBottom: '8px',
    textAlign: 'center',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' },
  input: {
    background: 'var(--bg-input, #1d1f2b)',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    padding: '9px 12px',
    fontSize: '13px',
    fontFamily: 'DM Sans, sans-serif',
    width: '100%',
  },
  checkRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  checkLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  error: {
    fontSize: '13px',
    color: 'var(--color-danger)',
    background: 'rgba(232,92,61,0.08)',
    border: '1px solid rgba(232,92,61,0.2)',
    borderRadius: '8px',
    padding: '10px 12px',
  },
  primaryBtn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    flex: 1,
  },
  backBtn: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  btnRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px',
  },
  centred: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px',
    padding: '16px 0',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--border-default)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'rgba(232,92,61,0.12)',
    color: 'var(--color-danger)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 700,
  },
  pendingIcon: { fontSize: '40px' },
  linkBtn: { color: 'var(--accent)', fontSize: '13px', textDecoration: 'none' },
  footer: {
    marginTop: '20px',
    fontSize: '13px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  footerLink: { color: 'var(--accent)', textDecoration: 'none' },
}

export default Invite
