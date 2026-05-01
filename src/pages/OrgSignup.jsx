// src/pages/OrgSignup.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { supabase } from '../lib/supabase'
import styles from './OrgSignup.module.css'

const STEPS = ['Account', 'Security', 'Done']

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

// ── VerifyScreen ───────────────────────────────────────────────────────────
// Simple holding screen shown immediately after signup.
// All resend logic lives in /verify-pending — single owner.
function VerifyScreen({ email }) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          Rot<span className={styles.logoAccent}>app</span>
        </div>
        <div className={styles.centred}>
          <div className={styles.verifyIcon}>
            <FontAwesomeIcon icon='envelope' />
          </div>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.subtitle}>
            We've sent a verification link to <strong>{email}</strong>. Click
            the link to continue setting up your organisation.
          </p>
          <p className={styles.hint}>Can't find it? Check your spam folder.</p>
          <p className={styles.hint}>
            Having trouble?{' '}
            <Link to='/verify-pending' className={styles.footerLink}>
              Go to verification page
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function OrgSignup() {
  const [screen, setScreen] = useState('form') // form | verify
  const [step, setStep] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneCountry: '+44',
    phoneNumber: '',
  })

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleStep1 = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Please enter your full name')
      return
    }
    if (!form.email.trim()) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('check_email_exists', {
        email_input: form.email.trim().toLowerCase(),
      })

      if (error) throw error

      if (data === true) {
        setError('An account with this email already exists. Sign in instead.')
        setLoading(false)
        return
      }

      setStep(2)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleStep2 = async (e) => {
    e.preventDefault()
    setError('')

    const digitsOnly = form.phoneNumber.replace(/\D/g, '')
    if (!form.phoneNumber.trim() || digitsOnly.length < 7) {
      setError('Please enter a valid phone number')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const fullPhone = form.phoneNumber.trim()
        ? `${form.phoneCountry}${form.phoneNumber.trim()}`
        : null

      // Pass name, phone, role and status as metadata.
      // The handle_new_user trigger reads these and writes them
      // directly into the profile row at creation time.
      // No client-side profile update needed — no session exists yet.
      const { data: authData, error: signUpError } = await supabase.auth.signUp(
        {
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              name: form.name.trim(),
              phone: fullPhone,
              role: 'operationallead',
              status: 'active',
            },
          },
        }
      )

      if (signUpError) throw signUpError
      if (!authData.user) throw new Error('Signup failed — no user returned')

      // Immediately sign out — no active session should exist until
      // the user clicks the verification link.
      await supabase.auth.signOut()

      setScreen('verify')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (screen === 'verify') {
    return <VerifyScreen email={form.email} />
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          Rot<span className={styles.logoAccent}>app</span>
        </div>

        {/* ── Step indicators ── */}
        <div className={styles.steps}>
          {STEPS.map((label, i) => (
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
              {i < STEPS.length - 1 && <div className={styles.stepLine} />}
            </div>
          ))}
        </div>

        {/* ── Step 1 — Identity ── */}
        {step === 1 && (
          <>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>Step 1 of 2 — Who are you?</p>

            <div className={styles.infoNote}>
              <FontAwesomeIcon
                icon='circle-info'
                className={styles.infoNoteIcon}
              />
              <p className={styles.infoText}>
                As the person setting up this organisation, your account will
                have full admin access. You can invite other team members once
                setup is complete.
              </p>
            </div>

            <form onSubmit={handleStep1} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Full name</label>
                <div className={styles.inputWrap}>
                  <FontAwesomeIcon icon='user' className={styles.inputIcon} />
                  <input
                    className={styles.input}
                    type='text'
                    placeholder='Your full name'
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Email address</label>
                <div className={styles.inputWrap}>
                  <FontAwesomeIcon
                    icon='envelope'
                    className={styles.inputIcon}
                  />
                  <input
                    className={styles.input}
                    type='email'
                    placeholder='you@example.com'
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    required
                  />
                </div>
                <p className={styles.fieldHint}>
                  Any email works — work or personal. We recommend your work
                  email if you have one.
                </p>
              </div>

              {error && <div className={styles.error}>{error}</div>}

              <button
                className={styles.primaryBtn}
                type='submit'
                disabled={loading}
              >
                {loading ? 'Checking…' : 'Continue →'}
              </button>
            </form>
          </>
        )}

        {/* ── Step 2 — Security ── */}
        {step === 2 && (
          <>
            <h1 className={styles.title}>Secure your account</h1>
            <p className={styles.subtitle}>Step 2 of 2 — Set a password</p>

            <form onSubmit={handleStep2} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Password</label>
                <div className={styles.inputWrap}>
                  <FontAwesomeIcon icon='shield' className={styles.inputIcon} />
                  <input
                    className={styles.input}
                    type={showPassword ? 'text' : 'password'}
                    placeholder='At least 8 characters'
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    required
                  />
                  <button
                    type='button'
                    className={styles.eyeBtn}
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                  >
                    <FontAwesomeIcon
                      icon={showPassword ? 'eye-slash' : 'eye'}
                    />
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Confirm password</label>
                <div className={styles.inputWrap}>
                  <FontAwesomeIcon icon='shield' className={styles.inputIcon} />
                  <input
                    className={styles.input}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder='Repeat your password'
                    value={form.confirmPassword}
                    onChange={(e) => update('confirmPassword', e.target.value)}
                    required
                  />
                  <button
                    type='button'
                    className={styles.eyeBtn}
                    onClick={() => setShowConfirm((v) => !v)}
                    tabIndex={-1}
                  >
                    <FontAwesomeIcon icon={showConfirm ? 'eye-slash' : 'eye'} />
                  </button>
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
                  {loading ? 'Creating account…' : 'Create account →'}
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

export default OrgSignup
