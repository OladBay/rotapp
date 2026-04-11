import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useRota } from '../../context/RotaContext'
import { getPendingTimeOffCount } from '../../utils/timeOffStorage'
import { getPendingCancelCount } from '../../utils/cancelRequests'
import styles from './Navbar.module.css'

function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { timeOff, cancelRequests } = useRota()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const pendingRequests = getPendingCancelCount(cancelRequests)
  const pendingTimeOff = getPendingTimeOffCount(timeOff)

  const totalPending = pendingRequests + pendingTimeOff
  const hasStaffAction = totalPending > 0

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
                    {totalPending > 9 ? '9+' : totalPending}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.right}>
        <span className={styles.role}>{user?.activeRole}</span>
        <span className={styles.name}>{user?.name}</span>

        <button
          className={styles.themeToggle}
          onClick={toggleTheme}
          title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          <span
            className={`${styles.themeLabel}${isLight ? ` ${styles.themeLabelActive}` : ''}`}
          >
            Light
          </span>
          <div
            className={`${styles.themeTrack} ${isLight ? styles.themeTrackLight : styles.themeTrackDark}`}
          >
            <div
              className={`${styles.themeThumb} ${isLight ? styles.themeThumbLight : styles.themeThumbDark}`}
            />
          </div>
          <span
            className={`${styles.themeLabel}${!isLight ? ` ${styles.themeLabelActive}` : ''}`}
          >
            Dark
          </span>
        </button>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          <FontAwesomeIcon icon='right-from-bracket' /> Log out
        </button>
      </div>
    </nav>
  )
}

export default Navbar
