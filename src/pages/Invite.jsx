import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { supabase } from '../lib/supabase'
import {
  fetchInviteToken,
  markTokenUsed,
  ROLE_LABELS,
} from '../utils/inviteTokens'
import styles from './Invite.module.css'

function Invite() {
  const { token } = useParams()

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
      const { data: authData, error: signUpError } = await supabase.auth.signUp(
        {
          email: form.email,
          password: form.password,
        }
      )

      if (signUpError) throw signUpError
      if (!authData.user) throw new Error('Signup failed — no user returned')

      const userId = authData.user.id

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData?.session && authData.session) {
        await supabase.auth.setSession({
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
        })
      }

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

      await markTokenUsed(token, userId)
      await supabase.auth.signOut()
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
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>
            Rot<span className={styles.logoAccent}>app</span>
          </div>
          <div className={styles.centred}>
            <div className={styles.spinner} />
            <p className={styles.subtitle}>Validating your invite link…</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Invalid token ──
  if (tokenState === 'invalid') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>
            Rot<span className={styles.logoAccent}>app</span>
          </div>
          <div className={styles.centred}>
            <div className={styles.errorIcon}>
              <FontAwesomeIcon icon='xmark' />
            </div>
            <h1 className={styles.title}>Invalid invite link</h1>
            <p className={styles.subtitle}>{tokenError}</p>
            <p className={styles.hint}>
              Please ask your manager to generate a new onboarding link.
            </p>
            <Link to='/login' className={styles.linkBtn}>
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
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}>
            Rot<span className={styles.logoAccent}>app</span>
          </div>
          <div className={styles.centred}>
            <div className={styles.pendingIcon}>
              <FontAwesomeIcon icon='hourglass' />
            </div>
            <h1 className={styles.title}>Request submitted</h1>
            <p className={styles.subtitle}>
              Your account is pending approval.
              {homeName
                ? ` Your manager at ${homeName} will review your request.`
                : ` Your operational lead will review your request.`}
            </p>
            <p className={styles.hint}>
              You'll be able to log in once your account has been approved.
            </p>

            <Link to='/login' className={styles.linkBtn}>
              Back to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const steps = ['Account', 'Details', 'Done']

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          Rot<span className={styles.logoAccent}>app</span>
        </div>

        {/* Step indicators */}
        <div className={styles.steps}>
          {steps.map((label, i) => (
            <div key={label} className={styles.stepItem}>
              <div
                className={styles.stepNum}
                style={{
                  background:
                    i + 1 < step
                      ? 'var(--accent)'
                      : i + 1 === step
                        ? 'var(--accent-bg)'
                        : 'transparent',
                  color:
                    i + 1 <= step ? 'var(--accent)' : 'var(--text-secondary)',
                  border:
                    i + 1 <= step
                      ? '1.5px solid var(--accent)'
                      : '1.5px solid var(--border-default)',
                }}
              >
                {i + 1 < step ? <FontAwesomeIcon icon='check' /> : i + 1}
              </div>
              <span
                className={styles.stepLabel}
                style={{
                  color:
                    i + 1 === step
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                }}
              >
                {label}
              </span>
              {i < steps.length - 1 && <div className={styles.stepLine} />}
            </div>
          ))}
        </div>

        {/* Context strip */}
        <div className={styles.contextStrip}>
          <span className={styles.contextItem}>
            <span className={styles.contextLabel}>Role</span>
            <span className={styles.contextVal}>
              {ROLE_LABELS[tokenData?.role]}
            </span>
          </span>
          {homeName ? (
            <span className={styles.contextItem}>
              <span className={styles.contextLabel}>Home</span>
              <span className={styles.contextVal}>{homeName}</span>
            </span>
          ) : (
            <span className={styles.contextItem}>
              <span className={styles.contextLabel}>Pool</span>
              <span className={styles.contextVal}>Org-wide relief</span>
            </span>
          )}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>Step 1 of 2 — Login details</p>
            <form onSubmit={handleStep1} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Full name</label>
                <input
                  className={styles.input}
                  type='text'
                  placeholder='Your full name'
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email address</label>
                <input
                  className={styles.input}
                  type='email'
                  placeholder='you@example.com'
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Password</label>
                <input
                  className={styles.input}
                  type='password'
                  placeholder='At least 8 characters'
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirm password</label>
                <input
                  className={styles.input}
                  type='password'
                  placeholder='Repeat password'
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  required
                />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button className={styles.primaryBtn} type='submit'>
                Continue →
              </button>
            </form>
          </>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <>
            <h1 className={styles.title}>Your details</h1>
            <p className={styles.subtitle}>Step 2 of 2 — Personal info</p>
            <form onSubmit={handleStep2} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Gender</label>
                <select
                  className={styles.input}
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
              <div className={styles.checkRow}>
                <input
                  type='checkbox'
                  id='driver'
                  checked={form.driver}
                  onChange={(e) => update('driver', e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor='driver' className={styles.checkLabel}>
                  I am certified to drive the company vehicle
                </label>
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <div className={styles.btnRow}>
                <button
                  type='button'
                  className={styles.backBtn}
                  onClick={() => {
                    setStep(1)
                    setError('')
                  }}
                >
                  <FontAwesomeIcon icon='chevron-left' /> Back
                </button>
                <button
                  className={styles.primaryBtn}
                  type='submit'
                  disabled={loading}
                >
                  {loading ? 'Submitting…' : 'Submit →'}
                </button>
              </div>
            </form>
          </>
        )}

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link to='/login' className={styles.footerLink}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Invite
