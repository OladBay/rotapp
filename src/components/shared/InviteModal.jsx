// src/components/shared/InviteModal.jsx
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../../context/AuthContext'
import {
  createInviteToken,
  MANAGER_INVITE_ROLES,
  OL_INVITE_ROLES,
  ROLE_LABELS,
} from '../../utils/inviteTokens'
import { sendInviteEmail } from '../../utils/sendEmail'
import styles from './InviteModal.module.css'

function InviteModal({ onClose, defaultHomeId, homes = [] }) {
  const { user } = useAuth()

  const isOLorAdmin = ['operationallead', 'superadmin'].includes(
    user?.activeRole
  )
  const availableRoles = isOLorAdmin ? OL_INVITE_ROLES : MANAGER_INVITE_ROLES

  const [selectedRole, setSelectedRole] = useState(availableRoles[0])

  const [selectedHome, setSelectedHome] = useState(
    isOLorAdmin
      ? defaultHomeId || (homes.length === 1 ? homes[0].id : '')
      : user?.home || ''
  )
  const [invitedEmail, setInvitedEmail] = useState('')
  const [contractType, setContractType] = useState('full-time')
  const [contractedHours, setContractedHours] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const isRelief = selectedRole === 'relief'
  const isZeroHours = contractType === 'zero-hours'

  const selectedHomeName =
    homes.find((h) => h.id === selectedHome)?.name || 'your care home'

  const availableHomes = isOLorAdmin
    ? homes
    : homes.filter((h) => h.id === user?.home)

  const handleSend = async () => {
    setError('')

    if (!invitedEmail.trim()) {
      setError("Please enter the staff member's email address")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(invitedEmail.trim())) {
      setError('Please enter a valid email address')
      return
    }

    if (!isRelief && !selectedHome) {
      setError('Please select a home')
      return
    }

    if (!contractType) {
      setError('Please select a contract type')
      return
    }

    if (
      !isZeroHours &&
      (!contractedHours ||
        isNaN(contractedHours) ||
        Number(contractedHours) <= 0)
    ) {
      setError('Please enter a valid number of contracted hours')
      return
    }

    setLoading(true)
    try {
      const token = await createInviteToken({
        homeId: isRelief ? null : selectedHome,
        orgId: user.org_id,
        role: selectedRole,
        invitedById: user.id,
        invitedByName: user.name,
        invitedEmail: invitedEmail.trim().toLowerCase(),
        contractType,
        contractedHours: isZeroHours ? null : Number(contractedHours),
      })

      const inviteUrl = `${window.location.origin}/invite?token=${token}`

      await sendInviteEmail({
        toEmail: invitedEmail.trim().toLowerCase(),
        roleName: ROLE_LABELS[selectedRole],
        homeName: isRelief ? null : selectedHomeName,
        inviteUrl,
      })

      setSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send invite. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Sent confirmation screen ───────────────────────────────
  if (sent) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.sentWrap}>
            <div className={styles.sentIcon}>
              <FontAwesomeIcon icon='circle-check' />
            </div>
            <h2 className={styles.sentTitle}>Invite sent</h2>
            <p className={styles.sentBody}>
              An invite has been sent to{' '}
              <strong>{invitedEmail.trim().toLowerCase()}</strong>. They'll
              receive an email with a link to create their account. The link
              expires in 7 days.
            </p>
            <button className={styles.doneBtn} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main modal ─────────────────────────────────────────────
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Invite staff member</div>
            <div className={styles.subtitle}>
              They'll receive an email to create their account
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <FontAwesomeIcon icon='xmark' />
          </button>
        </div>

        <div className={styles.body}>
          {/* Email */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Staff email address</label>
            <input
              className={styles.textInput}
              type='email'
              placeholder='e.g. jane.smith@email.com'
              value={invitedEmail}
              onChange={(e) => setInvitedEmail(e.target.value)}
              autoComplete='off'
            />
          </div>

          {/* Role */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Role</label>
            <div className={styles.roleGrid}>
              {availableRoles.map((role) => (
                <button
                  key={role}
                  className={`${styles.roleChip} ${selectedRole === role ? styles.roleChipActive : ''}`}
                  onClick={() => setSelectedRole(role)}
                  type='button'
                >
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>
          </div>

          {/* Home selector — hidden for relief */}
          {!isRelief && (
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Home</label>
              {availableHomes.length === 1 ? (
                <div className={styles.homeReadOnly}>
                  <FontAwesomeIcon icon='house' className={styles.homeIcon} />
                  {availableHomes[0].name}
                </div>
              ) : (
                <select
                  className={styles.select}
                  value={selectedHome}
                  onChange={(e) => setSelectedHome(e.target.value)}
                >
                  <option value=''>Select a home</option>
                  {availableHomes.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Relief notice */}
          {isRelief && (
            <div className={styles.reliefNotice}>
              <FontAwesomeIcon icon='circle-info' />
              Relief staff are org-wide and can be assigned to any home.
            </div>
          )}

          {/* Contract type */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Contract type</label>
            <div className={styles.contractGrid}>
              {['full-time', 'part-time', 'zero-hours'].map((type) => (
                <button
                  key={type}
                  className={`${styles.contractChip} ${contractType === type ? styles.contractChipActive : ''}`}
                  onClick={() => setContractType(type)}
                  type='button'
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Contracted hours — hidden for zero-hours */}
          {!isZeroHours && (
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Contracted hours per week
              </label>
              <div className={styles.hoursInputWrap}>
                <input
                  className={styles.hoursInput}
                  type='number'
                  min='1'
                  max='48'
                  placeholder='e.g. 37.5'
                  value={contractedHours}
                  onChange={(e) => setContractedHours(e.target.value)}
                />
                <span className={styles.hoursSuffix}>hrs / week</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className={styles.errorBanner}>
              <FontAwesomeIcon icon='triangle-exclamation' />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={loading}
          >
            {loading ? (
              <>
                <FontAwesomeIcon icon='spinner' spin />
                Sending…
              </>
            ) : (
              <>
                <FontAwesomeIcon icon='paper-plane' />
                Send invite
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default InviteModal
