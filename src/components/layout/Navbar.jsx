import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav style={styles.nav}>
      <div style={styles.logo}>Rot<span style={styles.accent}>app</span></div>
      <div style={styles.right}>
        <span style={styles.role}>{user?.activeRole}</span>
        <span style={styles.name}>{user?.name}</span>
        <button style={styles.btn} onClick={handleLogout}>Log out</button>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 24px', height: '56px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: '#161820',
  },
  logo: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: '#e8eaf0' },
  accent: { color: '#6c8fff' },
  right: { display: 'flex', alignItems: 'center', gap: '12px' },
  role: {
    fontSize: '12px', color: '#6c8fff',
    background: 'rgba(108,143,255,0.12)',
    padding: '4px 10px', borderRadius: '6px',
    fontFamily: 'DM Mono, monospace',
  },
  name: { fontSize: '13px', color: '#9499b0' },
  btn: {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', color: '#9499b0',
    padding: '6px 12px', fontSize: '13px',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
  }
}

export default Navbar