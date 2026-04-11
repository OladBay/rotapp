import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../../context/AuthContext'
import {
  createInviteToken,
  MANAGER_INVITE_ROLES,
  OL_INVITE_ROLES,
  ROLE_LABELS,
} from '../../utils/inviteTokens'
import styles from './InviteModal.module.css'

function InviteModal({ onClose, defaultHomeId, homes = [] }) {
  const { user } = useAuth()

  const isOLorAdmin = ['operationallead', 'superadmin'].includes(
    user?.activeRole
  )
  const availableRoles = isOLorAdmin ? OL_INVITE_ROLES : MANAGER_INVITE_ROLES

  const availableHomes = isOLorAdmin
    ? homes
    : homes.filter((h) => h.id === user?.home)

  const [selectedRole, setSelectedRole] = useState(availableRoles[0])
  const [selectedHome, setSelectedHome] = useState(
    isOLorAdmin ? defaultHomeId || '' : user?.home || ''
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)

  const isRelief = selectedRole === 'relief'

  const handleGenerate = async () => {
    setError('')
    if (!isRelief && !selectedHome) {
      setError('Please select a home')
      return
    }
    setLoading(true)
    try {
      const token = await createInviteToken({
        homeId: isRelief ? null : selectedHome,
        role: selectedRole,
        invitedById: user.id,
        invitedByName: user.name,
      })
      const link = `${window.location.origin}/invite/${token}`
      setGeneratedLink(link)
    } catch (err) {
      setError(err.message || 'Failed to generate onboarding link')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleEmail = () => {
    const homeName = isRelief
      ? 'our organisation'
      : homes.find((h) => h.id === selectedHome)?.name || 'your home'
    const subject = encodeURIComponent(`You're invited to join Rotapp`)
    const body = encodeURIComponent(
      `Hi,\n\nYou've been invited to join Rotapp as a ${ROLE_LABELS[selectedRole]} at ${homeName}.\n\nClick the link below to set up your account:\n${generatedLink}\n\nThis link expires in 7 days and can only be used once.\n\nIf you have any questions, please contact your manager.\n\nRegards,\n${user.name}`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.title}>Onboard staff</div>
          <button className={styles.closeBtn} onClick={onClose}>
            <FontAwesomeIcon icon='xmark' />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Role selector */}
          <div className={styles.field}>
            <label className={styles.label}>Role</label>
            <select
              className={styles.input}
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value)
                setGeneratedLink('')
                setError('')
                setCopied(false)
              }}
            >
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          {/* Home selector — hidden for relief */}
          {!isRelief && (
            <div className={styles.field}>
              <label className={styles.label}>Home</label>
              <select
                className={styles.input}
                value={selectedHome}
                onChange={(e) => {
                  setSelectedHome(e.target.value)
                  setGeneratedLink('')
                  setError('')
                  setCopied(false)
                }}
                disabled={!isOLorAdmin}
              >
                {!isOLorAdmin ? (
                  availableHomes.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value=''>Select a home</option>
                    {availableHomes.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {!isOLorAdmin && (
                <span className={styles.homeHint}>
                  Staff will be onboarded to your home
                </span>
              )}
            </div>
          )}

          {/* Relief notice */}
          {isRelief && (
            <div className={styles.notice}>
              <FontAwesomeIcon
                icon='circle-info'
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <span>
                Relief staff are not assigned to a specific home. They will be
                visible in the relief pool across all homes once approved.
              </span>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          {/* Generate button */}
          {!generatedLink && (
            <button
              className={styles.primaryBtn}
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? 'Generating…' : 'Generate onboarding link'}
            </button>
          )}

          {/* Generated link block */}
          {generatedLink && (
            <div className={styles.linkBlock}>
              <div className={styles.linkLabel}>
                Onboarding link — expires in 7 days, one use only
              </div>
              <div className={styles.linkRow}>
                <div className={styles.linkText}>{generatedLink}</div>
              </div>

              {copied && (
                <div className={styles.copiedMsg}>
                  <FontAwesomeIcon icon='check' /> Link copied to clipboard
                </div>
              )}

              <div className={styles.linkActions}>
                <button className={styles.actionBtn} onClick={handleCopy}>
                  <FontAwesomeIcon icon='copy' />{' '}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                <button className={styles.actionBtn} onClick={handleEmail}>
                  <FontAwesomeIcon icon='envelope' /> Send email
                </button>
              </div>

              <button
                className={styles.ghostBtn}
                onClick={() => {
                  setGeneratedLink('')
                  setError('')
                  setCopied(false)
                }}
              >
                <FontAwesomeIcon icon='chevron-left' /> Generate another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InviteModal
