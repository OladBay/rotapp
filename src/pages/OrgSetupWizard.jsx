// src/pages/OrgSetupWizard.jsx
import { useState, useEffect } from 'react'
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
  initOrgSetup,
} from '../utils/orgSetup'
import { createInviteToken } from '../utils/inviteTokens'
import { supabase } from '../lib/supabase'
import styles from './OrgSetupWizard.module.css'

// ── Step definitions ───────────────────────────────────────────────────────
const STEPS = [
  { number: 1, label: 'Your organisation', desc: 'Name and your role' },
  { number: 2, label: 'Care type', desc: 'Regulatory framework' },
  { number: 3, label: 'Org structure', desc: 'How many homes?' },
  { number: 4, label: 'Review & finish', desc: 'Confirm your setup' },
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

// ── Shared step header ─────────────────────────────────────────────────────
function StepHeader({ stepNumber, title, subtitle }) {
  return (
    <div className={styles.stepHeaderBlock}>
      <div className={styles.breadcrumb}>
        <span>Step {stepNumber} of 4</span>
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

// ── Step 1 — About your organisation ──────────────────────────────────────
const ORG_ROLES = [
  { value: 'operationallead', label: 'Operational Lead' },
  { value: 'manager', label: 'Manager' },
  { value: 'it_admin', label: 'IT / System Administrator' },
  { value: 'owner', label: 'Owner' },
  { value: 'other', label: 'Other' },
]

function Step1About({ initial, onSave, saving }) {
  const [orgName, setOrgName] = useState(initial?.orgName || '')
  const [roleLabel, setRoleLabel] = useState(initial?.orgCreatorRoleLabel || '')
  const [otherRole, setOtherRole] = useState(initial?.otherRole || '')
  const [touched, setTouched] = useState(false)
  const [errors, setErrors] = useState({})

  const handleSubmit = () => {
    setTouched(true)
    const errs = {}
    if (!orgName.trim()) errs.orgName = 'Enter your organisation name'
    if (!roleLabel) errs.roleLabel = 'Select your role'
    if (roleLabel === 'other' && !otherRole.trim())
      errs.otherRole = 'Enter your role'
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    onSave({
      orgName: orgName.trim(),
      orgCreatorRoleLabel:
        roleLabel === 'other'
          ? otherRole.trim()
          : ORG_ROLES.find((r) => r.value === roleLabel)?.label || roleLabel,
    })
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={1}
        title='Tell us about your organisation'
        subtitle='This helps us personalise your experience. Your access level is the same regardless of the role you select.'
      />

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Organisation name</label>
        <input
          className={`${styles.textInput} ${errors.orgName ? styles.inputError : ''}`}
          type='text'
          placeholder='e.g. Coventry City Council'
          value={orgName}
          onChange={(e) => {
            setOrgName(e.target.value)
            setErrors((prev) => ({ ...prev, orgName: null }))
          }}
        />
        {errors.orgName && (
          <span className={styles.inlineError}>{errors.orgName}</span>
        )}
      </div>

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
        onNext={handleSubmit}
        saving={saving}
        hint={orgName.trim() ? orgName.trim() : 'Enter your organisation name'}
      />
    </div>
  )
}

// ── Step 2 — Care type ─────────────────────────────────────────────────────
const CARE_TYPES = [
  {
    value: 'childrens',
    label: "Children's residential care",
    desc: 'Regulated by Ofsted',
  },
  {
    value: 'adult',
    label: 'Adult care',
    desc: 'Regulated by CQC',
  },
  {
    value: 'both',
    label: 'Both',
    desc: 'Regulated by Ofsted and CQC',
  },
]

function Step2CareType({ initial, onSave, onBack, saving }) {
  const [selected, setSelected] = useState(initial?.careType || '')
  const [touched, setTouched] = useState(false)

  const handleSubmit = () => {
    setTouched(true)
    if (!selected) return
    onSave({ careType: selected })
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={2}
        title='What type of care does your organisation provide?'
        subtitle='This determines which compliance framework applies to your homes and rota rules.'
      />

      <div className={styles.optionList}>
        {CARE_TYPES.map((type) => (
          <button
            key={type.value}
            className={`${styles.optionCard} ${selected === type.value ? styles.optionSelected : ''}`}
            onClick={() => setSelected(type.value)}
          >
            <div className={styles.optionRadio}>
              <div className={styles.optionRadioDot} />
            </div>
            <div>
              <div className={styles.optionTitle}>{type.label}</div>
              <div className={styles.optionDesc}>{type.desc}</div>
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
        hint={
          selected
            ? CARE_TYPES.find((t) => t.value === selected)?.label
            : 'Choose an option above'
        }
      />
    </div>
  )
}

// ── Step 3 — Org structure ─────────────────────────────────────────────────
function Step3Structure({ initial, orgName, onSave, onBack, saving }) {
  const [structure, setStructure] = useState(initial?.structure || '')
  const [homeName, setHomeName] = useState(initial?.homeName || '')
  const [sameAsOrg, setSameAsOrg] = useState(initial?.sameAsOrg || false)
  const [managerType, setManagerType] = useState(initial?.managerType || '')
  const [inviteName, setInviteName] = useState(initial?.inviteName || '')
  const [inviteEmail, setInviteEmail] = useState(initial?.inviteEmail || '')
  const [touched, setTouched] = useState(false)
  const [errors, setErrors] = useState({})

  // Auto-fill home name when checkbox ticked
  useEffect(() => {
    if (sameAsOrg) {
      setHomeName(orgName || '')
    }
  }, [sameAsOrg, orgName])

  const handleSubmit = () => {
    setTouched(true)
    const errs = {}

    if (!structure) {
      errs.structure = 'Please select an option to continue'
    }

    if (structure === 'single') {
      if (!homeName.trim()) errs.homeName = 'Enter your home name'
      if (!managerType) errs.managerType = 'Please select an option'
      if (managerType === 'other') {
        if (!inviteName.trim()) errs.inviteName = "Enter the manager's name"
        if (!inviteEmail.trim()) errs.inviteEmail = "Enter the manager's email"
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail))
          errs.inviteEmail = 'Enter a valid email address'
      }
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    onSave({
      structure,
      homeName: structure === 'single' ? homeName.trim() : '',
      sameAsOrg: structure === 'single' ? sameAsOrg : false,
      managerType: structure === 'single' ? managerType : '',
      inviteName: managerType === 'other' ? inviteName.trim() : '',
      inviteEmail: managerType === 'other' ? inviteEmail.trim() : '',
    })
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={3}
        title='How many care homes does your organisation operate?'
        subtitle='This shapes how your dashboard and onboarding works. You can always add more homes later.'
      />

      <div className={styles.optionList}>
        <button
          className={`${styles.optionCard} ${structure === 'single' ? styles.optionSelected : ''}`}
          onClick={() => {
            setStructure('single')
            setErrors((prev) => ({ ...prev, structure: null }))
          }}
        >
          <div className={styles.optionRadio}>
            <div className={styles.optionRadioDot} />
          </div>
          <div>
            <div className={styles.optionTitle}>Just one home</div>
            <div className={styles.optionDesc}>
              I manage one care home
              <span className={styles.optionHint}>
                You can always add more homes later as your organisation grows
              </span>
            </div>
          </div>
        </button>

        <button
          className={`${styles.optionCard} ${structure === 'multi' ? styles.optionSelected : ''}`}
          onClick={() => {
            setStructure('multi')
            setErrors((prev) => ({ ...prev, structure: null }))
          }}
        >
          <div className={styles.optionRadio}>
            <div className={styles.optionRadioDot} />
          </div>
          <div>
            <div className={styles.optionTitle}>More than one home</div>
            <div className={styles.optionDesc}>
              I oversee multiple care homes
              <span className={styles.optionHint}>
                You'll be able to add and set up your homes from your dashboard
                once your account is ready
              </span>
            </div>
          </div>
        </button>
      </div>

      {touched && errors.structure && (
        <p className={styles.fieldError}>{errors.structure}</p>
      )}

      {/* ── Single home details — only when single selected ── */}
      {structure === 'single' && (
        <div className={styles.homeDetailsBlock}>
          <div className={styles.homeDetailsTitle}>Home details</div>

          {/* Home name */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>
              What is your home called?
            </label>
            <input
              className={`${styles.textInput} ${errors.homeName ? styles.inputError : ''}`}
              type='text'
              placeholder='e.g. Meadowview'
              value={homeName}
              disabled={sameAsOrg}
              onChange={(e) => {
                setHomeName(e.target.value)
                setErrors((prev) => ({ ...prev, homeName: null }))
              }}
            />
            {errors.homeName && (
              <span className={styles.inlineError}>{errors.homeName}</span>
            )}

            {/* Same as org checkbox */}
            <button
              type='button'
              className={`${styles.checkRow} ${sameAsOrg ? styles.checkRowActive : ''}`}
              onClick={() => {
                setSameAsOrg((v) => !v)
                if (!sameAsOrg)
                  setErrors((prev) => ({ ...prev, homeName: null }))
              }}
            >
              <div
                className={`${styles.checkbox} ${sameAsOrg ? styles.checkboxChecked : ''}`}
              >
                {sameAsOrg && <FontAwesomeIcon icon='check' />}
              </div>
              <span className={styles.checkLabel}>
                Home name is the same as organisation name
              </span>
            </button>
          </div>

          {/* Who manages this home */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Who manages this home?</label>
            <div className={styles.optionList}>
              <button
                className={`${styles.optionCard} ${managerType === 'self' ? styles.optionSelected : ''}`}
                onClick={() => {
                  setManagerType('self')
                  setErrors((prev) => ({ ...prev, managerType: null }))
                }}
              >
                <div className={styles.optionRadio}>
                  <div className={styles.optionRadioDot} />
                </div>
                <div className={styles.optionTitle}>I am the manager</div>
              </button>

              <button
                className={`${styles.optionCard} ${managerType === 'other' ? styles.optionSelected : ''}`}
                onClick={() => {
                  setManagerType('other')
                  setErrors((prev) => ({ ...prev, managerType: null }))
                }}
              >
                <div className={styles.optionRadio}>
                  <div className={styles.optionRadioDot} />
                </div>
                <div className={styles.optionTitle}>
                  Another manager manages this home
                </div>
              </button>
            </div>
            {touched && errors.managerType && (
              <span className={styles.inlineError}>{errors.managerType}</span>
            )}
          </div>

          {/* Invite form — only when other manager selected */}
          {managerType === 'other' && (
            <div className={styles.inviteBlock}>
              <div className={styles.inviteTitle}>Invite your manager</div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Manager's full name</label>
                <input
                  className={`${styles.textInput} ${errors.inviteName ? styles.inputError : ''}`}
                  type='text'
                  placeholder='Full name'
                  value={inviteName}
                  onChange={(e) => {
                    setInviteName(e.target.value)
                    setErrors((prev) => ({ ...prev, inviteName: null }))
                  }}
                />
                {errors.inviteName && (
                  <span className={styles.inlineError}>
                    {errors.inviteName}
                  </span>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Manager's email address
                </label>
                <input
                  className={`${styles.textInput} ${errors.inviteEmail ? styles.inputError : ''}`}
                  type='email'
                  placeholder='manager@example.com'
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value)
                    setErrors((prev) => ({ ...prev, inviteEmail: null }))
                  }}
                />
                {errors.inviteEmail && (
                  <span className={styles.inlineError}>
                    {errors.inviteEmail}
                  </span>
                )}
              </div>

              <div className={styles.infoNote}>
                <FontAwesomeIcon
                  icon='circle-info'
                  className={styles.infoNoteIcon}
                />
                <span>
                  We'll send them an invite link. They'll be guided through the
                  home setup when they sign up. You can also step in and
                  complete the setup yourself from your dashboard at any time.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <StepFooter
        onBack={onBack}
        onNext={handleSubmit}
        saving={saving}
        hint={
          !structure
            ? 'Choose an option above'
            : structure === 'multi'
              ? 'Multi-home organisation'
              : homeName
                ? homeName
                : 'Enter your home name'
        }
      />
    </div>
  )
}

// ── Step 4 — Review ────────────────────────────────────────────────────────
function Step4Review({ config, onEdit, onBack, onFinish, saving }) {
  const careTypeLabel = {
    childrens: "Children's residential care",
    adult: 'Adult care',
    both: 'Both',
  }

  const structureLabel = {
    single: 'Just one home',
    multi: 'More than one home',
  }

  return (
    <div className={styles.step}>
      <StepHeader
        stepNumber={4}
        title='Review your organisation setup'
        subtitle='Everything looks good. Review your choices and click Finish to complete your setup.'
      />

      <div className={styles.infoNote}>
        <FontAwesomeIcon icon='circle-info' className={styles.infoNoteIcon} />
        <span>
          Click <strong>Edit</strong> on any row to jump directly to that step.
        </span>
      </div>

      <div className={styles.reviewSections}>
        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHeader}>
            <span className={styles.reviewSectionTitle}>Organisation</span>
          </div>
          <div className={styles.reviewRows}>
            <ReviewRow
              label='Organisation'
              value={config.orgName || '—'}
              onEdit={() => onEdit(1)}
            />
            <ReviewRow
              label='Your role'
              value={config.orgCreatorRoleLabel || '—'}
              onEdit={() => onEdit(1)}
            />
            <ReviewRow
              label='Care type'
              value={careTypeLabel[config.careType] || '—'}
              onEdit={() => onEdit(2)}
            />
            <ReviewRow
              label='Structure'
              value={structureLabel[config.structure] || '—'}
              onEdit={() => onEdit(3)}
            />
            {config.structure === 'single' && (
              <>
                <ReviewRow
                  label='Home name'
                  value={config.homeName || '—'}
                  onEdit={() => onEdit(3)}
                />
                <ReviewRow
                  label='Home manager'
                  value={
                    config.managerType === 'self'
                      ? 'You'
                      : config.inviteName
                        ? `${config.inviteName} (invite pending)`
                        : '—'
                  }
                  onEdit={() => onEdit(3)}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={onFinish}
        saving={saving}
        nextLabel='Finish'
        hint={config.orgName || ''}
      />
    </div>
  )
}

// ── Review row ─────────────────────────────────────────────────────────────
function ReviewRow({ label, value, onEdit }) {
  return (
    <div className={styles.reviewRow}>
      <span className={styles.reviewRowLabel}>{label}</span>
      <div className={styles.reviewRowRight}>
        <span className={styles.reviewRowValue}>{value}</span>
        {onEdit && (
          <button className={styles.reviewEditBtn} onClick={onEdit}>
            <FontAwesomeIcon icon='pen-to-square' />
            Edit
          </button>
        )}
      </div>
    </div>
  )
}

// ── Transition screen ──────────────────────────────────────────────────────
function TransitionScreen({ config, onProceed }) {
  const isManager = config.managerType === 'self'

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

        {isManager ? (
          <>
            <div className={styles.transitionDivider} />
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
        ) : (
          <>
            <div className={styles.transitionDivider} />
            <div className={styles.transitionInviteRow}>
              <FontAwesomeIcon
                icon='envelope'
                className={styles.transitionEnvIcon}
              />
              <p className={styles.transitionDesc}>
                We've sent an invite to <strong>{config.inviteEmail}</strong>.
                Once they sign up, they'll be guided through the home setup
                automatically. You can also step in and complete the setup
                yourself from your dashboard at any time.
              </p>
            </div>
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
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { orgSetupLoading, refreshOrgSetup } = useOrgSetup()
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showTransition, setShowTransition] = useState(false)
  const [finalConfig, setFinalConfig] = useState(null)
  const [orgId, setOrgId] = useState(user?.org_id || null)

  // Wizard config — accumulated across steps
  const [wizardConfig, setWizardConfig] = useState({
    orgName: '',
    orgCreatorRoleLabel: '',
    careType: '',
    structure: '',
    homeName: '',
    sameAsOrg: false,
    managerType: '',
    inviteName: '',
    inviteEmail: '',
  })

  if (orgSetupLoading) return null

  const updateConfig = (updates) => {
    setWizardConfig((prev) => ({ ...prev, ...updates }))
  }

  const handleStep1Save = async (data) => {
    setSaving(true)
    setError('')
    try {
      updateConfig(data)

      let currentOrgId = orgId

      // Create org row on first save if it doesn't exist yet
      if (!currentOrgId) {
        const { data: org, error: orgError } = await supabase
          .from('orgs')
          .insert({
            name: data.orgName,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (orgError) throw orgError

        // Link user to org
        await linkUserToOrg(user.id, org.id)

        // Init org_setup row
        await initOrgSetup(org.id)

        currentOrgId = org.id
        setOrgId(org.id)
      }

      await saveOrgWizardStep(currentOrgId, 1, data)
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

  const handleStep2Save = async (data) => {
    setSaving(true)
    setError('')
    try {
      updateConfig(data)
      await saveOrgWizardStep(orgId, 2, data)
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

  const handleFinish = async () => {
    setSaving(true)
    setError('')
    const merged = wizardConfig

    try {
      // 1. Update org row with full data
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

      // 2. Complete org wizard
      await completeOrgWizard(orgId)

      // 3. If single home — create home row
      let newHomeId = null
      if (merged.structure === 'single') {
        const homeRow = await createHomeForOrg({
          name: merged.homeName,
          orgId: orgId,
        })
        newHomeId = homeRow?.id

        // 4a. Creator is manager — link to home
        if (merged.managerType === 'self' && newHomeId) {
          await linkUserToHome(user.id, newHomeId)
        }

        // 4b. Another manager — create invite token
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

  // ── Transition screen ──
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

  const completedPercent = Math.round(((currentStep - 1) / 4) * 100)

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
                  {wizardConfig.orgName || 'Your organisation'}
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
                  {wizardConfig.orgName || 'Your organisation'}
                </div>
              </div>

              <div className={styles.stepGroups}>
                {STEPS.map((step) => {
                  const isCompleted = currentStep > step.number
                  const isActive = currentStep === step.number
                  const isAccessible = step.number <= currentStep

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
                <Step1About
                  key={1}
                  initial={wizardConfig}
                  onSave={handleStep1Save}
                  saving={saving}
                />
              )}
              {currentStep === 2 && (
                <Step2CareType
                  key={2}
                  initial={wizardConfig}
                  onSave={handleStep2Save}
                  onBack={() => setCurrentStep(1)}
                  saving={saving}
                />
              )}
              {currentStep === 3 && (
                <Step3Structure
                  key={3}
                  initial={wizardConfig}
                  orgName={wizardConfig.orgName}
                  onSave={handleStep3Save}
                  onBack={() => setCurrentStep(2)}
                  saving={saving}
                />
              )}
              {currentStep === 4 && (
                <Step4Review
                  key={4}
                  config={wizardConfig}
                  onEdit={(step) => setCurrentStep(step)}
                  onBack={() => setCurrentStep(3)}
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
