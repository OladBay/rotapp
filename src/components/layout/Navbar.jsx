import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useRota } from '../../context/RotaContext'
import { getPendingRequestCount } from '../../utils/timeOffStorage'
import { getPendingCancelCount } from '../../utils/cancelRequests'
import { getUnreadCount } from '../../utils/notifications'
import SessionBanner from './SessionBanner'
import styles from './Navbar.module.css'

function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { leaveRequests, cancelRequests, notifications } = useRota()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // ── Staff badge count ──────────────────────────────────────────────────
  // Combines pending leave requests, pending cancellations, and unread
  // notifications into a single badge count on the Staff nav link.
  const pendingCancels = getPendingCancelCount(cancelRequests)
  const pendingLeave = getPendingRequestCount(leaveRequests)
  const unreadNotifications = getUnreadCount(notifications)

  const totalStaffPending = pendingCancels + pendingLeave + unreadNotifications
  const hasStaffAction = totalStaffPending > 0

  const canSeeStaff = ['manager', 'superadmin', 'operationallead'].includes(
    user?.activeRole
  )
  const canSeeRota = [
    'manager',
    'deputy',
    'senior',
    'operationallead',
    'superadmin',
  ].includes(user?.activeRole)

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard', show: canSeeRota },
    { path: '/rota', label: 'Rota', show: canSeeRota },
    { path: '/staff', label: 'Staff', show: canSeeStaff },
    { path: '/calendar', label: 'My shifts', show: true },
    { path: '/year-calendar', label: 'Year calendar', show: canSeeRota },
  ].filter((l) => l.show)

  const isLight = theme === 'light'

  return (
    <div className={styles.navWrap}>
      <nav className={styles.nav}>
        <div className={styles.left}>
          <div className={styles.logo}>
            Rot<span className={styles.logoAccent}>app</span>
          </div>
          <div className={styles.links}>
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path
              return (
                <button
                  key={link.path}
                  className={`${styles.link}${isActive ? ` ${styles.linkActive}` : ''}`}
                  onClick={() => navigate(link.path)}
                >
                  {link.label}
                  {link.label === 'Staff' && hasStaffAction && (
                    <span className={styles.badge}>
                      {totalStaffPending > 9 ? '9+' : totalStaffPending}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.right}>
          {/* Theme toggle */}
          <button className={styles.themeToggle} onClick={toggleTheme}>
            <span
              className={`${styles.themeLabel}${!isLight ? ` ${styles.themeLabelActive}` : ''}`}
            >
              <FontAwesomeIcon icon='moon' />
            </span>
            <div
              className={`${styles.themeTrack}${isLight ? ` ${styles.themeTrackLight}` : ` ${styles.themeTrackDark}`}`}
            >
              <div
                className={`${styles.themeThumb}${isLight ? ` ${styles.themeThumbLight}` : ` ${styles.themeThumbDark}`}`}
              />
            </div>
            <span
              className={`${styles.themeLabel}${isLight ? ` ${styles.themeLabelActive}` : ''}`}
            >
              <FontAwesomeIcon icon='sun' />
            </span>
          </button>

          {/* User info */}
          <span className={styles.role}>{user?.activeRole}</span>
          <span className={styles.name}>{user?.name?.split(' ')[0]}</span>

          {/* Logout */}
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <FontAwesomeIcon icon='right-from-bracket' /> Log out
          </button>
        </div>
      </nav>
      <SessionBanner />
    </div>
  )
}

export default Navbar
