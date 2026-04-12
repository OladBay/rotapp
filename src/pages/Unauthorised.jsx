import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styles from './Unauthorised.module.css'

function Unauthorised() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleGoBack = () => {
    const role = user?.activeRole
    if (role === 'rcw' || role === 'relief') {
      navigate('/calendar')
    } else {
      navigate('/dashboard')
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          Rot<span className={styles.logoAccent}>app</span>
        </div>

        <div className={styles.iconWrap}>
          <FontAwesomeIcon icon='triangle-exclamation' />
        </div>

        <h1 className={styles.title}>Access restricted</h1>
        <p className={styles.body}>
          You don't have permission to view this page. If you think this is a
          mistake, contact your manager or operational lead.
        </p>

        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={handleGoBack}>
            <FontAwesomeIcon icon='chevron-left' /> Go back
          </button>
          <button className={styles.ghostBtn} onClick={handleLogout}>
            <FontAwesomeIcon icon='right-from-bracket' /> Log out
          </button>
        </div>
      </div>
    </div>
  )
}

export default Unauthorised
