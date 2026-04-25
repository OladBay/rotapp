// src/pages/HomeSetupWizard.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../context/AuthContext'
import { useHomeConfig } from '../context/HomeConfigContext'
import { useTheme } from '../context/ThemeContext'
import { saveWizardStep, saveShifts, completeWizard } from '../utils/homeConfig'
import TimePicker from '../components/ui/TimePicker'
import styles from './HomeSetupWizard.module.css'

// ── Step groups ────────────────────────────────────────────────────────────
const STEP_GROUPS = [
  {
    label: 'Shift Structure',
    steps: [
      { number: 1, label: 'Rota period', desc: 'Week or month based?' },
      { number: 2, label: 'Shifts', desc: 'Define your shift types' },
      { number: 3, label: 'Management', desc: 'Manager & deputy hours' },
      { number: 4, label: 'Sleep-in', desc: 'Does your home use sleep-in?' },
    ],
  },
  {
    label: 'Staffing Rules',
    steps: [
      { number: 5, label: 'Staffing numbers', desc: 'Min & ideal per shift' },
      {
        number: 6,
        label: 'Role exclusions',
        desc: 'Who counts toward minimum?',
      },
      { number: 7, label: 'Coordinator', desc: 'Assign a shift lead?' },
      { number: 8, label: 'Seniority', desc: 'Senior presence per shift' },
      { number: 9, label: 'Soft rules', desc: 'Female, driver preferences' },
    ],
  },
  {
    label: 'Schedule',
    steps: [
      {
        number: 10,
        label: 'Rota schedule',
        desc: 'Generation & publish deadlines',
      },
      { number: 11, label: 'Review & finish', desc: 'Confirm your setup' },
    ],
  },
]

const ALL_STEPS = STEP_GROUPS.flatMap((g) => g.steps)

