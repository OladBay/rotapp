// src/pages/Account.jsx
import { useAuth } from '../context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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

  const roleLabel = ROLE_LABELS[user?.activeRole] || user?.activeRole
  const initials = getInitials(user?.name)

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Account</h1>
            <p className={styles.subtitle}>
              Your profile and employment details
            </p>
          </div>
        </div>

        {/* Identity card */}
        <div className={styles.identityCard}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatar}>{initials}</div>
          </div>
          <div className={styles.identityInfo}>
            <div className={styles.identityName}>{user?.name || '—'}</div>
            <div className={styles.identityRole}>{roleLabel}</div>
            <div className={styles.identityEmail}>{user?.email || '—'}</div>
          </div>
        </div>

        {/* Personal details */}
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

        {/* Employment details */}
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

        {/* Info note */}
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
