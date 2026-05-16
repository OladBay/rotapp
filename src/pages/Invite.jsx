// src/pages/Invite.jsx
import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { supabase } from '../lib/supabase'
import {
  fetchInviteToken,
  markTokenUsed,
  ROLE_LABELS,
} from '../utils/inviteTokens'
import styles from './Invite.module.css'

const CONTRACT_LABELS = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  'zero-hours': 'Zero-hours',
}

const COUNTRY_CODES = [
  { code: 'GB', dial: '+44', flag: '🇬🇧' },
  { code: 'US', dial: '+1', flag: '🇺🇸' },
  { code: 'IE', dial: '+353', flag: '🇮🇪' },
  { code: 'AU', dial: '+61', flag: '🇦🇺' },
  { code: 'CA', dial: '+1', flag: '🇨🇦' },
  { code: 'NZ', dial: '+64', flag: '🇳🇿' },
  { code: 'ZA', dial: '+27', flag: '🇿🇦' },
  { code: 'NG', dial: '+234', flag: '🇳🇬' },
  { code: 'GH', dial: '+233', flag: '🇬🇭' },
  { code: 'IN', dial: '+91', flag: '🇮🇳' },
  { code: 'PK', dial: '+92', flag: '🇵🇰' },
  { code: 'PH', dial: '+63', flag: '🇵🇭' },
  { code: 'DE', dial: '+49', flag: '🇩🇪' },
  { code: 'FR', dial: '+33', flag: '🇫🇷' },
  { code: 'ES', dial: '+34', flag: '🇪🇸' },
  { code: 'IT', dial: '+39', flag: '🇮🇹' },
  { code: 'PT', dial: '+351', flag: '🇵🇹' },
  { code: 'RO', dial: '+40', flag: '🇷🇴' },
  { code: 'PL', dial: '+48', flag: '🇵🇱' },
  { code: 'OTHER', dial: '+', flag: '🌍' },
]

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function Invite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [tokenState, setTokenState] = useState('loading')
  const [tokenData, setTokenData] = useState(null)
  const [tokenError, setTokenError] = useState('')
  const [homeName, setHomeName] = useState(null)
  const [orgName, setOrgName] = useState(null)
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    password: '',
    confirmPassword: '',
    gender: '',
    driver: false,
    phoneCountry: '+44',
    phoneNumber: '',
  })

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  // ── Validate token on mount ────────────────────────────────
  useEffect(() => {
    async function validate() {
      if (!token) {
        setTokenError('No invite token found in this link.')
        setTokenState('invalid')
        return
      }
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

  // ── Fetch home name and org name once token is valid ───────
  useEffect(() => {
    if (!tokenData) return

    if (tokenData.home_id) {
      supabase
        .from('homes')
        .select('name')
        .eq('id', tokenData.home_id)
        .single()
        .then(({ data }) => {
          if (data) setHomeName(data.name)
        })
    }

    if (tokenData.org_id) {
      supabase
        .from('orgs')
        .select('name')
        .eq('id', tokenData.org_id)
        .single()
        .then(({ data }) => {
          if (data) setOrgName(data.name)
        })
    }
  }, [tokenData])

  // ── Step 1 validation ──────────────────────────────────────
  const handleStep1 = (e) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError('Please enter your full name')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setStep(2)
  }

  // ── Step 2 validation ──────────────────────────────────────
  const handleStep2 = (e) => {
    e.preventDefault()
    setError('')
    if (!form.gender) {
      setError('Please select your gender')
      return
    }
    const digitsOnly = form.phoneNumber.replace(/\D/g, '')
    if (!form.phoneNumber.trim() || digitsOnly.length < 7) {
      setError('Please enter a valid phone number')
      return
    }
    setStep(3)
  }

  // ── Step 3 — submit ────────────────────────────────────────
  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    try {
      // 1. Sign up with Supabase auth
      // handle_new_user trigger reads metadata and creates profile row
      const { data: authData, error: signUpError } = await supabase.auth.signUp(
        {
          email: tokenData.invited_email,
          password: form.password,
          options: {
            data: {
              name: form.name.trim(),
              role: tokenData.role,
              status: 'pending',
            },
          },
        }
      )

      if (signUpError) throw signUpError
      if (!authData.user) throw new Error('Signup failed — no user returned')

      const userId = authData.user.id

      // 2. Auto-confirm email — invite link proves email ownership
      const confirmRes = await fetch(`${API_BASE}/api/auth/confirm-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!confirmRes.ok) {
        const confirmData = await confirmRes.json().catch(() => ({}))
        throw new Error(confirmData.error || 'Failed to confirm email')
      }

      // 3. Update profile via backend — bypasses RLS
      // signUp() with email confirmations disabled returns no session
      // so auth.uid() is null and direct Supabase update would be blocked
      const profileRes = await fetch(`${API_BASE}/api/auth/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          updates: {
            name: form.name.trim(),
            home: tokenData.home_id || null,
            org_id: tokenData.org_id,
            gender: form.gender,
            driver: form.driver,
            phone: form.phoneNumber.trim()
              ? `${form.phoneCountry}${form.phoneNumber.trim()}`
              : null,
            contract_type: tokenData.contract_type,
            contracted_hours: tokenData.contracted_hours || null,
            invited_by: tokenData.invited_by,
            status: 'pending',
            email_verified: true,
          },
        }),
      })

      if (!profileRes.ok) {
        const profileData = await profileRes.json().catch(() => ({}))
        throw new Error(profileData.error || 'Failed to update profile')
      }

      // 4. Mark token as used
      await markTokenUsed(token, userId)

      // 5. Send pending approval email via Resend
      await fetch(`${API_BASE}/api/email/staff-pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: tokenData.invited_email,
          staffName: form.name.trim(),
          roleName: ROLE_LABELS[tokenData.role],
          homeName: homeName || null,
          orgName: orgName || null,
        }),
      })

      // 6. Sign out — they must await approval
      await supabase.auth.signOut()

      setStep(4)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────
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

  // ── Invalid token ──────────────────────────────────────────
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
              Please ask your manager to send a new invite.
            </p>
            <Link to='/login' className={styles.linkBtn}>
              Back to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 4 — Done ──────────────────────────────────────────
  if (step === 4) {
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
            <h1 className={styles.title}>Account pending approval</h1>
            <p className={styles.subtitle}>
              Awaiting approval from{' '}
              {homeName
                ? `the manager at ${homeName}`
                : 'your operational lead'}
              .
            </p>
            <p className={styles.hint}>
              You'll receive an email once your account has been approved.
            </p>
            <Link to='/login' className={styles.linkBtn}>
              Go to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Step indicators ────────────────────────────────────────
  const steps = ['Account', 'Details', 'Review']

  const genderLabel =
    form.gender === 'M'
      ? 'Male'
      : form.gender === 'F'
        ? 'Female'
        : form.gender === 'O'
          ? 'Prefer not to say'
          : '—'

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
                className={`${styles.stepNum} ${
                  i + 1 < step
                    ? styles.stepDone
                    : i + 1 === step
                      ? styles.stepActive
                      : styles.stepInactive
                }`}
              >
                {i + 1 < step ? <FontAwesomeIcon icon='check' /> : i + 1}
              </div>
              <span
                className={`${styles.stepLabel} ${
                  i + 1 === step ? styles.stepLabelActive : ''
                }`}
              >
                {label}
              </span>
              {i < steps.length - 1 && <div className={styles.stepLine} />}
            </div>
          ))}
        </div>

        {/* ── Step 1 — Account ──────────────────────────────── */}
        {step === 1 && (
          <>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>Step 1 of 3 — Login details</p>
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
                  className={`${styles.input} ${styles.inputReadOnly}`}
                  type='email'
                  value={tokenData?.invited_email || ''}
                  readOnly
                  tabIndex={-1}
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
                  placeholder='Repeat your password'
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className={styles.error}>
                  <FontAwesomeIcon icon='triangle-exclamation' />
                  {error}
                </div>
              )}

              <button className={styles.primaryBtn} type='submit'>
                Continue <FontAwesomeIcon icon='chevron-right' />
              </button>
            </form>
          </>
        )}

        {/* ── Step 2 — Personal details ─────────────────────── */}
        {step === 2 && (
          <>
            <h1 className={styles.title}>Your details</h1>
            <p className={styles.subtitle}>Step 2 of 3 — Personal info</p>
            <form onSubmit={handleStep2} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Gender</label>
                <div className={styles.genderGrid}>
                  {[
                    { value: 'M', label: 'Male' },
                    { value: 'F', label: 'Female' },
                    { value: 'O', label: 'Prefer not to say' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type='button'
                      className={`${styles.genderChip} ${
                        form.gender === opt.value ? styles.genderChipActive : ''
                      }`}
                      onClick={() => update('gender', opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Phone number</label>
                <div className={styles.phoneWrap}>
                  <select
                    className={styles.countrySelect}
                    value={form.phoneCountry}
                    onChange={(e) => update('phoneCountry', e.target.value)}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.dial}>
                        {c.flag} {c.dial}
                      </option>
                    ))}
                  </select>
                  <input
                    className={styles.phoneNumberInput}
                    type='tel'
                    placeholder='7700 000000'
                    value={form.phoneNumber}
                    onChange={(e) => update('phoneNumber', e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type='button'
                className={`${styles.driverRow} ${
                  form.driver ? styles.driverRowActive : ''
                }`}
                onClick={() => update('driver', !form.driver)}
              >
                <div
                  className={`${styles.driverCheck} ${
                    form.driver ? styles.driverCheckActive : ''
                  }`}
                >
                  {form.driver && <FontAwesomeIcon icon='check' />}
                </div>
                <span className={styles.driverLabel}>
                  I am certified to drive the company vehicle
                </span>
              </button>

              {error && (
                <div className={styles.error}>
                  <FontAwesomeIcon icon='triangle-exclamation' />
                  {error}
                </div>
              )}

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
                <button className={styles.primaryBtn} type='submit'>
                  Continue <FontAwesomeIcon icon='chevron-right' />
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Step 3 — Review ───────────────────────────────── */}
        {step === 3 && (
          <>
            <h1 className={styles.title}>Review your details</h1>
            <p className={styles.subtitle}>Step 3 of 3 — Confirm and submit</p>

            {/* Your placement — from token, read-only */}
            <div className={styles.reviewSection}>
              <div className={styles.reviewSectionHeader}>
                <span className={styles.reviewSectionTitle}>
                  Your placement
                </span>
              </div>
              <div className={styles.reviewRows}>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Organisation</span>
                  <span className={styles.reviewValue}>{orgName || '—'}</span>
                </div>
                <div className={styles.reviewDivider} />
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Role</span>
                  <span className={styles.reviewValue}>
                    {ROLE_LABELS[tokenData?.role]}
                  </span>
                </div>
                <div className={styles.reviewDivider} />
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Home</span>
                  <span className={styles.reviewValue}>
                    {homeName || 'Org-wide relief'}
                  </span>
                </div>
                <div className={styles.reviewDivider} />
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Contract</span>
                  <span className={styles.reviewValue}>
                    {CONTRACT_LABELS[tokenData?.contract_type] || '—'}
                  </span>
                </div>
                {tokenData?.contracted_hours && (
                  <>
                    <div className={styles.reviewDivider} />
                    <div className={styles.reviewRow}>
                      <span className={styles.reviewLabel}>Hours</span>
                      <span className={styles.reviewValue}>
                        {tokenData.contracted_hours} hrs / week
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Your details — entered by staff */}
            <div className={styles.reviewSection}>
              <div className={styles.reviewSectionHeader}>
                <span className={styles.reviewSectionTitle}>Your details</span>
              </div>
              <div className={styles.reviewRows}>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Name</span>
                  <span className={styles.reviewValue}>{form.name}</span>
                </div>
                <div className={styles.reviewDivider} />
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Email</span>
                  <span className={styles.reviewValue}>
                    {tokenData?.invited_email}
                  </span>
                </div>
                <div className={styles.reviewDivider} />
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Gender</span>
                  <span className={styles.reviewValue}>{genderLabel}</span>
                </div>
                <div className={styles.reviewDivider} />
                <div className={styles.reviewRow}>
                  <span className={styles.reviewLabel}>Driver</span>
                  <span className={styles.reviewValue}>
                    {form.driver ? 'Yes' : 'No'}
                  </span>
                </div>
                {form.phoneNumber && (
                  <>
                    <div className={styles.reviewDivider} />
                    <div className={styles.reviewRow}>
                      <span className={styles.reviewLabel}>Phone</span>
                      <span className={styles.reviewValue}>
                        {form.phoneCountry} {form.phoneNumber}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className={styles.error}>
                <FontAwesomeIcon icon='triangle-exclamation' />
                {error}
              </div>
            )}

            <div className={styles.btnRow}>
              <button
                type='button'
                className={styles.backBtn}
                onClick={() => {
                  setStep(2)
                  setError('')
                }}
              >
                <FontAwesomeIcon icon='chevron-left' /> Back
              </button>
              <button
                className={styles.primaryBtn}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon='spinner' spin /> Submitting…
                  </>
                ) : (
                  <>
                    Confirm & submit <FontAwesomeIcon icon='chevron-right' />
                  </>
                )}
              </button>
            </div>
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
