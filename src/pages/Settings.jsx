// src/pages/Settings.jsx
import { useTheme } from '../context/ThemeContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styles from './Settings.module.css'

function Settings() {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Settings</h1>
            <p className={styles.subtitle}>
              App preferences and notification controls
            </p>
          </div>
        </div>

        {/* Appearance */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Appearance</div>
          <div className={styles.card}>
            <div className={styles.settingRow}>
              <div className={styles.settingLeft}>
                <div className={styles.settingIconWrap}>
                  <FontAwesomeIcon icon={isLight ? 'moon' : 'sun'} />
                </div>
                <div className={styles.settingInfo}>
                  <div className={styles.settingLabel}>Theme</div>
                  <div className={styles.settingDesc}>
                    {isLight ? 'Light mode is on' : 'Dark mode is on'}
                  </div>
                </div>
              </div>
              <button
                className={`${styles.toggle} ${isLight ? styles.toggleLight : styles.toggleDark}`}
                onClick={toggleTheme}
                aria-label='Toggle theme'
              >
                <span className={styles.toggleThumb} />
              </button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Notifications</div>
          <div className={styles.card}>
            <div className={styles.settingRow}>
              <div className={styles.settingLeft}>
                <div className={styles.settingIconWrap}>
                  <FontAwesomeIcon icon={['far', 'bell']} />
                </div>
                <div className={styles.settingInfo}>
                  <div className={styles.settingLabel}>Rota updates</div>
                  <div className={styles.settingDesc}>
                    When your rota is published or amended
                  </div>
                </div>
              </div>
              <div className={styles.comingSoon}>Coming soon</div>
            </div>

            <div className={styles.settingDivider} />

            <div className={styles.settingRow}>
              <div className={styles.settingLeft}>
                <div className={styles.settingIconWrap}>
                  <FontAwesomeIcon icon='umbrella-beach' />
                </div>
                <div className={styles.settingInfo}>
                  <div className={styles.settingLabel}>Leave requests</div>
                  <div className={styles.settingDesc}>
                    Updates on your leave applications
                  </div>
                </div>
              </div>
              <div className={styles.comingSoon}>Coming soon</div>
            </div>

            <div className={styles.settingDivider} />

            <div className={styles.settingRow}>
              <div className={styles.settingLeft}>
                <div className={styles.settingIconWrap}>
                  <FontAwesomeIcon icon='xmark' />
                </div>
                <div className={styles.settingInfo}>
                  <div className={styles.settingLabel}>Cancellations</div>
                  <div className={styles.settingDesc}>
                    When a shift cancellation is approved or declined
                  </div>
                </div>
              </div>
              <div className={styles.comingSoon}>Coming soon</div>
            </div>

            <div className={styles.settingDivider} />

            <div className={styles.settingRow}>
              <div className={styles.settingLeft}>
                <div className={styles.settingIconWrap}>
                  <FontAwesomeIcon icon='arrow-right-arrow-left' />
                </div>
                <div className={styles.settingInfo}>
                  <div className={styles.settingLabel}>Staff transfers</div>
                  <div className={styles.settingDesc}>
                    When a transfer request is made or resolved
                  </div>
                </div>
              </div>
              <div className={styles.comingSoon}>Coming soon</div>
            </div>
          </div>
        </div>

        {/* Info note */}
        <div className={styles.infoNote}>
          <FontAwesomeIcon icon='circle-info' className={styles.infoIcon} />
          <span>
            Critical notifications — such as shift removals and account changes
            — cannot be turned off.
          </span>
        </div>
      </div>
    </div>
  )
}

export default Settings
