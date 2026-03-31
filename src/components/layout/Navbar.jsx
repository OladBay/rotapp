import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const canSeeStaff = ['manager', 'superadmin'].includes(user?.activeRole)
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
  ].filter((l) => l.show)

  return (
    <nav style={styles.nav}>
      <div style={styles.left}>
        <div style={styles.logo}>
          Rot<span style={styles.accent}>app</span>
        </div>
        <div style={styles.links}>
          {navLinks.map((link) => (
            <button
              key={link.path}
              style={{
                ...styles.link,
                color: location.pathname === link.path ? '#6c8fff' : '#9499b0',
                borderBottom:
                  location.pathname === link.path
                    ? '2px solid #6c8fff'
                    : '2px solid transparent',
              }}
              onClick={() => navigate(link.path)}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.right}>
        <span style={styles.role}>{user?.activeRole}</span>
        <span style={styles.name}>{user?.name}</span>
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
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: '#161820',
  },
  left: { display: 'flex', alignItems: 'center', gap: '32px' },
  logo: {
    fontFamily: 'Syne, sans-serif',
    fontWeight: 700,
    fontSize: '18px',
    color: '#e8eaf0',
  },
  accent: { color: '#6c8fff' },
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
  },
  right: { display: 'flex', alignItems: 'center', gap: '12px' },
  role: {
    fontSize: '12px',
    color: '#6c8fff',
    background: 'rgba(108,143,255,0.12)',
    padding: '4px 10px',
    borderRadius: '6px',
    fontFamily: 'DM Mono, monospace',
  },
  name: { fontSize: '13px', color: '#9499b0' },
  btn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#9499b0',
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
}

export default Navbar
