// src/pages/HomeSetupWizard.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../context/AuthContext'
import { useHomeConfig } from '../context/HomeConfigContext'
import { useTheme } from '../context/ThemeContext'
import {
  saveWizardStep,
  saveShifts,
  completeWizard,
  calculateHours,
  updateSleepInEligibility,
  saveShiftRules,
} from '../utils/homeConfig'
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
    homeShiftRules,
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
  // ── Sleep-in save handler ────────────────────────────────────────────
  const handleSaveSleepIn = async (sleepInConfig, eligibleShiftIds) => {
    setSaving(true)
    setError('')
    try {
      await updateSleepInEligibility(user.home, eligibleShiftIds)
      await saveWizardStep(user.home, 4, { sleepIn: sleepInConfig })
      await refreshConfig()
      setCurrentStep(5)
    } catch (err) {
      console.error('HomeSetupWizard: sleep-in save error', err)
      setError(
        "We couldn't save your sleep-in settings. Check your connection and try again."
      )
    } finally {
      setSaving(false)
    }
  }
  // ── Staffing numbers save handler ────────────────────────────────────
  const handleSaveStaffingNumbers = async (rules) => {
    setSaving(true)
    setError('')
    try {
      await saveShiftRules(user.home, user.org_id, rules)
      await saveWizardStep(user.home, 5, {})
      await refreshConfig()
      setCurrentStep(6)
    } catch (err) {
      console.error('HomeSetupWizard: staffing numbers save error', err)
      setError(
        "We couldn't save your staffing numbers. Check your connection and try again."
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
            {/* ── Mobile progress strip ── */}
            <div className={styles.mobileProgressStrip}>
              <div className={styles.mobileProgressLeft}>
                <div className={styles.mobileProgressLabel}>Setting up</div>
                <div className={styles.mobileProgressName}>
                  {homeName || 'Your home'}
                </div>
              </div>
              <div className={styles.mobileProgressRight}>
                <span className={styles.mobileProgressPct}>
                  {completedPercent}%
                </span>
                <div className={styles.mobileProgressTrack}>
                  <div
                    className={styles.mobileProgressFill}
                    style={{ width: `${completedPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ── Left panel ── */}
            <div className={styles.leftPanel}>
              {/* Home block — pinned top */}
              <div className={styles.homeBlock}>
                <div className={styles.homeEyebrow}>Setting up</div>
                <div className={styles.homeName}>{homeName || 'Your home'}</div>
              </div>

              {/* Step groups — scrollable middle */}
              <div className={styles.stepGroups}>
                {STEP_GROUPS.map((group) => {
                  const groupIsActive = group.steps.some(
                    (s) => s.number === currentStep
                  )
                  return (
                    <div key={group.label}>
                      <div
                        className={`${styles.groupLabel} ${
                          groupIsActive ? styles.groupLabelActive : ''
                        }`}
                      >
                        {group.label}
                      </div>
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
                  )
                })}
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
              {currentStep === 3 && (
                <Step3Management
                  key={3}
                  initial={config.managementSchedule || null}
                  onSave={(val) =>
                    handleSaveStep(3, { managementSchedule: val })
                  }
                  onBack={() => setCurrentStep(2)}
                  saving={saving}
                  currentGroup={currentGroup}
                />
              )}

              {currentStep === 4 && (
                <Step4SleepIn
                  key={4}
                  initial={config.sleepIn || null}
                  initialShifts={homeShifts}
                  onSave={handleSaveSleepIn}
                  onBack={() => setCurrentStep(3)}
                  saving={saving}
                  currentGroup={currentGroup}
                />
              )}
              {currentStep === 5 && (
                <Step5StaffingNumbers
                  key={5}
                  initialShifts={homeShifts}
                  initialRules={homeShiftRules}
                  onSave={handleSaveStaffingNumbers}
                  onBack={() => setCurrentStep(4)}
                  saving={saving}
                  currentGroup={currentGroup}
                />
              )}
              {currentStep === 6 && (
                <Step6RoleExclusions
                  key={6}
                  initial={config.roleExclusions || null}
                  managementSchedule={config.managementSchedule || null}
                  homeName={homeName}
                  onSave={(val) => handleSaveStep(6, { roleExclusions: val })}
                  onBack={() => setCurrentStep(5)}
                  saving={saving}
                  currentGroup={currentGroup}
                />
              )}
              {currentStep === 7 && (
                <Step7Coordinator
                  key={7}
                  initial={config.shiftCoordinator ?? null}
                  onSave={(val) => handleSaveStep(7, { shiftCoordinator: val })}
                  onBack={() => setCurrentStep(6)}
                  saving={saving}
                  currentGroup={currentGroup}
                />
              )}
              {currentStep === 8 && (
                <Step8Seniority
                  key={8}
                  initial={config.seniority ?? null}
                  onSave={(val) => handleSaveStep(8, { seniority: val })}
                  onBack={() => setCurrentStep(7)}
                  saving={saving}
                  currentGroup={currentGroup}
                />
              )}
              {currentStep === 9 && (
                <Step9SoftRules
                  key={9}
                  initial={config.softRules ?? null}
                  sleepInEnabled={config.sleepIn?.enabled ?? false}
                  onSave={(val) => handleSaveStep(9, { softRules: val })}
                  onBack={() => setCurrentStep(8)}
                  saving={saving}
                  currentGroup={currentGroup}
                />
              )}
              {currentStep === 10 && (
                <Step10RotaSchedule
                  key={10}
                  initial={config.rotaSchedule ?? null}
                  onSave={(val) => handleSaveStep(10, { rotaSchedule: val })}
                  onBack={() => setCurrentStep(9)}
                  saving={saving}
                  currentGroup={currentGroup}
                />
              )}
              {currentStep === 11 && (
                <Step11Review
                  key={11}
                  config={config}
                  homeShifts={homeShifts}
                  homeShiftRules={homeShiftRules}
                  homeName={homeName}
                  onEdit={(stepNumber) => setCurrentStep(stepNumber)}
                  onBack={() => setCurrentStep(10)}
                  onFinish={handleComplete}
                  saving={saving}
                  currentGroup={currentGroup}
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
// ── Step 3 — Management Schedule ─────────────────────────────────────────

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

const EMPTY_SCHEDULE = {
  differentSchedule: false,
  workingDays: [],
  sameTimeAllDays: true,
  startTime: '',
  endTime: '',
  perDayTimes: {},
}

function buildInitialRole(saved) {
  if (!saved) return { ...EMPTY_SCHEDULE }
  return {
    differentSchedule: saved.differentSchedule ?? false,
    workingDays: saved.workingDays ?? [],
    sameTimeAllDays: saved.sameTimeAllDays ?? true,
    startTime: saved.startTime ?? '',
    endTime: saved.endTime ?? '',
    perDayTimes: saved.perDayTimes ?? {},
  }
}

function Step3Management({ initial, onSave, onBack, saving, currentGroup }) {
  const [manager, setManager] = useState(() =>
    buildInitialRole(initial?.manager)
  )
  const [deputy, setDeputy] = useState(() => buildInitialRole(initial?.deputy))
  const [touched, setTouched] = useState(false)
  const [errors, setErrors] = useState({})

  // ── Update a field on a role ───────────────────────────────────────────
  const updateRole = (role, field, value) => {
    const setter = role === 'manager' ? setManager : setDeputy
    setter((prev) => {
      const updated = { ...prev, [field]: value }

      // When toggling OFF — reset to clean empty state
      if (field === 'differentSchedule' && value === false) {
        return { ...EMPTY_SCHEDULE, differentSchedule: false }
      }

      // When toggling sameTimeAllDays OFF — clear shared times
      if (field === 'sameTimeAllDays' && value === false) {
        return { ...updated, startTime: '', endTime: '' }
      }

      // When toggling sameTimeAllDays ON — clear per day times
      if (field === 'sameTimeAllDays' && value === true) {
        return { ...updated, perDayTimes: {} }
      }

      return updated
    })
    // Clear related errors
    setErrors((prev) => {
      const next = { ...prev }
      Object.keys(next).forEach((k) => {
        if (k.startsWith(role)) delete next[k]
      })
      return next
    })
  }

  // ── Toggle a working day ───────────────────────────────────────────────
  const toggleDay = (role, dayKey) => {
    const setter = role === 'manager' ? setManager : setDeputy
    setter((prev) => {
      const days = prev.workingDays.includes(dayKey)
        ? prev.workingDays.filter((d) => d !== dayKey)
        : [...prev.workingDays, dayKey]

      // Remove per-day time if day removed
      const perDayTimes = { ...prev.perDayTimes }
      if (!days.includes(dayKey)) delete perDayTimes[dayKey]

      return { ...prev, workingDays: days, perDayTimes }
    })
  }

  // ── Update per-day time ────────────────────────────────────────────────
  const updatePerDayTime = (role, dayKey, field, value) => {
    const setter = role === 'manager' ? setManager : setDeputy
    setter((prev) => ({
      ...prev,
      perDayTimes: {
        ...prev.perDayTimes,
        [dayKey]: {
          ...prev.perDayTimes[dayKey],
          [field]: value,
        },
      },
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[`${role}_${dayKey}_${field}`]
      return next
    })
  }

  // ── Validate ───────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {}

    const validateRole = (role, data) => {
      if (!data.differentSchedule) return

      if (data.workingDays.length === 0) {
        errs[`${role}_workingDays`] = 'Select at least one working day'
      }

      if (data.sameTimeAllDays) {
        if (!data.startTime) errs[`${role}_startTime`] = 'Enter a start time'
        if (!data.endTime) errs[`${role}_endTime`] = 'Enter an end time'
      } else {
        data.workingDays.forEach((day) => {
          const times = data.perDayTimes[day] || {}
          if (!times.startTime) errs[`${role}_${day}_startTime`] = 'Required'
          if (!times.endTime) errs[`${role}_${day}_endTime`] = 'Required'
        })
      }
    }

    validateRole('manager', manager)
    validateRole('deputy', deputy)

    return errs
  }

  const handleSubmit = () => {
    setTouched(true)
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSave({ manager, deputy })
  }

  const anyActive = manager.differentSchedule || deputy.differentSchedule

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={3}
        currentGroup={currentGroup}
        title='Does your management have a different schedule?'
        subtitle='Toggle on for Manager and/or Deputy if they work office hours rather than regular shifts.'
      />

      <div className={styles.mgmtRoles}>
        <RoleSchedule
          role='manager'
          label='Manager'
          data={manager}
          errors={errors}
          onUpdate={updateRole}
          onToggleDay={toggleDay}
          onUpdatePerDay={updatePerDayTime}
        />
        <RoleSchedule
          role='deputy'
          label='Deputy Manager'
          data={deputy}
          errors={errors}
          onUpdate={updateRole}
          onToggleDay={toggleDay}
          onUpdatePerDay={updatePerDayTime}
        />
      </div>

      {!anyActive && (
        <div className={styles.mgmtOffNote}>
          <FontAwesomeIcon icon='circle-info' />
          Both roles will be treated as regular shift workers. The rota
          generator will place them on shifts like any other staff member.
        </div>
      )}

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        hint={
          anyActive
            ? 'Schedule configured'
            : 'Both set as regular shift workers'
        }
      />
    </div>
  )
}

// ── Role schedule sub-component ───────────────────────────────────────────
function RoleSchedule({
  role,
  label,
  data,
  errors,
  onUpdate,
  onToggleDay,
  onUpdatePerDay,
}) {
  return (
    <div
      className={`${styles.roleCard} ${data.differentSchedule ? styles.roleCardActive : ''}`}
    >
      {/* ── Toggle header ── */}
      <div className={styles.roleHeader}>
        <div className={styles.roleHeaderLeft}>
          <div className={styles.roleLabel}>{label}</div>
          <div className={styles.roleSubLabel}>
            {data.differentSchedule
              ? 'Has a different schedule'
              : 'Works regular shifts'}
          </div>
        </div>
        <button
          type='button'
          className={`${styles.toggle} ${data.differentSchedule ? styles.toggleOn : ''}`}
          onClick={() =>
            onUpdate(role, 'differentSchedule', !data.differentSchedule)
          }
          aria-label={`Toggle ${label} different schedule`}
        >
          <div className={styles.toggleThumb} />
        </button>
      </div>

      {/* ── Schedule details — only when toggled ON ── */}
      {data.differentSchedule && (
        <div className={styles.roleBody}>
          {/* Working days */}
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>Which days do they work?</div>
            <div className={styles.dayGrid}>
              {DAYS.map((day) => (
                <button
                  key={day.key}
                  type='button'
                  className={`${styles.dayBtn} ${
                    data.workingDays.includes(day.key)
                      ? styles.dayBtnActive
                      : ''
                  }`}
                  onClick={() => onToggleDay(role, day.key)}
                >
                  {day.label}
                </button>
              ))}
            </div>
            {errors[`${role}_workingDays`] && (
              <span className={styles.inlineError}>
                {errors[`${role}_workingDays`]}
              </span>
            )}
          </div>

          {/* Same time all days toggle */}
          {data.workingDays.length > 0 && (
            <div className={styles.fieldGroup}>
              <button
                type='button'
                className={`${styles.checkRow} ${
                  data.sameTimeAllDays ? styles.checkRowActive : ''
                }`}
                onClick={() =>
                  onUpdate(role, 'sameTimeAllDays', !data.sameTimeAllDays)
                }
              >
                <div
                  className={`${styles.checkbox} ${
                    data.sameTimeAllDays ? styles.checkboxChecked : ''
                  }`}
                >
                  {data.sameTimeAllDays && <FontAwesomeIcon icon='check' />}
                </div>
                <span className={styles.checkLabel}>
                  Same start and end time for all working days
                </span>
              </button>
            </div>
          )}

          {/* Same time for all days */}
          {data.workingDays.length > 0 && data.sameTimeAllDays && (
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Working hours</div>
              <div className={styles.timeRow}>
                <div className={styles.timeField}>
                  <span className={styles.timeFieldLabel}>Start</span>
                  <TimePicker
                    value={data.startTime}
                    onChange={(val) => onUpdate(role, 'startTime', val)}
                    placeholder='09:00'
                    error={!!errors[`${role}_startTime`]}
                  />
                  {errors[`${role}_startTime`] && (
                    <span className={styles.inlineError}>
                      {errors[`${role}_startTime`]}
                    </span>
                  )}
                </div>
                <div className={styles.timeSep}>to</div>
                <div className={styles.timeField}>
                  <span className={styles.timeFieldLabel}>End</span>
                  <TimePicker
                    value={data.endTime}
                    onChange={(val) => onUpdate(role, 'endTime', val)}
                    placeholder='17:00'
                    error={!!errors[`${role}_endTime`]}
                  />
                  {errors[`${role}_endTime`] && (
                    <span className={styles.inlineError}>
                      {errors[`${role}_endTime`]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Per day times */}
          {data.workingDays.length > 0 && !data.sameTimeAllDays && (
            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabel}>Hours per day</div>
              <div className={styles.perDayList}>
                {DAYS.filter((d) => data.workingDays.includes(d.key)).map(
                  (day) => {
                    const times = data.perDayTimes[day.key] || {}
                    return (
                      <div key={day.key} className={styles.perDayRow}>
                        <span className={styles.perDayLabel}>{day.label}</span>
                        <div className={styles.timeField}>
                          <TimePicker
                            value={times.startTime || ''}
                            onChange={(val) =>
                              onUpdatePerDay(role, day.key, 'startTime', val)
                            }
                            placeholder='09:00'
                            error={!!errors[`${role}_${day.key}_startTime`]}
                          />
                        </div>
                        <div className={styles.timeSep}>to</div>
                        <div className={styles.timeField}>
                          <TimePicker
                            value={times.endTime || ''}
                            onChange={(val) =>
                              onUpdatePerDay(role, day.key, 'endTime', val)
                            }
                            placeholder='17:00'
                            error={!!errors[`${role}_${day.key}_endTime`]}
                          />
                        </div>
                      </div>
                    )
                  }
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
// ── Step 4 — Sleep-in ─────────────────────────────────────────────────────
function Step4SleepIn({
  initial,
  initialShifts,
  onSave,
  onBack,
  saving,
  currentGroup,
}) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? null)
  const [eligibleShiftIds, setEligibleShiftIds] = useState(() => {
    if (!initialShifts) return []
    // Restore from existing home_shifts sleep_in_eligible flag
    return initialShifts.filter((s) => s.sleep_in_eligible).map((s) => s.id)
  })
  const [maxPerNight, setMaxPerNight] = useState(initial?.maxPerNight ?? 1)
  const [touched, setTouched] = useState(false)
  const [errors, setErrors] = useState({})

  const toggleShift = (shiftId) => {
    setEligibleShiftIds((prev) =>
      prev.includes(shiftId)
        ? prev.filter((id) => id !== shiftId)
        : [...prev, shiftId]
    )
    setErrors((prev) => ({ ...prev, eligibleShifts: null }))
  }

  const handleSubmit = () => {
    setTouched(true)
    const errs = {}

    if (enabled === null) {
      errs.enabled = 'Please select an option to continue'
    }

    if (enabled === true && eligibleShiftIds.length === 0) {
      errs.eligibleShifts =
        'Select at least one shift that sleep-in can attach to'
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const sleepInConfig = {
      enabled,
      maxPerNight: enabled ? maxPerNight : 0,
    }

    onSave(sleepInConfig, enabled ? eligibleShiftIds : [])
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={4}
        currentGroup={currentGroup}
        title='Does your home use sleep-in?'
        subtitle='Sleep-in is when a staff member stays overnight and can be called upon if needed. It is separate from a night shift.'
      />

      {/* ── Yes / No ── */}
      <div className={styles.optionList}>
        {[
          {
            value: true,
            title: 'Yes, we use sleep-in',
            desc: 'Staff can be assigned a sleep-in on eligible shifts',
          },
          {
            value: false,
            title: 'No, we do not use sleep-in',
            desc: 'Sleep-in will not appear on the rota',
          },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            className={`${styles.optionCard} ${
              enabled === opt.value ? styles.optionSelected : ''
            }`}
            onClick={() => {
              setEnabled(opt.value)
              setErrors((prev) => ({ ...prev, enabled: null }))
            }}
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

      {touched && errors.enabled && (
        <p className={styles.fieldError}>{errors.enabled}</p>
      )}

      {/* ── Sleep-in details — only when enabled ── */}
      {enabled === true && (
        <div className={styles.sleepInDetails}>
          {/* Which shifts */}
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>
              Which shifts can sleep-in attach to?
            </div>
            {initialShifts && initialShifts.length > 0 ? (
              <div className={styles.shiftCheckList}>
                {initialShifts.map((shift) => {
                  const checked = eligibleShiftIds.includes(shift.id)
                  return (
                    <button
                      key={shift.id}
                      type='button'
                      className={`${styles.shiftCheckRow} ${
                        checked ? styles.shiftCheckRowActive : ''
                      }`}
                      onClick={() => toggleShift(shift.id)}
                    >
                      <div
                        className={`${styles.checkbox} ${
                          checked ? styles.checkboxChecked : ''
                        }`}
                      >
                        {checked && <FontAwesomeIcon icon='check' />}
                      </div>
                      <div className={styles.shiftCheckContent}>
                        <span className={styles.shiftCheckName}>
                          {shift.name}
                        </span>
                        <span className={styles.shiftCheckTime}>
                          {shift.start_time} – {shift.end_time} · {shift.hours}h
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className={styles.fieldError}>
                No shifts found. Go back to Step 2 and add your shifts first.
              </p>
            )}
            {errors.eligibleShifts && (
              <p className={styles.fieldError}>{errors.eligibleShifts}</p>
            )}
          </div>

          {/* Max per night */}
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>Maximum sleep-ins per night</div>
            <div className={styles.maxPerNightRow}>
              <button
                type='button'
                className={styles.counterBtn}
                onClick={() => setMaxPerNight((prev) => Math.max(1, prev - 1))}
                disabled={maxPerNight <= 1}
              >
                <FontAwesomeIcon icon='minus' />
              </button>
              <span className={styles.counterValue}>{maxPerNight}</span>
              <button
                type='button'
                className={styles.counterBtn}
                onClick={() => setMaxPerNight((prev) => Math.min(10, prev + 1))}
                disabled={maxPerNight >= 10}
              >
                <FontAwesomeIcon icon='plus' />
              </button>
              <span className={styles.counterLabel}>per night</span>
            </div>
          </div>
        </div>
      )}

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        hint={
          enabled === null
            ? 'Choose an option above'
            : enabled
              ? `${eligibleShiftIds.length} shift${eligibleShiftIds.length !== 1 ? 's' : ''} eligible · max ${maxPerNight} per night`
              : 'Sleep-in not used at this home'
        }
      />
    </div>
  )
}
// ── Step 5 — Staffing Numbers ─────────────────────────────────────────────
function Step5StaffingNumbers({
  initialShifts,
  initialRules,
  onSave,
  onBack,
  saving,
  currentGroup,
}) {
  // Build initial state from existing rules or defaults
  const [rules, setRules] = useState(() => {
    return (initialShifts || []).map((shift) => {
      const existing = (initialRules || []).find((r) => r.shift_id === shift.id)
      return {
        shiftId: shift.id,
        shiftName: shift.name,
        shiftHours: shift.hours,
        sameForWeekend: existing?.same_for_weekend ?? true,
        weekdayMin: existing?.weekday_min ?? 1,
        weekdayIdeal: existing?.weekday_ideal ?? 2,
        weekendMin: existing?.weekend_min ?? 1,
        weekendIdeal: existing?.weekend_ideal ?? 2,
        sleepInEligible: shift.sleep_in_eligible ?? false,
      }
    })
  })

  const [openShiftId, setOpenShiftId] = useState(initialShifts?.[0]?.id || null)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState(false)

  const updateRule = (shiftId, field, value) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.shiftId !== shiftId) return r
        const updated = { ...r, [field]: value }

        // When sameForWeekend toggled ON — sync weekend to weekday
        if (field === 'sameForWeekend' && value === true) {
          updated.weekendMin = r.weekdayMin
          updated.weekendIdeal = r.weekdayIdeal
        }

        // Enforce ideal >= min
        if (field === 'weekdayMin' && value > updated.weekdayIdeal) {
          updated.weekdayIdeal = value
        }
        if (field === 'weekendMin' && value > updated.weekendIdeal) {
          updated.weekendIdeal = value
        }
        if (field === 'weekdayIdeal' && value < updated.weekdayMin) {
          updated.weekdayIdeal = updated.weekdayMin
        }
        if (field === 'weekendIdeal' && value < updated.weekendMin) {
          updated.weekendIdeal = updated.weekendMin
        }

        return updated
      })
    )
    setErrors((prev) => {
      const next = { ...prev }
      delete next[`${shiftId}_${field}`]
      return next
    })
  }

  const validate = () => {
    const errs = {}
    rules.forEach((r) => {
      if (r.weekdayMin < 1)
        errs[`${r.shiftId}_weekdayMin`] = 'Minimum must be at least 1'
      if (r.weekdayIdeal < r.weekdayMin)
        errs[`${r.shiftId}_weekdayIdeal`] = 'Ideal must be ≥ minimum'
      if (!r.sameForWeekend) {
        if (r.weekendMin < 1)
          errs[`${r.shiftId}_weekendMin`] = 'Minimum must be at least 1'
        if (r.weekendIdeal < r.weekendMin)
          errs[`${r.shiftId}_weekendIdeal`] = 'Ideal must be ≥ minimum'
      }
    })
    return errs
  }

  const handleSubmit = () => {
    setTouched(true)
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSave(rules)
  }

  if (!initialShifts || initialShifts.length === 0) {
    return (
      <div className={styles.step}>
        <StepHeader
          stepNumber={5}
          currentGroup={currentGroup}
          title='Staffing numbers'
          subtitle='No shifts found. Go back to Step 2 and add your shifts first.'
        />
        <StepFooter
          onBack={onBack}
          onNext={onBack}
          saving={false}
          nextLabel='Back to Shifts'
          hint=''
        />
      </div>
    )
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={5}
        currentGroup={currentGroup}
        title='What are your staffing numbers?'
        subtitle='Set the minimum and ideal number of staff for each shift. Minimum is the lowest acceptable number. Ideal is what you aim for.'
      />

      <div className={styles.accordionList}>
        {rules.map((rule) => {
          const isOpen = openShiftId === rule.shiftId
          const hasError = Object.keys(errors).some((k) =>
            k.startsWith(rule.shiftId)
          )

          return (
            <div
              key={rule.shiftId}
              className={`${styles.accordionItem} ${
                isOpen ? styles.accordionItemOpen : ''
              } ${hasError ? styles.accordionItemError : ''}`}
            >
              {/* ── Accordion header ── */}
              <button
                type='button'
                className={styles.accordionHeader}
                onClick={() => setOpenShiftId(isOpen ? null : rule.shiftId)}
              >
                <div className={styles.accordionHeaderLeft}>
                  <span className={styles.accordionShiftName}>
                    {rule.shiftName}
                  </span>
                  <span className={styles.accordionShiftMeta}>
                    {rule.shiftHours}h
                    {rule.sleepInEligible && (
                      <span className={styles.sleepInBadge}>sleep-in</span>
                    )}
                  </span>
                </div>
                <div className={styles.accordionHeaderRight}>
                  {!isOpen && (
                    <span className={styles.accordionSummary}>
                      Min {rule.weekdayMin} · Ideal {rule.weekdayIdeal}
                      {!rule.sameForWeekend && (
                        <> · Wknd min {rule.weekendMin}</>
                      )}
                    </span>
                  )}
                  <FontAwesomeIcon
                    icon={isOpen ? 'chevron-up' : 'chevron-down'}
                    className={styles.accordionChevron}
                  />
                </div>
              </button>

              {/* ── Accordion body ── */}
              {isOpen && (
                <div className={styles.accordionBody}>
                  {/* Same for weekend checkbox */}
                  <button
                    type='button'
                    className={`${styles.checkRow} ${
                      rule.sameForWeekend ? styles.checkRowActive : ''
                    }`}
                    onClick={() =>
                      updateRule(
                        rule.shiftId,
                        'sameForWeekend',
                        !rule.sameForWeekend
                      )
                    }
                  >
                    <div
                      className={`${styles.checkbox} ${
                        rule.sameForWeekend ? styles.checkboxChecked : ''
                      }`}
                    >
                      {rule.sameForWeekend && <FontAwesomeIcon icon='check' />}
                    </div>
                    <span className={styles.checkLabel}>
                      Same numbers for weekdays and weekends
                    </span>
                  </button>

                  {/* Numbers grid */}
                  <div className={styles.staffingGrid}>
                    {/* Weekday column */}
                    <div className={styles.staffingCol}>
                      <div className={styles.staffingColLabel}>
                        {rule.sameForWeekend ? 'All days' : 'Weekday'}
                      </div>
                      <div className={styles.staffingRow}>
                        <span className={styles.staffingRowLabel}>Minimum</span>
                        <StaffingCounter
                          value={rule.weekdayMin}
                          min={1}
                          max={rule.weekdayIdeal}
                          onChange={(v) =>
                            updateRule(rule.shiftId, 'weekdayMin', v)
                          }
                          error={!!errors[`${rule.shiftId}_weekdayMin`]}
                        />
                      </div>
                      <div className={styles.staffingRow}>
                        <span className={styles.staffingRowLabel}>Ideal</span>
                        <StaffingCounter
                          value={rule.weekdayIdeal}
                          min={rule.weekdayMin}
                          max={20}
                          onChange={(v) =>
                            updateRule(rule.shiftId, 'weekdayIdeal', v)
                          }
                          error={!!errors[`${rule.shiftId}_weekdayIdeal`]}
                        />
                      </div>
                    </div>

                    {/* Weekend column — only when different */}
                    {!rule.sameForWeekend && (
                      <div className={styles.staffingCol}>
                        <div className={styles.staffingColLabel}>Weekend</div>
                        <div className={styles.staffingRow}>
                          <span className={styles.staffingRowLabel}>
                            Minimum
                          </span>
                          <StaffingCounter
                            value={rule.weekendMin}
                            min={1}
                            max={rule.weekendIdeal}
                            onChange={(v) =>
                              updateRule(rule.shiftId, 'weekendMin', v)
                            }
                            error={!!errors[`${rule.shiftId}_weekendMin`]}
                          />
                        </div>
                        <div className={styles.staffingRow}>
                          <span className={styles.staffingRowLabel}>Ideal</span>
                          <StaffingCounter
                            value={rule.weekendIdeal}
                            min={rule.weekendMin}
                            max={20}
                            onChange={(v) =>
                              updateRule(rule.shiftId, 'weekendIdeal', v)
                            }
                            error={!!errors[`${rule.shiftId}_weekendIdeal`]}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inline errors */}
                  {Object.entries(errors)
                    .filter(([k]) => k.startsWith(rule.shiftId))
                    .map(([k, msg]) => (
                      <p key={k} className={styles.fieldError}>
                        {msg}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        hint={`${rules.length} shift${rules.length !== 1 ? 's' : ''} to configure`}
      />
    </div>
  )
}

// ── Staffing counter ───────────────────────────────────────────────────────
function StaffingCounter({ value, min, max, onChange, error }) {
  return (
    <div
      className={`${styles.staffingCounter} ${error ? styles.staffingCounterError : ''}`}
    >
      <button
        type='button'
        className={styles.counterBtn}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <FontAwesomeIcon icon='minus' />
      </button>
      <span className={styles.counterValue}>{value}</span>
      <button
        type='button'
        className={styles.counterBtn}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <FontAwesomeIcon icon='plus' />
      </button>
    </div>
  )
}
// ── Step 6 — Role Exclusions ──────────────────────────────────────────────
const ROLE_EXCLUSION_DEFAULTS = {
  manager: false,
  deputy: false,
  senior: true,
  rcw: true,
  relief: true,
}

function Step6RoleExclusions({
  initial,
  managementSchedule,
  homeName,
  onSave,
  onBack,
  saving,
  currentGroup,
}) {
  const home = homeName || 'This home'
  const managerDifferent =
    managementSchedule?.manager?.differentSchedule ?? false
  const deputyDifferent = managementSchedule?.deputy?.differentSchedule ?? false

  const [exclusions, setExclusions] = useState(() => ({
    manager: initial?.manager ?? false,
    deputy: initial?.deputy ?? false,
    senior: initial?.senior ?? true,
    rcw: initial?.rcw ?? true,
    relief: initial?.relief ?? true,
  }))

  const toggle = (role) => {
    setExclusions((prev) => ({ ...prev, [role]: !prev[role] }))
  }

  // ── Derive informational text based on scenario ───────────────────────
  const getInfoText = () => {
    if (managerDifferent && deputyDifferent) {
      return `${home}'s Manager and Deputy are on a separate schedule and are not counted toward shift staffing minimums.`
    }
    if (managerDifferent && !deputyDifferent) {
      return `${home}'s Manager is on a separate schedule and is not counted toward shift staffing minimums. The Deputy works regular shifts — you can choose whether they count toward your minimum.`
    }
    if (!managerDifferent && deputyDifferent) {
      return `${home}'s Deputy is on a separate schedule and is not counted toward shift staffing minimums. The Manager works regular shifts — you can choose whether they count toward your minimum.`
    }
    return `${home}'s Manager and Deputy both work regular shifts. By default they are not counted toward staffing minimums — but you can turn them on if your home operates differently.`
  }

  const ROLES = [
    {
      key: 'manager',
      label: 'Manager',
      show: !managerDifferent,
    },
    {
      key: 'deputy',
      label: 'Deputy Manager',
      show: !deputyDifferent,
    },
    {
      key: 'senior',
      label: 'Senior Carer',
      show: true,
    },
    {
      key: 'rcw',
      label: 'Residential Care Worker',
      show: true,
    },
    {
      key: 'relief',
      label: 'Relief / Bank Staff',
      show: true,
    },
  ]

  const visibleRoles = ROLES.filter((r) => r.show)
  const activeCount = visibleRoles.filter((r) => exclusions[r.key]).length

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={6}
        currentGroup={currentGroup}
        title='Which roles count toward your minimum staffing?'
        subtitle='This affects how the rota generator checks whether a shift is adequately staffed.'
      />

      {/* ── Informational text ── */}
      <div className={styles.infoNote}>
        <FontAwesomeIcon icon='circle-info' />
        <span>{getInfoText()}</span>
      </div>

      {/* ── Role toggle list ── */}
      <div className={styles.roleExclusionList}>
        {visibleRoles.map((role) => {
          const isOn = exclusions[role.key]
          return (
            <div
              key={role.key}
              className={`${styles.roleExclusionRow} ${
                isOn ? styles.roleExclusionRowOn : ''
              }`}
            >
              <div className={styles.roleExclusionLabel}>
                <span className={styles.roleExclusionName}>{role.label}</span>
                <span className={styles.roleExclusionStatus}>
                  {isOn ? 'Counts toward minimum' : 'Not counted'}
                </span>
              </div>
              <button
                type='button'
                className={`${styles.toggle} ${isOn ? styles.toggleOn : ''}`}
                onClick={() => toggle(role.key)}
                aria-label={`Toggle ${role.label}`}
              >
                <div className={styles.toggleThumb} />
              </button>
            </div>
          )
        })}
      </div>

      <StepFooter
        onBack={onBack}
        onNext={() => onSave(exclusions)}
        saving={saving}
        hint={
          activeCount === 0
            ? 'No roles counting toward minimum'
            : `${activeCount} role${activeCount !== 1 ? 's' : ''} counting toward minimum`
        }
      />
    </div>
  )
}
// ── Step 7 — Shift Coordinator ────────────────────────────────────────────
function Step7Coordinator({ initial, onSave, onBack, saving, currentGroup }) {
  const [selected, setSelected] = useState(
    initial === null || initial === undefined ? null : initial
  )
  const [touched, setTouched] = useState(false)

  const handleSubmit = () => {
    setTouched(true)
    if (selected === null) return
    onSave(selected)
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={7}
        currentGroup={currentGroup}
        title='Does your home appoint a shift coordinator?'
        subtitle='A shift coordinator takes lead responsibility for the shift. This is separate from seniority.'
      />

      <div className={styles.optionList}>
        <button
          className={`${styles.optionCard} ${
            selected === true ? styles.optionSelected : ''
          }`}
          onClick={() => setSelected(true)}
        >
          <div className={styles.optionRadio}>
            <div className={styles.optionRadioDot} />
          </div>
          <div>
            <div className={styles.optionTitle}>
              Yes, we appoint a shift coordinator
            </div>
            <div className={styles.optionDesc}>
              The rota generator assigns one automatically per shift — Senior
              first, then RCW. You can change the assignment after generation.
            </div>
          </div>
        </button>

        <button
          className={`${styles.optionCard} ${
            selected === false ? styles.optionSelected : ''
          }`}
          onClick={() => setSelected(false)}
        >
          <div className={styles.optionRadio}>
            <div className={styles.optionRadioDot} />
          </div>
          <div>
            <div className={styles.optionTitle}>
              No, we do not appoint a shift coordinator
            </div>
            <div className={styles.optionDesc}>
              No coordinator will be assigned or tracked on the rota.
            </div>
          </div>
        </button>
      </div>

      {touched && selected === null && (
        <p className={styles.fieldError}>
          Please select an option to continue.
        </p>
      )}

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        hint={
          selected === null
            ? 'Choose an option above'
            : selected
              ? 'Generator will auto-assign coordinators'
              : 'No coordinator tracking'
        }
      />
    </div>
  )
}
// ── Step 8 — Seniority ────────────────────────────────────────────────────
function Step8Seniority({ initial, onSave, onBack, saving, currentGroup }) {
  const [required, setRequired] = useState(
    initial === null || initial === undefined ? null : initial.required
  )
  const [countPerShift, setCountPerShift] = useState(
    initial?.countPerShift ?? 1
  )
  const [touched, setTouched] = useState(false)

  const handleSubmit = () => {
    setTouched(true)
    if (required === null) return
    onSave({ required, countPerShift: required ? countPerShift : 0 })
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={8}
        currentGroup={currentGroup}
        title='Does a Senior need to be present on every shift?'
        subtitle='This is a soft rule — the rota generator will try to meet it but will never block placement if a Senior is unavailable.'
      />

      <div className={styles.optionList}>
        <button
          className={`${styles.optionCard} ${
            required === true ? styles.optionSelected : ''
          }`}
          onClick={() => setRequired(true)}
        >
          <div className={styles.optionRadio}>
            <div className={styles.optionRadioDot} />
          </div>
          <div>
            <div className={styles.optionTitle}>
              Yes, a Senior should be on every shift
            </div>
            <div className={styles.optionDesc}>
              The generator will try to ensure at least one Senior is present.
              Flagged as a soft violation if not possible.
            </div>
          </div>
        </button>

        <button
          className={`${styles.optionCard} ${
            required === false ? styles.optionSelected : ''
          }`}
          onClick={() => setRequired(false)}
        >
          <div className={styles.optionRadio}>
            <div className={styles.optionRadioDot} />
          </div>
          <div>
            <div className={styles.optionTitle}>
              No, Seniors are placed like any other staff member
            </div>
            <div className={styles.optionDesc}>
              No seniority presence requirement will be applied.
            </div>
          </div>
        </button>
      </div>

      {touched && required === null && (
        <p className={styles.fieldError}>
          Please select an option to continue.
        </p>
      )}

      {/* ── Senior count — only when required ── */}
      {required === true && (
        <div className={styles.seniorityCount}>
          <div className={styles.fieldLabel}>How many Seniors per shift?</div>
          <div className={styles.maxPerNightRow}>
            <button
              type='button'
              className={styles.counterBtn}
              onClick={() => setCountPerShift((prev) => Math.max(1, prev - 1))}
              disabled={countPerShift <= 1}
            >
              <FontAwesomeIcon icon='minus' />
            </button>
            <span className={styles.counterValue}>{countPerShift}</span>
            <button
              type='button'
              className={styles.counterBtn}
              onClick={() => setCountPerShift((prev) => Math.min(10, prev + 1))}
              disabled={countPerShift >= 10}
            >
              <FontAwesomeIcon icon='plus' />
            </button>
            <span className={styles.counterLabel}>per shift</span>
          </div>
          <p className={styles.seniorityNote}>
            <FontAwesomeIcon icon='circle-info' />
            Applies when Seniors are available and within contracted hours.
            Never blocks placement.
          </p>
        </div>
      )}

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        hint={
          required === null
            ? 'Choose an option above'
            : required
              ? `${countPerShift} Senior${countPerShift !== 1 ? 's' : ''} required per shift`
              : 'No seniority requirement'
        }
      />
    </div>
  )
}
// ── Step 9 — Soft Rules ───────────────────────────────────────────────────
const SOFT_RULE_QUESTIONS = [
  {
    key: 'femalePerShift',
    question:
      'Does this home require at least 1 female staff member per shift?',
    desc: 'The generator will try to ensure at least one female staff member is placed on every shift.',
  },
  {
    key: 'driverPerShift',
    question: 'Does this home require at least 1 driver per shift?',
    desc: 'The generator will try to ensure at least one certified driver is placed on every shift.',
  },
]

const SLEEP_IN_FOLLOW_RULE = {
  key: 'sleepInFollowThrough',
  question:
    'Should staff who do a late shift with sleep-in ideally work the following early shift?',
  desc: 'This encourages continuity of care. The generator will try to honour it but will not block placement.',
}

function Step9SoftRules({
  initial,
  sleepInEnabled,
  onSave,
  onBack,
  saving,
  currentGroup,
}) {
  const [rules, setRules] = useState({
    femalePerShift: initial?.femalePerShift ?? null,
    driverPerShift: initial?.driverPerShift ?? null,
    sleepInFollowThrough: initial?.sleepInFollowThrough ?? null,
  })
  const [touched, setTouched] = useState(false)
  const [errors, setErrors] = useState({})

  const setRule = (key, value) => {
    setRules((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: null }))
  }

  const validate = () => {
    const errs = {}
    if (rules.femalePerShift === null)
      errs.femalePerShift = 'Please select an option'
    if (rules.driverPerShift === null)
      errs.driverPerShift = 'Please select an option'
    if (sleepInEnabled && rules.sleepInFollowThrough === null)
      errs.sleepInFollowThrough = 'Please select an option'
    return errs
  }

  const handleSubmit = () => {
    setTouched(true)
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSave({
      femalePerShift: rules.femalePerShift,
      driverPerShift: rules.driverPerShift,
      sleepInFollowThrough: sleepInEnabled ? rules.sleepInFollowThrough : false,
    })
  }

  const visibleRules = [
    ...SOFT_RULE_QUESTIONS,
    ...(sleepInEnabled ? [SLEEP_IN_FOLLOW_RULE] : []),
  ]

  const answeredCount = visibleRules.filter((r) => rules[r.key] !== null).length

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={9}
        currentGroup={currentGroup}
        title='Any soft staffing preferences?'
        subtitle='These are preferences — not hard rules. The rota generator will try to meet them and flag when it cannot.'
      />

      <div className={styles.softRuleList}>
        {visibleRules.map((rule) => (
          <div key={rule.key} className={styles.softRuleCard}>
            <div className={styles.softRuleQuestion}>{rule.question}</div>
            <div className={styles.softRuleDesc}>{rule.desc}</div>

            <div className={styles.softRuleOptions}>
              <button
                type='button'
                className={`${styles.softRuleBtn} ${
                  rules[rule.key] === true ? styles.softRuleBtnActive : ''
                }`}
                onClick={() => setRule(rule.key, true)}
              >
                Yes
              </button>
              <button
                type='button'
                className={`${styles.softRuleBtn} ${
                  rules[rule.key] === false ? styles.softRuleBtnNo : ''
                }`}
                onClick={() => setRule(rule.key, false)}
              >
                No
              </button>
            </div>

            {touched && errors[rule.key] && (
              <p className={styles.inlineError}>{errors[rule.key]}</p>
            )}
          </div>
        ))}
      </div>

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        hint={
          answeredCount === 0
            ? 'Answer all questions above'
            : answeredCount < visibleRules.length
              ? `${visibleRules.length - answeredCount} question${visibleRules.length - answeredCount !== 1 ? 's' : ''} remaining`
              : 'All preferences set'
        }
      />
    </div>
  )
}
// ── Step 10 — Rota Schedule ───────────────────────────────────────────────
function Step10RotaSchedule({ initial, onSave, onBack, saving, currentGroup }) {
  const [generateWeeksBefore, setGenerateWeeksBefore] = useState(
    initial?.generateWeeksBefore ?? 4
  )
  const [publishWeeksBefore, setPublishWeeksBefore] = useState(
    initial?.publishWeeksBefore ?? 2
  )

  // Publish reminder cannot be later than generate reminder
  // e.g. if generate is at 4 weeks, publish must be ≤ 4 weeks
  const handleGenerateChange = (val) => {
    setGenerateWeeksBefore(val)
    if (publishWeeksBefore > val) {
      setPublishWeeksBefore(val)
    }
  }

  const handleSubmit = () => {
    onSave({ generateWeeksBefore, publishWeeksBefore })
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={10}
        currentGroup={currentGroup}
        title='When should we remind you about your rota?'
        subtitle='Set how far in advance you want to be reminded to generate and publish your rota if you have not done it yet.'
      />

      <div className={styles.scheduleCards}>
        {/* Generate reminder */}
        <div className={styles.scheduleCard}>
          <div className={styles.scheduleCardLeft}>
            <div className={styles.scheduleCardTitle}>Generate reminder</div>
            <div className={styles.scheduleCardDesc}>
              Remind me to generate the rota if I haven't done it by this many
              weeks before the period starts.
            </div>
          </div>
          <div className={styles.scheduleCardCounter}>
            <button
              type='button'
              className={styles.counterBtn}
              onClick={() =>
                handleGenerateChange(Math.max(1, generateWeeksBefore - 1))
              }
              disabled={generateWeeksBefore <= 1}
            >
              <FontAwesomeIcon icon='minus' />
            </button>
            <div className={styles.scheduleCounterValue}>
              <span className={styles.counterValue}>{generateWeeksBefore}</span>
              <span className={styles.scheduleCounterUnit}>
                {generateWeeksBefore === 1 ? 'week' : 'weeks'} before
              </span>
            </div>
            <button
              type='button'
              className={styles.counterBtn}
              onClick={() =>
                handleGenerateChange(Math.min(12, generateWeeksBefore + 1))
              }
              disabled={generateWeeksBefore >= 12}
            >
              <FontAwesomeIcon icon='plus' />
            </button>
          </div>
        </div>

        {/* Publish reminder */}
        <div className={styles.scheduleCard}>
          <div className={styles.scheduleCardLeft}>
            <div className={styles.scheduleCardTitle}>Publish reminder</div>
            <div className={styles.scheduleCardDesc}>
              Remind me to publish the rota if I haven't done it by this many
              weeks before the period starts.
            </div>
          </div>
          <div className={styles.scheduleCardCounter}>
            <button
              type='button'
              className={styles.counterBtn}
              onClick={() =>
                setPublishWeeksBefore(Math.max(1, publishWeeksBefore - 1))
              }
              disabled={publishWeeksBefore <= 1}
            >
              <FontAwesomeIcon icon='minus' />
            </button>
            <div className={styles.scheduleCounterValue}>
              <span className={styles.counterValue}>{publishWeeksBefore}</span>
              <span className={styles.scheduleCounterUnit}>
                {publishWeeksBefore === 1 ? 'week' : 'weeks'} before
              </span>
            </div>
            <button
              type='button'
              className={styles.counterBtn}
              onClick={() =>
                setPublishWeeksBefore(
                  Math.min(generateWeeksBefore, publishWeeksBefore + 1)
                )
              }
              disabled={publishWeeksBefore >= generateWeeksBefore}
            >
              <FontAwesomeIcon icon='plus' />
            </button>
          </div>
        </div>
      </div>

      {/* Info note */}
      <div className={styles.infoNote}>
        <FontAwesomeIcon icon='circle-info' />
        <span>
          You'll receive a notification if you approach these deadlines without
          having acted. Nothing is generated or published automatically — you
          always stay in control.
        </span>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        hint={`Generate reminder: ${generateWeeksBefore}w before · Publish reminder: ${publishWeeksBefore}w before`}
      />
    </div>
  )
}
// ── Step 11 — Review + Finish ─────────────────────────────────────────────
function Step11Review({
  config,
  homeShifts,
  homeShiftRules,
  homeName,
  onEdit,
  onBack,
  onFinish,
  saving,
  currentGroup,
}) {
  const mgmt = config.managementSchedule || {}
  const sleepIn = config.sleepIn || {}
  const roleExclusions = config.roleExclusions || {}
  const seniority = config.seniority || {}
  const softRules = config.softRules || {}
  const rotaSchedule = config.rotaSchedule || {}

  const formatMgmtRole = (role) => {
    if (!role?.differentSchedule) return 'Works regular shifts'
    const days = (role.workingDays || [])
      .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
      .join(', ')
    if (role.sameTimeAllDays) {
      return `${days} · ${role.startTime}–${role.endTime}`
    }
    return `${days} · Variable hours`
  }

  const eligibleShifts = (homeShifts || [])
    .filter((s) => s.sleep_in_eligible)
    .map((s) => s.name)
    .join(', ')

  const countingRoles = Object.entries(roleExclusions)
    .filter(([, val]) => val === true)
    .map(([key]) => {
      const labels = {
        manager: 'Manager',
        deputy: 'Deputy',
        senior: 'Senior',
        rcw: 'RCW',
        relief: 'Relief',
      }
      return labels[key] || key
    })
    .join(', ')

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={11}
        currentGroup={currentGroup}
        title='Review your home setup'
        subtitle='Everything looks good. Review your choices and click Finish to complete your setup.'
      />

      {/* ── Info note ── */}
      <div className={styles.infoNote}>
        <FontAwesomeIcon icon='circle-info' />
        <span>
          Click <strong>Edit</strong> on any row to jump directly to that step.
          You can also use the left panel to navigate to any completed step at
          any time.
        </span>
      </div>

      <div className={styles.reviewSections}>
        {/* ── Group 1 — Shift Structure ── */}
        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHeader}>
            <span className={styles.reviewSectionTitle}>Shift Structure</span>
          </div>
          <div className={styles.reviewRows}>
            <ReviewRow
              label='Period type'
              value={
                config.periodType === 'week' ? 'Week by week' : 'Month by month'
              }
              onEdit={() => onEdit(1)}
            />
            <ReviewRow
              label='Shifts'
              value={(homeShifts || []).map((s) => s.name).join(', ') || '—'}
              onEdit={() => onEdit(2)}
            />
            <ReviewRow
              label='Manager schedule'
              value={formatMgmtRole(mgmt.manager)}
              onEdit={() => onEdit(3)}
            />
            <ReviewRow
              label='Deputy schedule'
              value={formatMgmtRole(mgmt.deputy)}
              onEdit={() => onEdit(3)}
            />
            <ReviewRow
              label='Sleep-in'
              value={
                sleepIn.enabled
                  ? `Yes · ${eligibleShifts || '—'} · Max ${sleepIn.maxPerNight}`
                  : 'Not used'
              }
              onEdit={() => onEdit(4)}
            />
          </div>
        </div>

        {/* ── Group 2 — Staffing Rules ── */}
        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHeader}>
            <span className={styles.reviewSectionTitle}>Staffing Rules</span>
          </div>
          <div className={styles.reviewRows}>
            {(homeShiftRules || []).map((rule) => {
              const shift = (homeShifts || []).find(
                (s) => s.id === rule.shift_id
              )
              if (!shift) return null
              return (
                <ReviewRow
                  key={rule.shift_id}
                  label={shift.name}
                  value={
                    rule.same_for_weekend
                      ? `Min ${rule.weekday_min} · Ideal ${rule.weekday_ideal}`
                      : `Wkday min ${rule.weekday_min} / ideal ${rule.weekday_ideal} · Wknd min ${rule.weekend_min} / ideal ${rule.weekend_ideal}`
                  }
                  onEdit={() => onEdit(5)}
                />
              )
            })}
            <ReviewRow
              label='Counting roles'
              value={countingRoles || 'None'}
              onEdit={() => onEdit(6)}
            />
            <ReviewRow
              label='Shift coordinator'
              value={config.shiftCoordinator ? 'Yes — auto-assigned' : 'No'}
              onEdit={() => onEdit(7)}
            />
            <ReviewRow
              label='Seniority'
              value={
                seniority.required
                  ? `${seniority.countPerShift} Senior${seniority.countPerShift !== 1 ? 's' : ''} per shift`
                  : 'No requirement'
              }
              onEdit={() => onEdit(8)}
            />
            <ReviewRow
              label='Female per shift'
              value={softRules.femalePerShift ? 'Yes' : 'No'}
              onEdit={() => onEdit(9)}
            />
            <ReviewRow
              label='Driver per shift'
              value={softRules.driverPerShift ? 'Yes' : 'No'}
              onEdit={() => onEdit(9)}
            />
            {sleepIn.enabled && (
              <ReviewRow
                label='Sleep-in follow-through'
                value={softRules.sleepInFollowThrough ? 'Yes' : 'No'}
                onEdit={() => onEdit(9)}
              />
            )}
          </div>
        </div>

        {/* ── Rota Schedule ── */}
        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHeader}>
            <span className={styles.reviewSectionTitle}>Rota Schedule</span>
          </div>
          <div className={styles.reviewRows}>
            <ReviewRow
              label='Generate reminder'
              value={`${rotaSchedule.generateWeeksBefore} ${rotaSchedule.generateWeeksBefore === 1 ? 'week' : 'weeks'} before period`}
              onEdit={() => onEdit(10)}
            />
            <ReviewRow
              label='Publish reminder'
              value={`${rotaSchedule.publishWeeksBefore} ${rotaSchedule.publishWeeksBefore === 1 ? 'week' : 'weeks'} before period`}
              onEdit={() => onEdit(10)}
            />
          </div>
        </div>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={onFinish}
        saving={saving}
        nextLabel='Finish setup'
        hint={`Setting up ${homeName || 'your home'}`}
      />
    </div>
  )
}

// ── Review row ────────────────────────────────────────────────────────────
function ReviewRow({ label, value, onEdit }) {
  return (
    <div className={styles.reviewRow}>
      <span className={styles.reviewRowLabel}>{label}</span>
      <div className={styles.reviewRowRight}>
        <span className={styles.reviewRowValue}>{value}</span>
        {onEdit && (
          <button className={styles.reviewEditBtn} onClick={onEdit}>
            <FontAwesomeIcon icon='pen' />
            Edit
          </button>
        )}
      </div>
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
