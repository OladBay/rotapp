import styles from './Button.module.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  className = '',
  ...props
}) {
  const buttonClass = `
    ${styles.btn}
    ${styles[variant]}
    ${styles[size]}
    ${loading ? styles.loading : ''}
    ${className}
  `.trim()

  return (
    <button
      type={type}
      className={buttonClass}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className={styles.spinner}>
          <FontAwesomeIcon icon='spinner' spin />
        </span>
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <FontAwesomeIcon icon={icon} className={styles.iconLeft} />
          )}
          <span className={styles.content}>{children}</span>
          {icon && iconPosition === 'right' && (
            <FontAwesomeIcon icon={icon} className={styles.iconRight} />
          )}
        </>
      )}
    </button>
  )
}

export default Button
