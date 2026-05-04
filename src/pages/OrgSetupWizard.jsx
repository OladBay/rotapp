// src/pages/OrgSetupWizard.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../context/AuthContext'
import { useOrgSetup } from '../context/OrgSetupContext'
import { useTheme } from '../context/ThemeContext'
import {
  linkUserToOrg,
  createHomeForOrg,
  linkUserToHome,
  completeOrgWizard,
  saveOrgWizardStep,
} from '../utils/orgSetup'
import { createInviteToken } from '../utils/inviteTokens'
import { supabase } from '../lib/supabase'
import styles from './OrgSetupWizard.module.css'

// ── Step definitions ───────────────────────────────────────────────────────
const STEPS = [
  { number: 1, label: 'Organisation name', desc: 'What is your org called?' },
  { number: 2, label: 'Your role', desc: 'Your role in this organisation' },
  { number: 3, label: 'Care type', desc: 'Regulatory framework' },
  { number: 4, label: 'Org structure', desc: 'How many homes?' },
  { number: 5, label: 'Review & finish', desc: 'Confirm your setup' },
]

// ── Top bar ────────────────────────────────────────────────────────────────
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

// ── Greeting screen ────────────────────────────────────────────────────────
// Pure welcome screen. No form, no DB write. Just introduces the wizard.
function OrgGreetingScreen({ userName, onBegin }) {
  return (
    <div className={styles.greetingWrap}>
      <div className={styles.greetingCard}>
        <div className={styles.greetingIcon}>
          <FontAwesomeIcon icon='shield' />
        </div>

        <div className={styles.greetingText}>
          <p className={styles.greetingTitle}>
            Hi {userName || 'there'} — let's set up
          </p>
          <h1 className={styles.greetingName}>your organisation.</h1>
        </div>

        <p className={styles.greetingBody}>
          Before you can access Rotapp in full, you need to complete your
          organisation setup. It takes about 5 minutes and covers your care
          type, structure, and first home.
        </p>

        <button className={styles.greetingBtn} onClick={onBegin}>
          Let's get started <FontAwesomeIcon icon='chevron-right' />
        </button>

        <p className={styles.greetingFooter}>
          <FontAwesomeIcon icon='circle-info' />
          You can save your progress at any time and come back later.
        </p>
      </div>
    </div>
  )
}

