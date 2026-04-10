import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useRota } from '../../context/RotaContext'
import { getPendingTimeOffCount } from '../../utils/timeOffStorage'
import { getPendingCancelCount } from '../../utils/cancelRequests'

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

  return (
    <nav style={styles.nav}>
      <div style={styles.left}>
        <div style={styles.logo}>
          Rot<span style={styles.accent}>app</span>
        </div>
        <div style={styles.links}>
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path
            return (
              <button
                key={link.path}
                style={{
                  ...styles.link,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  borderBottom: isActive
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                  position: 'relative',
                }}
                onClick={() => navigate(link.path)}
              >
                {link.label}
                {link.label === 'Staff' && hasStaffAction && (
                  <span style={styles.badge}>
                    {totalPending > 9 ? '9+' : totalPending}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div style={styles.right}>
        <span style={styles.role}>{user?.activeRole}</span>
        <span style={styles.name}>{user?.name}</span>

        <button
          style={styles.iconBtn}
          onClick={toggleTheme}
          title={
            theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
          }
        >
          <FontAwesomeIcon
            icon={['fas', theme === 'dark' ? 'sun' : 'moon']}
            style={{ fontSize: 14 }}
          />
        </button>

        <button style={styles.btn} onClick={handleLogout}>
          <FontAwesomeIcon icon='right-from-bracket' /> Log out
        </button>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: '56px',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-raised)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  left: { display: 'flex', alignItems: 'center', gap: '32px' },
  right: { display: 'flex', alignItems: 'center', gap: '12px' },
  logo: {
    fontFamily: 'Syne, sans-serif',
    fontWeight: 700,
    fontSize: '18px',
    color: 'var(--text-primary)',
  },
  accent: { color: 'var(--accent)' },
  links: { display: 'flex', alignItems: 'center', gap: '4px' },
  link: {
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '18px 10px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    marginBottom: '-1px',
    transition: 'color 0.15s',
  },
  role: {
    fontSize: '12px',
    color: 'var(--accent)',
    background: 'var(--accent-bg)',
    padding: '4px 10px',
    borderRadius: '6px',
    fontFamily: 'DM Mono, monospace',
  },
  name: { fontSize: '13px', color: 'var(--text-secondary)' },
  iconBtn: {
    background: 'var(--sn-icon-btn)',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    color: 'var(--text-secondary)',
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  btn: {
    background: 'transparent',
    border: '1px solid var(--border-default)',
    borderRadius: '8px',
    color: 'var(--text-secondary)',
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'background 0.15s',
  },
  badge: {
    position: 'absolute',
    top: '8px',
    right: '-8px',
    background: 'var(--color-danger)',
    color: '#fff',
    fontSize: '9px',
    fontWeight: 600,
    padding: '2px 5px',
    borderRadius: '10px',
    minWidth: '16px',
    textAlign: 'center',
    lineHeight: 1,
  },
}

export default Navbar
