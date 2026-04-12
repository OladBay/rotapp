import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useRota } from '../../context/RotaContext'
import styles from './SessionBanner.module.css'

function SessionBanner() {
  const { user, revertRole } = useAuth()
  const { homeName } = useRota()
  const navigate = useNavigate()

  // Only show when OL or admin is stepped into a home
  if (!user?.previousRole) return null

  const handleRevert = () => {
    revertRole()
    navigate('/dashboard')
  }

  return (
    <div className={styles.banner}>
      <div className={styles.left}>
        <FontAwesomeIcon icon='house' className={styles.icon} />
        <span className={styles.label}>Acting as Manager</span>
        <span className={styles.divider}>·</span>
        <span className={styles.homeName}>{homeName || '—'}</span>
      </div>
      <button className={styles.revertBtn} onClick={handleRevert}>
        <FontAwesomeIcon icon='right-left' /> Revert role
      </button>
    </div>
  )
}

export default SessionBanner