// ── Shared step header ─────────────────────────────────────────────────────
function StepHeader({ stepNumber, title, subtitle }) {
  return (
    <div className={styles.stepHeaderBlock}>
      <div className={styles.breadcrumb}>
        <span>Step {stepNumber} of 5</span>
        <div className={styles.breadcrumbSep} />
        <span>Organisation Setup</span>
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

// ── Step 1 — Organisation name ─────────────────────────────────────────────
// Captures org name. Creates org row + links user if no org exists yet.
// If org already exists (returning user editing name), updates the orgs row.
function Step1OrgName({ initial, userId, existingOrgId, onSave, saving }) {
  const [orgName, setOrgName] = useState(initial?.orgName || '')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = () => {
    setTouched(true)
    if (!orgName.trim()) {
      setError('Enter your organisation name to continue')
      return
    }
    onSave({ orgName: orgName.trim() })
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={1}
        title='What is your organisation called?'
        subtitle='This is the name of your care organisation. You can update it later from your settings.'
      />

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Organisation name</label>
        <input
          className={`${styles.textInput} ${touched && error ? styles.inputError : ''}`}
          type='text'
          placeholder='e.g. Coventry City Council'
          value={orgName}
          autoFocus
          onChange={(e) => {
            setOrgName(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
        />
        {touched && error && (
          <span className={styles.inlineError}>{error}</span>
        )}
      </div>

      <StepFooter
        onNext={handleSubmit}
        saving={saving}
        hint={orgName.trim() ? orgName.trim() : 'Enter your organisation name'}
      />
    </div>
  )
}

// ── Step 2 — Your role ─────────────────────────────────────────────────────
const ORG_ROLES = [
  { value: 'operationallead', label: 'Operational Lead' },
  { value: 'manager', label: 'Manager' },
  { value: 'it_admin', label: 'IT / System Administrator' },
  { value: 'owner', label: 'Owner' },
  { value: 'other', label: 'Other' },
]

function Step2Role({ initial, onSave, onBack, saving }) {
  const [roleLabel, setRoleLabel] = useState(initial?.orgCreatorRoleLabel || '')
  const [otherRole, setOtherRole] = useState(initial?.otherRole || '')
  const [touched, setTouched] = useState(false)
  const [errors, setErrors] = useState({})

  const handleSubmit = () => {
    setTouched(true)
    const errs = {}
    if (!roleLabel) errs.roleLabel = 'Select your role'
    if (roleLabel === 'other' && !otherRole.trim())
      errs.otherRole = 'Enter your role'
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSave({
      orgCreatorRoleLabel:
        roleLabel === 'other'
          ? otherRole.trim()
          : ORG_ROLES.find((r) => r.value === roleLabel)?.label || roleLabel,
    })
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={2}
        title='What is your role?'
        subtitle='This helps us personalise your experience. Your access level is the same regardless of the role you select.'
      />

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>
          Your role in this organisation
        </label>
        <div className={styles.infoNote}>
          <FontAwesomeIcon icon='circle-info' className={styles.infoNoteIcon} />
          <span>
            This is for our records only. Your access level is the same
            regardless of the role selected.
          </span>
        </div>
        <div className={styles.optionList}>
          {ORG_ROLES.map((role) => (
            <button
              key={role.value}
              className={`${styles.optionCard} ${roleLabel === role.value ? styles.optionSelected : ''}`}
              onClick={() => {
                setRoleLabel(role.value)
                setErrors((prev) => ({ ...prev, roleLabel: null }))
              }}
            >
              <div className={styles.optionRadio}>
                <div className={styles.optionRadioDot} />
              </div>
              <div className={styles.optionTitle}>{role.label}</div>
            </button>
          ))}
        </div>
        {errors.roleLabel && (
          <span className={styles.inlineError}>{errors.roleLabel}</span>
        )}

        {roleLabel === 'other' && (
          <div className={styles.fieldGroup}>
            <input
              className={`${styles.textInput} ${errors.otherRole ? styles.inputError : ''}`}
              type='text'
              placeholder='Enter your role'
              value={otherRole}
              onChange={(e) => {
                setOtherRole(e.target.value)
                setErrors((prev) => ({ ...prev, otherRole: null }))
              }}
            />
            {errors.otherRole && (
              <span className={styles.inlineError}>{errors.otherRole}</span>
            )}
          </div>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        hint='Select your role to continue'
      />
    </div>
  )
}

// ── Step 3 — Care type ─────────────────────────────────────────────────────
const CARE_TYPES = [
  {
    value: 'childrens',
    label: "Children's residential care",
    desc: 'Regulated by Ofsted',
  },
  { value: 'adult', label: 'Adult care', desc: 'Regulated by CQC' },
  { value: 'both', label: 'Both', desc: 'Regulated by Ofsted and CQC' },
]

function Step3CareType({ initial, onSave, onBack, saving }) {
  const [careType, setCareType] = useState(initial?.careType || '')
  const [errors, setErrors] = useState({})

  const handleSubmit = () => {
    if (!careType) {
      setErrors({ careType: 'Select a care type' })
      return
    }
    onSave({ careType })
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={3}
        title='What type of care do you provide?'
        subtitle='This determines which compliance framework applies to your organisation.'
      />

      <div className={styles.fieldGroup}>
        <div className={styles.optionList}>
          {CARE_TYPES.map((type) => (
            <button
              key={type.value}
              className={`${styles.optionCard} ${careType === type.value ? styles.optionSelected : ''}`}
              onClick={() => {
                setCareType(type.value)
                setErrors({})
              }}
            >
              <div className={styles.optionRadio}>
                <div className={styles.optionRadioDot} />
              </div>
              <div className={styles.optionContent}>
                <div className={styles.optionTitle}>{type.label}</div>
                <div className={styles.optionDesc}>{type.desc}</div>
              </div>
            </button>
          ))}
        </div>
        {errors.careType && (
          <span className={styles.inlineError}>{errors.careType}</span>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        hint={
          careType
            ? CARE_TYPES.find((t) => t.value === careType)?.label
            : 'Select a care type'
        }
      />
    </div>
  )
}

// ── Step 4 — Org structure ─────────────────────────────────────────────────
function Step4Structure({ initial, orgName, onSave, onBack, saving }) {
  const [structure, setStructure] = useState(initial?.structure || '')
  const [homeName, setHomeName] = useState(initial?.homeName || '')
  const [sameAsOrg, setSameAsOrg] = useState(initial?.sameAsOrg || false)
  const [managerType, setManagerType] = useState(initial?.managerType || '')
  const [inviteName, setInviteName] = useState(initial?.inviteName || '')
  const [inviteEmail, setInviteEmail] = useState(initial?.inviteEmail || '')
  const [touched, setTouched] = useState(false)
  const [errors, setErrors] = useState({})

  const handleSameAsOrgToggle = () => {
    const next = !sameAsOrg
    setSameAsOrg(next)
    if (next) setHomeName(orgName || '')
    else setHomeName('')
  }

  const handleSubmit = () => {
    setTouched(true)
    const errs = {}
    if (!structure) errs.structure = 'Select your structure'
    if (structure === 'single') {
      if (!homeName.trim()) errs.homeName = 'Enter a home name'
      if (!managerType) errs.managerType = 'Select who will manage this home'
      if (managerType === 'other') {
        if (!inviteName.trim()) errs.inviteName = 'Enter the manager name'
        if (!inviteEmail.trim()) errs.inviteEmail = 'Enter the manager email'
        else if (!/\S+@\S+\.\S+/.test(inviteEmail))
          errs.inviteEmail = 'Enter a valid email'
      }
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSave({
      structure,
      homeName: homeName.trim(),
      sameAsOrg,
      managerType,
      inviteName: inviteName.trim(),
      inviteEmail: inviteEmail.trim(),
    })
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={4}
        title='How is your organisation structured?'
        subtitle='Tell us whether you operate one home or multiple. You can add more homes later.'
      />

      <div className={styles.fieldGroup}>
        <div className={styles.optionList}>
          <button
            className={`${styles.optionCard} ${structure === 'single' ? styles.optionSelected : ''}`}
            onClick={() => {
              setStructure('single')
              setErrors((p) => ({ ...p, structure: null }))
            }}
          >
            <div className={styles.optionRadio}>
              <div className={styles.optionRadioDot} />
            </div>
            <div className={styles.optionContent}>
              <div className={styles.optionTitle}>Single home</div>
              <div className={styles.optionDesc}>You operate one care home</div>
            </div>
          </button>
          <button
            className={`${styles.optionCard} ${structure === 'multiple' ? styles.optionSelected : ''}`}
            onClick={() => {
              setStructure('multiple')
              setErrors((p) => ({ ...p, structure: null }))
            }}
          >
            <div className={styles.optionRadio}>
              <div className={styles.optionRadioDot} />
            </div>
            <div className={styles.optionContent}>
              <div className={styles.optionTitle}>Multiple homes</div>
              <div className={styles.optionDesc}>
                You operate more than one care home
              </div>
            </div>
          </button>
        </div>
        {errors.structure && (
          <span className={styles.inlineError}>{errors.structure}</span>
        )}

        {structure === 'single' && (
          <div className={styles.singleHomeBlock}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Home name</label>
              <div className={styles.sameAsOrgRow}>
                <input
                  type='checkbox'
                  id='sameAsOrg'
                  checked={sameAsOrg}
                  onChange={handleSameAsOrgToggle}
                  className={styles.checkbox}
                />
                <label htmlFor='sameAsOrg' className={styles.checkboxLabel}>
                  Same as organisation name
                </label>
              </div>
              <input
                className={`${styles.textInput} ${errors.homeName ? styles.inputError : ''}`}
                type='text'
                placeholder='e.g. Coventry House'
                value={homeName}
                disabled={sameAsOrg}
                onChange={(e) => {
                  setHomeName(e.target.value)
                  setErrors((p) => ({ ...p, homeName: null }))
                }}
              />
              {errors.homeName && (
                <span className={styles.inlineError}>{errors.homeName}</span>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Who will manage this home?
              </label>
              <div className={styles.optionList}>
                <button
                  className={`${styles.optionCard} ${managerType === 'self' ? styles.optionSelected : ''}`}
                  onClick={() => {
                    setManagerType('self')
                    setErrors((p) => ({ ...p, managerType: null }))
                  }}
                >
                  <div className={styles.optionRadio}>
                    <div className={styles.optionRadioDot} />
                  </div>
                  <div className={styles.optionTitle}>I will manage it</div>
                </button>
                <button
                  className={`${styles.optionCard} ${managerType === 'other' ? styles.optionSelected : ''}`}
                  onClick={() => {
                    setManagerType('other')
                    setErrors((p) => ({ ...p, managerType: null }))
                  }}
                >
                  <div className={styles.optionRadio}>
                    <div className={styles.optionRadioDot} />
                  </div>
                  <div className={styles.optionTitle}>
                    Someone else will manage it
                  </div>
                </button>
              </div>
              {errors.managerType && (
                <span className={styles.inlineError}>{errors.managerType}</span>
              )}
            </div>

            {managerType === 'other' && (
              <div className={styles.inviteBlock}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Manager's name</label>
                  <input
                    className={`${styles.textInput} ${errors.inviteName ? styles.inputError : ''}`}
                    type='text'
                    placeholder='Full name'
                    value={inviteName}
                    onChange={(e) => {
                      setInviteName(e.target.value)
                      setErrors((p) => ({ ...p, inviteName: null }))
                    }}
                  />
                  {errors.inviteName && (
                    <span className={styles.inlineError}>
                      {errors.inviteName}
                    </span>
                  )}
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Manager's email</label>
                  <input
                    className={`${styles.textInput} ${errors.inviteEmail ? styles.inputError : ''}`}
                    type='email'
                    placeholder='email@example.com'
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value)
                      setErrors((p) => ({ ...p, inviteEmail: null }))
                    }}
                  />
                  {errors.inviteEmail && (
                    <span className={styles.inlineError}>
                      {errors.inviteEmail}
                    </span>
                  )}
                </div>
                <p className={styles.inviteHint}>
                  <FontAwesomeIcon icon='circle-info' />
                  We'll send them an invite link. They'll be guided through home
                  setup when they sign up.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        hint={
          structure === 'single'
            ? 'One home'
            : structure === 'multiple'
              ? 'Multiple homes'
              : 'Select your structure'
        }
      />
    </div>
  )
}

// ── Step 5 — Review ────────────────────────────────────────────────────────
function Step5Review({ config, onEdit, onBack, onFinish, saving }) {
  const careTypeLabel = {
    childrens: "Children's residential care",
    adult: 'Adult care',
    both: 'Both (Ofsted + CQC)',
  }
  const structureLabel = { single: 'Single home', multiple: 'Multiple homes' }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={5}
        title='Review your setup'
        subtitle='Check everything looks right before finishing. Click Edit to change any section.'
      />

      <div className={styles.reviewSections}>
        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHeader}>
            <span className={styles.reviewSectionTitle}>Organisation</span>
            <button className={styles.reviewEditBtn} onClick={() => onEdit(1)}>
              <FontAwesomeIcon icon='pen-to-square' /> Edit
            </button>
          </div>
          <div className={styles.reviewRows}>
            <div className={styles.reviewRow}>
              <span className={styles.reviewRowLabel}>Organisation name</span>
              <span className={styles.reviewRowValue}>
                {config.orgName || '—'}
              </span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewRowLabel}>Your role</span>
              <span className={styles.reviewRowValue}>
                {config.orgCreatorRoleLabel || '—'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHeader}>
            <span className={styles.reviewSectionTitle}>Care type</span>
            <button className={styles.reviewEditBtn} onClick={() => onEdit(3)}>
              <FontAwesomeIcon icon='pen-to-square' /> Edit
            </button>
          </div>
          <div className={styles.reviewRows}>
            <div className={styles.reviewRow}>
              <span className={styles.reviewRowLabel}>Care type</span>
              <span className={styles.reviewRowValue}>
                {careTypeLabel[config.careType] || '—'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHeader}>
            <span className={styles.reviewSectionTitle}>Structure</span>
            <button className={styles.reviewEditBtn} onClick={() => onEdit(4)}>
              <FontAwesomeIcon icon='pen-to-square' /> Edit
            </button>
          </div>
          <div className={styles.reviewRows}>
            <div className={styles.reviewRow}>
              <span className={styles.reviewRowLabel}>Structure</span>
              <span className={styles.reviewRowValue}>
                {structureLabel[config.structure] || '—'}
              </span>
            </div>
            {config.structure === 'single' && (
              <>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewRowLabel}>Home name</span>
                  <span className={styles.reviewRowValue}>
                    {config.homeName || '—'}
                  </span>
                </div>
                <div className={styles.reviewRow}>
                  <span className={styles.reviewRowLabel}>Home manager</span>
                  <span className={styles.reviewRowValue}>
                    {config.managerType === 'self'
                      ? 'You'
                      : config.inviteName
                        ? `${config.inviteName} (invite pending)`
                        : '—'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={onFinish}
        saving={saving}
        nextLabel='Finish setup'
        hint='Review complete — ready to finish'
      />
    </div>
  )
}

// ── Transition screen ──────────────────────────────────────────────────────
function TransitionScreen({ config, onProceed }) {
  const isSingleSelfManaged =
    config.structure === 'single' && config.managerType === 'self'
  const isSingleInvited =
    config.structure === 'single' && config.managerType === 'other'
  const isMultiple = config.structure === 'multiple'

  return (
    <div className={styles.transitionWrap}>
      <div className={styles.transitionCard}>
        <div className={styles.transitionIconSuccess}>
          <FontAwesomeIcon icon='circle-check' />
        </div>

        <h1 className={styles.transitionTitle}>Your organisation is set up.</h1>
        <p className={styles.transitionBody}>
          <strong>{config.orgName}</strong> is ready to go.
        </p>

        <div className={styles.transitionDivider} />

        {isSingleSelfManaged && (
          <>
            <p className={styles.transitionNext}>
              Now let's set up <strong>{config.homeName}</strong>.
            </p>
            <p className={styles.transitionDesc}>
              This takes about 10 minutes. You'll configure your shifts,
              staffing numbers, and rota rules. You can save and come back at
              any time.
            </p>
            <button className={styles.primaryBtn} onClick={onProceed}>
              Set up my home <FontAwesomeIcon icon='chevron-right' />
            </button>
          </>
        )}

        {isSingleInvited && (
          <>
            <div className={styles.transitionInviteRow}>
              <FontAwesomeIcon
                icon='envelope'
                className={styles.transitionEnvIcon}
              />
              <p className={styles.transitionDesc}>
                We've sent an invite to <strong>{config.inviteEmail}</strong>.
                Once they sign up, they'll be guided through home setup
                automatically.
              </p>
            </div>
            <button className={styles.primaryBtn} onClick={onProceed}>
              Go to my dashboard <FontAwesomeIcon icon='chevron-right' />
            </button>
          </>
        )}

        {isMultiple && (
          <>
            <p className={styles.transitionDesc}>
              You're set up to manage multiple homes. Add and configure your
              homes from your dashboard.
            </p>
            <button className={styles.primaryBtn} onClick={onProceed}>
              Go to my dashboard <FontAwesomeIcon icon='chevron-right' />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main wizard ────────────────────────────────────────────────────────────
function OrgSetupWizard() {
  const { user, logout, updateUser } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const {
    orgSetupLoading,
    orgWizardStep,
    orgConfig,
    orgName: savedOrgName,
    refreshOrgSetup,
  } = useOrgSetup()
  const navigate = useNavigate()

  // null = greeting screen, number = active wizard step
  // If the user already has an org_id, skip the greeting and resume from
  // the saved step (or step 1 if they haven't started the wizard body yet).
  const hasOrg = !!user?.org_id
  const [currentStep, setCurrentStep] = useState(
    hasOrg ? (orgWizardStep > 0 ? orgWizardStep : 1) : null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showTransition, setShowTransition] = useState(false)
  const [finalConfig, setFinalConfig] = useState(null)

  // orgId: always sourced from user profile on mount.
  // For new users, Step 1 sets it after org creation.
  const [orgId, setOrgId] = useState(user?.org_id || null)

  // Wizard config: prefill from saved orgConfig if resuming, blank if fresh.
  const [wizardConfig, setWizardConfig] = useState({
    orgName: orgConfig?.orgName || savedOrgName || '',
    orgCreatorRoleLabel: orgConfig?.orgCreatorRoleLabel || '',
    careType: orgConfig?.careType || '',
    structure: orgConfig?.structure || '',
    homeName: orgConfig?.homeName || '',
    sameAsOrg: orgConfig?.sameAsOrg || false,
    managerType: orgConfig?.managerType || '',
    inviteName: orgConfig?.inviteName || '',
    inviteEmail: orgConfig?.inviteEmail || '',
  })

  if (orgSetupLoading) return null

  const updateConfig = (updates) => {
    setWizardConfig((prev) => ({ ...prev, ...updates }))
  }

  // ── Greeting → Step 1 ──────────────────────────────────────────────────
  const handleGreetingComplete = () => {
    setCurrentStep(1)
  }

  // ── Step 1 save — org name ─────────────────────────────────────────────
  // If no org exists yet: create org row, link user, update user state.
  // If org already exists (editing): update org name only.
  const handleStep1Save = async (data) => {
    setSaving(true)
    setError('')
    try {
      updateConfig(data)

      if (!orgId) {
        // New org — create row and link user
        const { data: newOrgId, error: orgError } = await supabase.rpc(
          'create_org',
          {
            p_name: data.orgName,
            p_updated_at: new Date().toISOString(),
          }
        )
        if (orgError) throw orgError

        await linkUserToOrg(user.id, newOrgId)
        updateUser({ org_id: newOrgId })
        setOrgId(newOrgId)

        await saveOrgWizardStep(newOrgId, 1, { orgName: data.orgName })
      } else {
        // Returning user editing org name — update orgs row
        const { error: updateError } = await supabase
          .from('orgs')
          .update({ name: data.orgName, updated_at: new Date().toISOString() })
          .eq('id', orgId)
        if (updateError) throw updateError

        await saveOrgWizardStep(orgId, 1, { orgName: data.orgName })
      }

      await refreshOrgSetup()
      setCurrentStep(2)
    } catch (err) {
      console.error('OrgSetupWizard: step 1 save error', err)
      setError(
        "We couldn't save your progress. Check your connection and try again."
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Step 2 save — role ─────────────────────────────────────────────────
  const handleStep2Save = async (data) => {
    setSaving(true)
    setError('')
    try {
      updateConfig(data)
      await saveOrgWizardStep(orgId, 2, {
        ...data,
        orgName: wizardConfig.orgName,
      })
      await refreshOrgSetup()
      setCurrentStep(3)
    } catch (err) {
      console.error('OrgSetupWizard: step 2 save error', err)
      setError(
        "We couldn't save your progress. Check your connection and try again."
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Step 3 save — care type ────────────────────────────────────────────
  const handleStep3Save = async (data) => {
    setSaving(true)
    setError('')
    try {
      updateConfig(data)
      await saveOrgWizardStep(orgId, 3, data)
      await refreshOrgSetup()
      setCurrentStep(4)
    } catch (err) {
      console.error('OrgSetupWizard: step 3 save error', err)
      setError(
        "We couldn't save your progress. Check your connection and try again."
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Step 4 save — structure ────────────────────────────────────────────
  const handleStep4Save = async (data) => {
    setSaving(true)
    setError('')
    try {
      updateConfig(data)
      await saveOrgWizardStep(orgId, 4, data)
      await refreshOrgSetup()
      setCurrentStep(5)
    } catch (err) {
      console.error('OrgSetupWizard: step 4 save error', err)
      setError(
        "We couldn't save your progress. Check your connection and try again."
      )
    } finally {
      setSaving(false)
    }
  }

  // ── Finish ─────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    setSaving(true)
    setError('')
    const merged = wizardConfig

    try {
      const { error: orgUpdateError } = await supabase
        .from('orgs')
        .update({
          name: merged.orgName,
          care_type: merged.careType,
          structure: merged.structure,
          org_creator_role_label: merged.orgCreatorRoleLabel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orgId)

      if (orgUpdateError) throw orgUpdateError

      await completeOrgWizard(orgId)

      let newHomeId = null
      if (merged.structure === 'single') {
        const homeRow = await createHomeForOrg({ name: merged.homeName, orgId })
        newHomeId = homeRow?.id

        if (merged.managerType === 'self' && newHomeId) {
          await linkUserToHome(user.id, newHomeId)
        }

        if (merged.managerType === 'other' && newHomeId) {
          await createInviteToken({
            homeId: newHomeId,
            role: 'manager',
            invitedById: user.id,
            invitedByName: user.name,
          })
        }
      }

      await refreshOrgSetup()
      setFinalConfig({ ...merged, homeId: newHomeId })
      setShowTransition(true)
    } catch (err) {
      console.error('OrgSetupWizard: finish error', err)
      setError(
        "We couldn't complete your setup. Check your connection and try again."
      )
    } finally {
      setSaving(false)
    }
  }

  const handleTransitionProceed = () => {
    if (finalConfig?.managerType === 'self') {
      navigate('/home-setup', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }

  // ── Transition screen ──────────────────────────────────────────────────
  if (showTransition && finalConfig) {
    return (
      <div className={styles.page}>
        <TopBar theme={theme} toggleTheme={toggleTheme} onLogout={logout} />
        <TransitionScreen
          config={finalConfig}
          onProceed={handleTransitionProceed}
        />
      </div>
    )
  }

  // ── Greeting screen ────────────────────────────────────────────────────
  if (currentStep === null) {
    return (
      <div className={styles.page}>
        <TopBar theme={theme} toggleTheme={toggleTheme} onLogout={logout} />
        <OrgGreetingScreen
          userName={user?.name}
          onBegin={handleGreetingComplete}
        />
      </div>
    )
  }

  // ── Wizard body ────────────────────────────────────────────────────────
  const completedPercent = Math.round(
    (Math.max(orgWizardStep, currentStep - 1) / 5) * 100
  )

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
                  {wizardConfig.orgName || savedOrgName || 'Your organisation'}
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
              <div className={styles.homeBlock}>
                <div className={styles.homeEyebrow}>Setting up</div>
                <div className={styles.homeName}>
                  {wizardConfig.orgName || savedOrgName || 'Your organisation'}
                </div>
              </div>

              <div className={styles.stepGroups}>
                {STEPS.map((step) => {
                  const highestSaved = Math.max(orgWizardStep, currentStep - 1)
                  const isCompleted = highestSaved >= step.number
                  const isActive = currentStep === step.number
                  const isAccessible = step.number <= highestSaved + 1

                  return (
                    <button
                      key={step.number}
                      className={`${styles.stepItem} ${isActive ? styles.stepItemActive : ''} ${isCompleted && !isActive ? styles.stepItemDone : ''}`}
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
                        <div className={styles.stepItemLabel}>{step.label}</div>
                        <div className={styles.stepItemDesc}>{step.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

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
                <Step1OrgName
                  key={1}
                  initial={wizardConfig}
                  userId={user?.id}
                  existingOrgId={orgId}
                  onSave={handleStep1Save}
                  saving={saving}
                />
              )}
              {currentStep === 2 && (
                <Step2Role
                  key={2}
                  initial={wizardConfig}
                  onSave={handleStep2Save}
                  onBack={() => setCurrentStep(1)}
                  saving={saving}
                />
              )}
              {currentStep === 3 && (
                <Step3CareType
                  key={3}
                  initial={wizardConfig}
                  onSave={handleStep3Save}
                  onBack={() => setCurrentStep(2)}
                  saving={saving}
                />
              )}
              {currentStep === 4 && (
                <Step4Structure
                  key={4}
                  initial={wizardConfig}
                  orgName={wizardConfig.orgName || savedOrgName}
                  onSave={handleStep4Save}
                  onBack={() => setCurrentStep(3)}
                  saving={saving}
                />
              )}
              {currentStep === 5 && (
                <Step5Review
                  key={5}
                  config={wizardConfig}
                  onEdit={(step) => setCurrentStep(step)}
                  onBack={() => setCurrentStep(4)}
                  onFinish={handleFinish}
                  saving={saving}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrgSetupWizard
