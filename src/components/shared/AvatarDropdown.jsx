// src/components/shared/AvatarDropdown.jsx
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  getAvatarUrl,
  uploadAvatar,
  removeAvatar,
} from '../../utils/avatarUtils'
import styles from './AvatarDropdown.module.css'

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  operationallead: 'Operational Lead',
  manager: 'Manager',
  deputy: 'Deputy Manager',
  senior: 'Senior Carer',
  rcw: 'Care Worker',
  relief: 'Relief Staff',
}

function AvatarDropdown() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(getAvatarUrl(user))
  const dropdownRef = useRef(null)
  const fileInputRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Update avatar URL when user changes
  useEffect(() => {
    setAvatarUrl(getAvatarUrl(user))
  }, [user?.avatar_url, user?.name])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const url = await uploadAvatar(user.id, file)
      setAvatarUrl(`${url}&t=${Date.now()}`)
      // Update user context by refreshing the page auth state
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

  const roleLabel = ROLE_LABELS[user?.activeRole] || user?.activeRole

  return (
    <div className={styles.wrap} ref={dropdownRef}>
      {/* Avatar trigger button */}
      <button
        className={`${styles.avatarBtn} ${open ? styles.avatarBtnOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        title='Profile'
      >
        <span className={styles.avatarRing}>
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
            <span className={styles.avatarIcon}>
              <FontAwesomeIcon icon='user' />
            </span>
          )}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className={styles.dropdown}>
          {/* Profile header */}
          <div className={styles.dropdownHeader}>
            <div className={styles.dropdownAvatarWrap}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.name || 'Avatar'}
                  className={styles.dropdownAvatar}
                />
              ) : (
                <span className={styles.dropdownAvatarIcon}>
                  <FontAwesomeIcon icon='user' />
                </span>
              )}
              {uploading && (
                <div className={styles.uploadOverlay}>
                  <div className={styles.uploadSpinner} />
                </div>
              )}
            </div>
            <div className={styles.dropdownUserInfo}>
              <div className={styles.dropdownName}>{user?.name || '—'}</div>
              <div className={styles.dropdownRole}>{roleLabel}</div>
              <div className={styles.dropdownEmail}>{user?.email || '—'}</div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className={styles.errorMsg}>
              <FontAwesomeIcon icon='triangle-exclamation' />
              {error}
            </div>
          )}

          {/* Divider */}
          <div className={styles.dropdownDivider} />

          {/* Photo actions */}
          <div className={styles.dropdownActions}>
            <button
              className={styles.actionBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <FontAwesomeIcon icon='pen-to-square' />
              {user?.avatar_url ? 'Change photo' : 'Upload photo'}
            </button>

            {user?.avatar_url && (
              <button
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                onClick={handleRemove}
                disabled={uploading}
              >
                <FontAwesomeIcon icon='trash' />
                Remove photo
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

          {/* Divider */}
          <div className={styles.dropdownDivider} />

          {/* Logout */}
          <div className={styles.dropdownActions}>
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => {
                logout()
                window.location.href = '/login'
              }}
            >
              <FontAwesomeIcon icon='right-from-bracket' />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AvatarDropdown
