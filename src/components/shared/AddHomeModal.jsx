import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { createHome } from '../../utils/homesData'
import styles from './AddHomeModal.module.css'

function AddHomeModal({ onClose, onHomeCreated, orgId }) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [createdHome, setCreatedHome] = useState(null)

  const handleSave = async () => {
    setError('')
    if (!name.trim()) {
      setError('Home name is required')
      return
    }
    if (!address.trim()) {
      setError('Address is required')
      return
    }

    setSaving(true)
    try {
      const home = await createHome({ name, address, orgId })
      setCreatedHome(home)
    } catch (err) {
      setError(err.message || 'Failed to create home. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    onHomeCreated(createdHome)
    onClose()
  }

  const handleOnboardManager = () => {
    onHomeCreated(createdHome)
    onClose('onboard', createdHome)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.title}>
              {createdHome ? 'Home added' : 'Add a new home'}
            </div>
            <div className={styles.subtitle}>
              {createdHome
                ? 'What would you like to do next?'
                : 'This home will be added to your organisation'}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <FontAwesomeIcon icon='xmark' />
          </button>
        </div>

        {/* Step 1 — form */}
        {!createdHome && (
          <div className={styles.body}>
            <div className={styles.field}>
              <label className={styles.label}>Home name</label>
              <input
                className={styles.input}
                type='text'
                placeholder='e.g. Meadowview House'
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError('')
                }}
                autoFocus
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Address</label>
              <input
                className={styles.input}
                type='text'
                placeholder='e.g. 12 Oak Street, Coventry, CV1 2AB'
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value)
                  setError('')
                }}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <FontAwesomeIcon icon='spinner' spin /> Saving…
                  </>
                ) : (
                  <>
                    Save home <FontAwesomeIcon icon='chevron-right' />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — confirmation + next action */}
        {createdHome && (
          <div className={styles.body}>
            <div className={styles.successBlock}>
              <div className={styles.successIcon}>
                <FontAwesomeIcon icon='circle-check' />
              </div>
              <div className={styles.successName}>{createdHome.name}</div>
              <div className={styles.successNote}>
                has been added to your organisation
              </div>
            </div>

            <div className={styles.promptText}>
              Would you like to onboard a manager to this home now?
            </div>

            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={handleSkip}>
                Skip for now
              </button>
              <button className={styles.saveBtn} onClick={handleOnboardManager}>
                Onboard manager <FontAwesomeIcon icon='chevron-right' />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AddHomeModal
