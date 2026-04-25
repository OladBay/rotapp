// src/components/ui/TimePicker.jsx
import { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styles from './TimePicker.module.css'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

function TimePicker({ value, onChange, placeholder = '--:--', error = false }) {
  const [open, setOpen] = useState(false)
  const [selectedHour, setSelectedHour] = useState('')
  const [selectedMinute, setSelectedMinute] = useState('')
  const [userInteracted, setUserInteracted] = useState(false)
  const containerRef = useRef(null)
  const hourListRef = useRef(null)

  // ── Only sync from external value on mount or when value changes
  // externally — never overwrite local state after user has interacted ──
  useEffect(() => {
    if (userInteracted) return
    if (value && value.includes(':')) {
      const [h, m] = value.split(':')
      setSelectedHour(h)
      const mins = ['00', '15', '30', '45']
      const closest = mins.reduce((prev, curr) => {
        return Math.abs(parseInt(curr) - parseInt(m))
        Math.abs(parseInt(prev) - parseInt(m)) ? curr : prev
      })
      setSelectedMinute(closest)
    }
  }, [value])

  // ── Reset interaction flag when value is cleared externally ──────────
  useEffect(() => {
    if (!value) {
      setUserInteracted(false)
      setSelectedHour('')
      setSelectedMinute('')
    }
  }, [value])

  // ── Close on outside click ────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // ── Scroll selected hour into view when panel opens ───────────────────
  useEffect(() => {
    if (open && selectedHour && hourListRef.current) {
      const activeEl = hourListRef.current.querySelector(
        `[data-hour="${selectedHour}"]`
      )
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [open])

  const handleHour = (h) => {
    setUserInteracted(true)
    setSelectedHour(h)
    if (selectedMinute) {
      onChange(`${h}:${selectedMinute}`)
    }
  }

  const handleMinute = (m) => {
    setUserInteracted(true)
    setSelectedMinute(m)
    const hour = selectedHour
    if (hour) {
      onChange(`${hour}:${m}`)
      setOpen(false)
    }
  }

  const displayValue =
    selectedHour && selectedMinute ? `${selectedHour}:${selectedMinute}` : ''

  return (
    <div className={styles.wrap} ref={containerRef}>
      <button
        type='button'
        className={`${styles.trigger} ${error ? styles.triggerError : ''} ${
          open ? styles.triggerOpen : ''
        }`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span
          className={
            displayValue ? styles.triggerValue : styles.triggerPlaceholder
          }
        >
          {displayValue || placeholder}
        </span>
        <FontAwesomeIcon
          icon='clock'
          className={`${styles.triggerIcon} ${
            open ? styles.triggerIconOpen : ''
          }`}
        />
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>Hour</span>
            <span />
            <span className={styles.panelLabel}>Minute</span>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.hourList} ref={hourListRef}>
              {HOURS.map((h) => (
                <button
                  key={h}
                  type='button'
                  data-hour={h}
                  className={`${styles.timeOption} ${
                    selectedHour === h ? styles.timeOptionSelected : ''
                  }`}
                  onClick={() => handleHour(h)}
                >
                  {h}
                </button>
              ))}
            </div>

            <div className={styles.panelDivider} />

            <div className={styles.minuteList}>
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type='button'
                  className={`${styles.timeOption} ${
                    styles.timeOptionMinute
                  } ${selectedMinute === m ? styles.timeOptionSelected : ''}`}
                  onClick={() => handleMinute(m)}
                >
                  :{m}
                </button>
              ))}
            </div>
          </div>

          {(selectedHour || selectedMinute) && (
            <div className={styles.panelFooter}>
              <span className={styles.previewTime}>
                {selectedHour || '--'}:{selectedMinute || '--'}
              </span>
              <span className={styles.previewLabel}>
                {!selectedHour && 'Select an hour'}
                {selectedHour && !selectedMinute && 'Now select a minute'}
                {selectedHour && selectedMinute && 'Tap a minute to confirm'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TimePicker
