// src/pages/Account.jsx
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getAvatarUrl, uploadAvatar, removeAvatar } from '../utils/avatarUtils'
import { useTopBarInit } from '../hooks/useTopBarInit'
import styles from './Account.module.css'

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  operationallead: 'Operational Lead',
  manager: 'Manager',
  deputy: 'Deputy Manager',
  senior: 'Senior Carer',
  rcw: 'Care Worker',
  relief: 'Relief Staff',
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Account() {
  const { user } = useAuth()
  const fileInputRef = useRef(null)
  const [avatarUrl, setAvatarUrl] = useState(getAvatarUrl(user))
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const roleLabel = ROLE_LABELS[user?.activeRole] || user?.activeRole
  const initials = getInitials(user?.name)

  useEffect(() => {
    setAvatarUrl(getAvatarUrl(user))
  }, [user?.avatar_url])

  useTopBarInit('Account', 'Your profile and employment details')

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const url = await uploadAvatar(user.id, file)
      setAvatarUrl(`${url}&t=${Date.now()}`)
      window.location.reload()
    } catch (err) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemove = async () => {
    setError('')
    setUploading(true)
    try {
      await removeAvatar(user.id, user.avatar_url)
      window.location.reload()
    } catch (err) {
      setError(err.message || 'Failed to remove photo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        {/* ── Identity card ── */}
        <div className={styles.identityCard}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatarRing}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.name || 'Avatar'}
                  className={styles.avatarImg}
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              ) : (
                <span className={styles.avatarInitials}>{initials}</span>
              )}
              {uploading && (
                <div className={styles.avatarOverlay}>
                  <FontAwesomeIcon icon='spinner' spin />
                </div>
              )}
            </div>
            <div className={styles.avatarActions}>
              <button
                className={styles.avatarEditBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <FontAwesomeIcon icon='pen-to-square' />
                {user?.avatar_url ? 'Change' : 'Upload'}
              </button>
              {user?.avatar_url && (
                <button
                  className={styles.avatarRemoveBtn}
                  onClick={handleRemove}
                  disabled={uploading}
                >
                  <FontAwesomeIcon icon='trash' />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/jpeg,image/png,image/webp'
              onChange={handleUpload}
              className={styles.fileInput}
            />
          </div>

          <div className={styles.identityInfo}>
            <div className={styles.identityName}>{user?.name || '—'}</div>
            <div className={styles.identityRole}>{roleLabel}</div>
            <div className={styles.identityEmail}>{user?.email || '—'}</div>
            {error && (
              <div className={styles.avatarError}>
                <FontAwesomeIcon icon='triangle-exclamation' /> {error}
              </div>
            )}
          </div>
        </div>

        {/* ── Personal details ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Personal details</div>
          <div className={styles.card}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>
                <FontAwesomeIcon icon='user' className={styles.fieldIcon} />
                Full name
              </div>
              <div className={styles.fieldValue}>{user?.name || '—'}</div>
            </div>
            <div className={styles.fieldDivider} />
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>
                <FontAwesomeIcon icon='envelope' className={styles.fieldIcon} />
                Email address
              </div>
              <div className={styles.fieldValue}>{user?.email || '—'}</div>
            </div>
            <div className={styles.fieldDivider} />
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>
                <FontAwesomeIcon
                  icon='venus-mars'
                  className={styles.fieldIcon}
                />
                Gender
              </div>
              <div className={styles.fieldValue}>
                {user?.gender
                  ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1)
                  : '—'}
              </div>
            </div>
            <div className={styles.fieldDivider} />
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>
                <FontAwesomeIcon icon='car' className={styles.fieldIcon} />
                Driver status
              </div>
              <div className={styles.fieldValue}>
                {user?.driver === true ? (
                  <span className={styles.badgeSuccess}>Certified driver</span>
                ) : user?.driver === false ? (
                  <span className={styles.badgeNeutral}>Not a driver</span>
                ) : (
                  '—'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Employment details ── */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Employment details</div>
          <div className={styles.card}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>
                <FontAwesomeIcon
                  icon='user-group'
                  className={styles.fieldIcon}
                />
                Role
              </div>
              <div className={styles.fieldValue}>{roleLabel}</div>
            </div>
            <div className={styles.fieldDivider} />
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>
                <FontAwesomeIcon
                  icon='clipboard-list'
                  className={styles.fieldIcon}
                />
                Contract type
              </div>
              <div className={styles.fieldValue}>
                {user?.contract_type
                  ? user.contract_type.charAt(0).toUpperCase() +
                    user.contract_type.slice(1)
                  : '—'}
              </div>
            </div>
            <div className={styles.fieldDivider} />
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>
                <FontAwesomeIcon icon='clock' className={styles.fieldIcon} />
                Contracted hours
              </div>
              <div className={styles.fieldValue}>
                {user?.contracted_hours != null
                  ? `${user.contracted_hours} hrs / week`
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Info note ── */}
        <div className={styles.infoNote}>
          <FontAwesomeIcon icon='circle-info' className={styles.infoIcon} />
          <span>
            To update your personal details or employment information, speak to
            your manager or operational lead.
          </span>
        </div>
      </div>
    </div>
  )
}

export default Account