// ── OL Interstitial ────────────────────────────────────────────────────────
function OLInterstitial({ homeName, onComplete, onBack }) {
  return (
    <div className={styles.interstitialWrap}>
      <div className={styles.interstitialCard}>
        <div className={styles.interstitialIcon}>
          <FontAwesomeIcon icon='house' />
        </div>
        <h1 className={styles.interstitialTitle}>This home isn't set up yet</h1>
        <p className={styles.interstitialBody}>
          <strong>{homeName || 'This home'}</strong> needs to complete its home
          setup before the rota can be generated. You can complete the setup now
          or go back to your dashboard.
        </p>
        <div className={styles.interstitialActions}>
          <button className={styles.secondaryBtn} onClick={onBack}>
            Back to dashboard
          </button>
          <button className={styles.primaryBtn} onClick={onComplete}>
            Complete setup
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Greeting screen ────────────────────────────────────────────────────────
function GreetingScreen({ userName, homeName, wizardStep, onBegin }) {
  const isFresh = wizardStep === 0
  const resumeStep = ALL_STEPS.find((s) => s.number === wizardStep + 1)

  return (
    <div className={styles.greetingWrap}>
      <div className={styles.greetingCard}>
        <div className={styles.greetingIcon}>
          <FontAwesomeIcon icon='house' />
        </div>

        <div className={styles.greetingText}>
          {isFresh ? (
            <>
              <p className={styles.greetingTitle}>
                Hi {userName || 'there'} — ready to set up
              </p>
              <h1 className={styles.greetingName}>
                {homeName || 'your home'}?
              </h1>
            </>
          ) : (
            <>
              <p className={styles.greetingTitle}>Welcome back</p>
              <h1 className={styles.greetingName}>{userName || 'there'}.</h1>
            </>
          )}

          {isFresh ? (
            <p className={styles.greetingBody}>
              Before you can access Rotapp in full, you need to complete your
              home setup. It takes about 10 minutes and covers your shift
              structure, staffing rules, and rota schedule.
            </p>
          ) : (
            <>
              <p className={styles.greetingBody}>
                You're partway through setting up{' '}
                <strong>{homeName || 'your home'}</strong>. Pick up where you
                left off — your progress has been saved.
              </p>
              {resumeStep && (
                <div className={styles.greetingResumeChip}>
                  <FontAwesomeIcon icon='hourglass' />
                  Continuing from Step {resumeStep.number}: {resumeStep.label}
                </div>
              )}
            </>
          )}
        </div>

        <button className={styles.greetingBtn} onClick={onBegin}>
          {isFresh ? (
            <>
              Let's get started <FontAwesomeIcon icon='chevron-right' />
            </>
          ) : (
            <>
              Continue setup <FontAwesomeIcon icon='chevron-right' />
            </>
          )}
        </button>

        <p className={styles.greetingFooter}>
          <FontAwesomeIcon icon='circle-info' />
          {isFresh
            ? 'You can save your progress at any time and come back later.'
            : `${wizardStep} of 11 steps completed.`}
        </p>
      </div>
    </div>
  )
}

// ── Main wizard ────────────────────────────────────────────────────────────
function HomeSetupWizard() {
  const { user, logout, revertRole } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const {
    isWizardComplete,
    wizardStep,
    config,
    homeShifts,
    homeName,
    configLoading,
    initConfig,
    refreshConfig,
  } = useHomeConfig()
  const navigate = useNavigate()

  // null = greeting, number = active step
  const [currentStep, setCurrentStep] = useState(null)
  const [olProceeding, setOlProceeding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isOL =
    user?.activeRole === 'operationallead' || user?.activeRole === 'superadmin'

  // ── On mount: init config row ────────────────────────────────────────
  useEffect(() => {
    if (configLoading) return
    const init = async () => {
      await initConfig()
    }
    init()
  }, [configLoading])

  // ── Redirect when wizard becomes complete ────────────────────────────
  useEffect(() => {
    if (isWizardComplete) navigate('/dashboard', { replace: true })
  }, [isWizardComplete])

  // ── OL interstitial ──────────────────────────────────────────────────
  if (isOL && !olProceeding) {
    return (
      <>
        <TopBar theme={theme} toggleTheme={toggleTheme} onLogout={logout} />
        <OLInterstitial
          homeName={homeName}
          onBack={() => {
            revertRole()
            navigate('/dashboard', { replace: true })
          }}
          onComplete={() => setOlProceeding(true)}
        />
      </>
    )
  }

  if (configLoading) return null

  // ── Step save handler ────────────────────────────────────────────────
  const handleSaveStep = async (stepNumber, configUpdates) => {
    setSaving(true)
    setError('')
    try {
      await saveWizardStep(user.home, stepNumber, configUpdates)
      await refreshConfig()
      if (stepNumber < 11) setCurrentStep(stepNumber + 1)
    } catch (err) {
      console.error('HomeSetupWizard: save error', err)
      setError(
        "We couldn't save your progress. Check your connection and try again."
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Shifts save handler ──────────────────────────────────────────────
  const handleSaveShifts = async (shifts) => {
    setSaving(true)
    setError('')
    try {
      await saveShifts(user.home, user.org_id, shifts)
      await saveWizardStep(user.home, 2, {})
      await refreshConfig()
      setCurrentStep(3)
    } catch (err) {
      console.error('HomeSetupWizard: shifts save error', err)
      setError(
        "We couldn't save your shifts. Check your connection and try again."
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Complete wizard handler ──────────────────────────────────────────
  const handleComplete = async () => {
    setSaving(true)
    setError('')
    try {
      await completeWizard(user.home)
      await refreshConfig()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('HomeSetupWizard: complete error', err)
      setError(
        "We couldn't complete your setup. Check your connection and try again."
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Begin wizard from greeting screen ───────────────────────────────
  const handleBegin = () => {
    const resumeStep = wizardStep >= 11 ? 11 : wizardStep + 1
    setCurrentStep(Math.max(1, resumeStep))
  }

  const completedPercent = Math.round((wizardStep / 11) * 100)
  const currentGroup =
    STEP_GROUPS.find((g) => g.steps.some((s) => s.number === currentStep))
      ?.label || ''

  // ── Greeting screen ──────────────────────────────────────────────────
  if (currentStep === null) {
    return (
      <div className={styles.page}>
        <TopBar theme={theme} toggleTheme={toggleTheme} onLogout={logout} />
        <GreetingScreen
          userName={user?.name}
          homeName={homeName}
          wizardStep={wizardStep}
          onBegin={handleBegin}
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <TopBar theme={theme} toggleTheme={toggleTheme} onLogout={logout} />

      <div className={styles.cardWrap}>
        <div className={styles.card}>
          <div className={styles.body}>
            {/* ── Left panel ── */}
            <div className={styles.leftPanel}>
              {/* Home block — pinned top */}
              <div className={styles.homeBlock}>
                <div className={styles.homeEyebrow}>Setting up</div>
                <div className={styles.homeName}>{homeName || 'Your home'}</div>
              </div>

              {/* Step groups — scrollable middle */}
              <div className={styles.stepGroups}>
                {STEP_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className={styles.groupLabel}>{group.label}</div>
                    {group.steps.map((step) => {
                      const isCompleted = wizardStep >= step.number
                      const isActive = currentStep === step.number
                      const isAccessible = step.number <= wizardStep + 1

                      return (
                        <button
                          key={step.number}
                          className={`${styles.stepItem} ${
                            isActive ? styles.stepItemActive : ''
                          } ${isCompleted && !isActive ? styles.stepItemDone : ''}`}
                          onClick={() => {
                            if (isAccessible) setCurrentStep(step.number)
                          }}
                          disabled={!isAccessible}
                        >
                          <div className={styles.stepDot}>
                            {isCompleted && !isActive ? (
                              <FontAwesomeIcon icon='check' />
                            ) : (
                              step.number
                            )}
                          </div>
                          <div className={styles.stepItemText}>
                            <div className={styles.stepItemLabel}>
                              {step.label}
                            </div>
                            <div className={styles.stepItemDesc}>
                              {step.desc}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>

              {/* Progress bar — pinned bottom */}
              <div className={styles.panelProgress}>
                <div className={styles.panelProgressLabel}>
                  <span>Progress</span>
                  <span>{completedPercent}%</span>
                </div>
                <div className={styles.panelProgressTrack}>
                  <div
                    className={styles.panelProgressFill}
                    style={{ width: `${completedPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ── Right panel ── */}
            <div className={styles.rightPanel}>
              {error && (
                <div className={styles.errorBanner}>
                  <FontAwesomeIcon icon='triangle-exclamation' />
                  {error}
                </div>
              )}

              {currentStep === 1 && (
                <Step1RotaPeriod
                  key={1}
                  initial={config.periodType || ''}
                  onSave={(val) => handleSaveStep(1, { periodType: val })}
                  onBack={() => setCurrentStep(null)}
                  saving={saving}
                  currentGroup={currentGroup}
                />
              )}
              {currentStep === 2 && (
                <Step2Shifts
                  key={2}
                  initial={homeShifts}
                  onSave={handleSaveShifts}
                  onBack={() => setCurrentStep(1)}
                  saving={saving}
                  currentGroup={currentGroup}
                />
              )}
              {[3, 4, 5, 6, 7, 8, 9, 10].map((n) =>
                currentStep === n ? (
                  <StepPlaceholder
                    key={n}
                    stepNumber={n}
                    currentGroup={currentGroup}
                    onBack={() => setCurrentStep(n - 1)}
                    onNext={() => handleSaveStep(n, {})}
                    saving={saving}
                  />
                ) : null
              )}
              {currentStep === 11 && (
                <StepPlaceholder
                  key={11}
                  stepNumber={11}
                  currentGroup={currentGroup}
                  onBack={() => setCurrentStep(10)}
                  onNext={handleComplete}
                  saving={saving}
                  isReview
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Top bar — lives on the background, outside the card ───────────────────
function TopBar({ theme, toggleTheme, onLogout }) {
  return (
    <div className={styles.topbar}>
      <div className={styles.logo}>
        Rot<span className={styles.logoAccent}>app</span>
      </div>
      <div className={styles.topbarActions}>
        <button
          className={styles.iconBtn}
          onClick={toggleTheme}
          title={
            theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
          }
        >
          <FontAwesomeIcon icon={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button className={styles.iconBtn} onClick={onLogout} title='Log out'>
          <FontAwesomeIcon icon='right-from-bracket' />
        </button>
      </div>
    </div>
  )
}

// ── Shared step header ─────────────────────────────────────────────────────
function StepHeader({ stepNumber, currentGroup, title, subtitle }) {
  return (
    <div className={styles.stepHeaderBlock}>
      <div className={styles.breadcrumb}>
        <span>Step {stepNumber} of 11</span>
        <div className={styles.breadcrumbSep} />
        <span>{currentGroup}</span>
      </div>
      <h2 className={styles.stepTitle}>{title}</h2>
      <p className={styles.stepSubtitle}>{subtitle}</p>
    </div>
  )
}

// ── Shared step footer ─────────────────────────────────────────────────────
function StepFooter({
  onBack,
  onNext,
  saving,
  nextLabel = 'Save & Next',
  nextDisabled = false,
  hint = '',
}) {
  return (
    <div className={styles.stepFooter}>
      <div className={styles.footerHint}>{hint}</div>
      <div className={styles.footerButtons}>
        {onBack && (
          <button className={styles.secondaryBtn} onClick={onBack}>
            <FontAwesomeIcon icon='chevron-left' /> Back
          </button>
        )}
        <button
          className={styles.primaryBtn}
          onClick={onNext}
          disabled={saving || nextDisabled}
        >
          {saving ? (
            <>
              <FontAwesomeIcon icon='spinner' spin /> Saving…
            </>
          ) : (
            <>
              {nextLabel} <FontAwesomeIcon icon='chevron-right' />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Step 1 — Rota Period ───────────────────────────────────────────────────
function Step1RotaPeriod({ initial, onSave, onBack, saving, currentGroup }) {
  const [selected, setSelected] = useState(initial)
  const [touched, setTouched] = useState(false)

  const handleSubmit = () => {
    setTouched(true)
    if (!selected) return
    onSave(selected)
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={1}
        currentGroup={currentGroup}
        title='How does your home manage its rota?'
        subtitle='This determines how rotas are generated and published. You can change this later in Home Settings.'
      />

      <div className={styles.optionList}>
        {[
          {
            value: 'week',
            title: 'Week by week',
            desc: 'Generate one week at a time or multiple weeks in one go',
          },
          {
            value: 'month',
            title: 'Month by month',
            desc: 'Generate one month at a time or multiple months in one go',
          },
        ].map((opt) => (
          <button
            key={opt.value}
            className={`${styles.optionCard} ${
              selected === opt.value ? styles.optionSelected : ''
            }`}
            onClick={() => setSelected(opt.value)}
          >
            <div className={styles.optionRadio}>
              <div className={styles.optionRadioDot} />
            </div>
            <div>
              <div className={styles.optionTitle}>{opt.title}</div>
              <div className={styles.optionDesc}>{opt.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {touched && !selected && (
        <p className={styles.fieldError}>
          Please select an option to continue.
        </p>
      )}

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        hint={selected ? 'Option selected' : 'Choose an option above'}
      />
    </div>
  )
}

// ── Step 2 — Shifts ───────────────────────────────────────────────────────
const SHIFT_TEMPLATES = [
  { key: 'early', name: 'Early' },
  { key: 'late', name: 'Late' },
  { key: 'longday', name: 'Long Day' },
  { key: 'wakingnight', name: 'Waking Night' },
  { key: 'night', name: 'Night' },
]

function calculateHoursLocal(start, end) {
  if (!start || !end || !start.includes(':') || !end.includes(':')) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let startMins = sh * 60 + sm
  let endMins = eh * 60 + em
  if (endMins <= startMins) endMins += 24 * 60
  return Math.round(((endMins - startMins) / 60) * 100) / 100
}

function Step2Shifts({ initial, onSave, onBack, saving, currentGroup }) {
  const [shifts, setShifts] = useState(() => {
    if (initial && initial.length > 0) {
      return initial.map((s) => ({
        id: s.id || crypto.randomUUID(),
        name: s.name,
        startTime: s.start_time,
        endTime: s.end_time,
        hours: s.hours,
      }))
    }
    return []
  })
  const [touched, setTouched] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  const addTemplate = (template) => {
    if (
      shifts.some((s) => s.name.toLowerCase() === template.name.toLowerCase())
    )
      return
    setShifts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: template.name,
        startTime: '',
        endTime: '',
        hours: 0,
      },
    ])
  }

  const addCustom = () => {
    setShifts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        startTime: '',
        endTime: '',
        hours: 0,
      },
    ])
  }

  const removeShift = (id) => {
    setShifts((prev) => prev.filter((s) => s.id !== id))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const updateShift = (id, field, value) => {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const updated = { ...s, [field]: value }
        if (field === 'startTime' || field === 'endTime') {
          updated.hours = calculateHoursLocal(
            field === 'startTime' ? value : s.startTime,
            field === 'endTime' ? value : s.endTime
          )
        }
        return updated
      })
    )
    setFieldErrors((prev) => ({ ...prev, [`${id}_${field}`]: false }))
  }

  const handleSubmit = () => {
    setTouched(true)
    if (shifts.length === 0) return

    const errors = {}
    let hasErrors = false

    shifts.forEach((s) => {
      if (!s.name.trim()) {
        errors[`${s.id}_name`] = 'Every shift needs a name'
        hasErrors = true
      }
      if (!s.startTime) {
        errors[`${s.id}_startTime`] = 'Select a start time'
        hasErrors = true
      }
      if (!s.endTime) {
        errors[`${s.id}_endTime`] = 'Select an end time'
        hasErrors = true
      }
    })

    if (hasErrors) {
      setFieldErrors(errors)
      return
    }

    onSave(shifts)
  }

  const templateNames = shifts.map((s) => s.name.toLowerCase())

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={2}
        currentGroup={currentGroup}
        title='What shifts does your home run?'
        subtitle='Select from common templates or add your own. Set the start and end time for each shift.'
      />

      <div className={styles.templateRow}>
        {SHIFT_TEMPLATES.map((t) => {
          const added = templateNames.includes(t.name.toLowerCase())
          return (
            <button
              key={t.key}
              className={`${styles.templateBtn} ${added ? styles.templateBtnAdded : ''}`}
              onClick={() => addTemplate(t)}
              disabled={added}
            >
              {added && <FontAwesomeIcon icon='check' />}
              {t.name}
            </button>
          )
        })}
        <button className={styles.templateBtnCustom} onClick={addCustom}>
          <FontAwesomeIcon icon='plus' /> Custom
        </button>
      </div>

      {shifts.length > 0 && (
        <div className={styles.shiftList}>
          <div className={styles.shiftListHeader}>
            <span className={styles.shiftColLabel}>Shift name</span>
            <span className={styles.shiftColLabel}>Start time</span>
            <span className={styles.shiftColLabel}>End time</span>
            <span className={styles.shiftColLabel}>Hours</span>
            <span />
          </div>

          {shifts.map((shift) => (
            <div key={shift.id} className={styles.shiftRow}>
              <div className={styles.shiftField}>
                <input
                  className={`${styles.shiftInput} ${
                    fieldErrors[`${shift.id}_name`] ? styles.inputError : ''
                  }`}
                  type='text'
                  value={shift.name}
                  onChange={(e) =>
                    updateShift(shift.id, 'name', e.target.value)
                  }
                  placeholder='Shift name'
                />
                {fieldErrors[`${shift.id}_name`] && (
                  <span className={styles.inlineError}>
                    {fieldErrors[`${shift.id}_name`]}
                  </span>
                )}
              </div>

              <div className={styles.shiftField}>
                <TimePicker
                  value={shift.startTime}
                  onChange={(val) => updateShift(shift.id, 'startTime', val)}
                  placeholder='Start'
                  error={!!fieldErrors[`${shift.id}_startTime`]}
                />
                {fieldErrors[`${shift.id}_startTime`] && (
                  <span className={styles.inlineError}>
                    {fieldErrors[`${shift.id}_startTime`]}
                  </span>
                )}
              </div>

              <div className={styles.shiftField}>
                <TimePicker
                  value={shift.endTime}
                  onChange={(val) => updateShift(shift.id, 'endTime', val)}
                  placeholder='End'
                  error={!!fieldErrors[`${shift.id}_endTime`]}
                />
                {fieldErrors[`${shift.id}_endTime`] && (
                  <span className={styles.inlineError}>
                    {fieldErrors[`${shift.id}_endTime`]}
                  </span>
                )}
              </div>

              <div className={styles.hoursDisplay}>
                {shift.hours > 0 ? `${shift.hours}h` : '—'}
              </div>

              <button
                className={styles.removeShiftBtn}
                onClick={() => removeShift(shift.id)}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
          ))}
        </div>
      )}

      {shifts.length === 0 && touched && (
        <p className={styles.fieldError}>Add at least one shift to continue.</p>
      )}

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        nextDisabled={shifts.length === 0}
        hint={
          shifts.length > 0
            ? `${shifts.length} shift${shifts.length > 1 ? 's' : ''} added`
            : 'Add at least one shift'
        }
      />
    </div>
  )
}

// ── Placeholder ───────────────────────────────────────────────────────────
function StepPlaceholder({
  stepNumber,
  currentGroup,
  onBack,
  onNext,
  saving,
  isReview,
}) {
  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={stepNumber}
        currentGroup={currentGroup}
        title={isReview ? 'Review your home setup' : 'Coming soon'}
        subtitle={
          isReview
            ? 'Almost there. Click Finish to complete your setup.'
            : 'This step is being built. Click Save & Next to continue.'
        }
      />
      <StepFooter
        onBack={onBack}
        onNext={onNext}
        saving={saving}
        nextLabel={isReview ? 'Finish' : 'Save & Next'}
        hint=''
      />
    </div>
  )
}

export default HomeSetupWizard
