import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../../context/AuthContext'
import {
  createInviteToken,
  MANAGER_INVITE_ROLES,
  OL_INVITE_ROLES,
  ROLE_LABELS,
} from '../../utils/inviteTokens'
import { mockHomes } from '../../data/mockHomes'

function InviteModal({ onClose, defaultHomeId }) {
  const { user } = useAuth()

  const isOLorAdmin = ['operationallead', 'superadmin'].includes(
    user?.activeRole
  )
  const availableRoles = isOLorAdmin ? OL_INVITE_ROLES : MANAGER_INVITE_ROLES

  // Managers only see their own home
  const availableHomes = isOLorAdmin
    ? mockHomes
    : mockHomes.filter((h) => h.id === user?.home)

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
      : mockHomes.find((h) => h.id === selectedHome)?.name || 'your home'
    const subject = encodeURIComponent(`You're invited to join Rotapp`)
    const body = encodeURIComponent(
      `Hi,\n\nYou've been invited to join Rotapp as a ${ROLE_LABELS[selectedRole]} at ${homeName}.\n\nClick the link below to set up your account:\n${generatedLink}\n\nThis link expires in 7 days and can only be used once.\n\nIf you have any questions, please contact your manager.\n\nRegards,\n${user.name}`
    )
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.title}>Onboard staff</div>
          <button style={s.closeBtn} onClick={onClose}>
            <FontAwesomeIcon icon='xmark' />
          </button>
        </div>

        {/* Body */}
        <div style={s.body}>
          {/* Role selector */}
          <div style={s.field}>
            <label style={s.label}>Role</label>
            <select
              style={s.input}
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
            <div style={s.field}>
              <label style={s.label}>Home</label>
              <select
                style={s.input}
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
                  // Manager sees only their home, no choice needed
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
                <span style={s.homeHint}>
                  Staff will be onboarded to your home
                </span>
              )}
            </div>
          )}

          {/* Relief notice */}
          {isRelief && (
            <div style={s.notice}>
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

          {error && <div style={s.error}>{error}</div>}

          {/* Generate button */}
          {!generatedLink && (
            <button
              style={s.primaryBtn}
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? 'Generating…' : 'Generate onboarding link'}
            </button>
          )}

          {/* Generated link block */}
          {generatedLink && (
            <div style={s.linkBlock}>
              <div style={s.linkLabel}>
                Onboarding link — expires in 7 days, one use only
              </div>
              <div style={s.linkRow}>
                <div style={s.linkText}>{generatedLink}</div>
              </div>

              {/* Copy feedback */}
              {copied && (
                <div style={s.copiedMsg}>
                  <FontAwesomeIcon icon='check' /> Link copied to clipboard
                </div>
              )}

              <div style={s.linkActions}>
                <button style={s.actionBtn} onClick={handleCopy}>
                  <FontAwesomeIcon icon='copy' />{' '}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                <button style={s.actionBtn} onClick={handleEmail}>
                  <FontAwesomeIcon icon='envelope' /> Send email
                </button>
              </div>
              <button
                style={s.ghostBtn}
                onClick={() => {
                  setGeneratedLink('')
                  setError('')
                  setCopied(false)
                }}
              >
                ← Generate another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '24px',
    backdropFilter: 'blur(2px)',
  },
  modal: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '440px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border-default)',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: 'Syne, sans-serif',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
  },
  body: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
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
  homeHint: {
    fontSize: '11.5px',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
  },
  notice: {
    background: 'rgba(108,143,255,0.08)',
    border: '1px solid rgba(108,143,255,0.2)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '12.5px',
    color: 'var(--text-secondary)',
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
    lineHeight: 1.5,
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
  },
  linkBlock: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-default)',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  linkLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  linkRow: {
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid var(--border-default)',
    borderRadius: '6px',
    padding: '8px 10px',
  },
  linkText: {
    fontSize: '11px',
    color: 'var(--accent)',
    fontFamily: 'DM Mono, monospace',
    wordBreak: 'break-all',
    lineHeight: 1.5,
  },
  copiedMsg: {
    fontSize: '12px',
    color: '#2ecc8a',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  linkActions: { display: 'flex', gap: '8px' },
  actionBtn: {
    flex: 1,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    padding: '8px 12px',
    fontSize: '12.5px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'background 0.15s',
  },
  ghostBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '12.5px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    padding: 0,
    textAlign: 'left',
  },
}

export default InviteModal
