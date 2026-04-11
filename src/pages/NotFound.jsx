import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button/Button'
import styles from './NotFound.module.css'

function NotFound() {
  const navigate = useNavigate()

  return (
    <div className={styles.container}>
      {/* Animated floating shapes */}
      <div className={styles.shapeCircle1}></div>
      <div className={styles.shapeCircle2}></div>
      <div className={styles.shapeCross1}>
        <span>+</span>
      </div>
      <div className={styles.shapeCross2}>
        <span>+</span>
      </div>
      <div className={styles.shapeTriangle}></div>
      <div className={styles.shapeSquare}></div>

      {/* Content */}
      <div className={styles.content}>
        <h1 className={styles.errorCode}>404</h1>
        <p className={styles.message}>Page not found</p>
        <p className={styles.subMessage}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button
          variant='primary'
          size='lg'
          onClick={() => navigate('/dashboard')}
        >
          Take me home
        </Button>
      </div>
    </div>
  )
}

export default NotFound
