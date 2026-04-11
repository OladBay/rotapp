import { useState, useEffect, useRef, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styles from './JumpCalendar.module.css'

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function JumpCalendar({ onJump, onClose, initialDate }) {
  const today = new Date()
  const todayStr = toDateStr(today)

  const [viewYear, setViewYear] = useState(
    initialDate ? initialDate.getFullYear() : today.getFullYear()
  )
  const [viewMonth, setViewMonth] = useState(
    initialDate ? initialDate.getMonth() : today.getMonth()
  )

  const wrapRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else setViewMonth((m) => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else setViewMonth((m) => m + 1)
  }

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const startOffset = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()
    const cells = []

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthDays - i)
      cells.push({ date: d, dateStr: toDateStr(d), outside: true })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d)
      cells.push({ date, dateStr: toDateStr(date), outside: false })
    }
    while (cells.length < 42) {
      const d = new Date(
        viewYear,
        viewMonth + 1,
        cells.length - startOffset - daysInMonth + 1
      )
      cells.push({ date: d, dateStr: toDateStr(d), outside: true })
    }
    return cells
  }, [viewYear, viewMonth])

  return (
    <div ref={wrapRef} className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={prevMonth} type='button'>
          <FontAwesomeIcon icon='chevron-left' />
        </button>
        <span className={styles.monthTitle}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button className={styles.navBtn} onClick={nextMonth} type='button'>
          <FontAwesomeIcon icon='chevron-right' />
        </button>
      </div>

      {/* Day headers */}
      <div className={styles.dayHeaders}>
        {DAYS.map((d) => (
          <div key={d} className={styles.dayName}>
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className={styles.grid}>
        {calendarDays.map(({ date, dateStr, outside }, i) => {
          const isToday = dateStr === todayStr

          const cellClass = [
            styles.cell,
            outside ? '' : isToday ? styles.cellToday : styles.cellAvailable,
          ].join(' ')

          const numClass = [
            styles.cellNum,
            outside
              ? styles.cellNumOutside
              : isToday
                ? styles.cellNumToday
                : '',
          ].join(' ')

          return (
            <div
              key={i}
              className={cellClass}
              onClick={() => {
                if (outside) return
                onJump(date)
                onClose()
              }}
            >
              <span className={numClass}>{outside ? '' : date.getDate()}</span>
              {isToday && <span className={styles.todayDot} />}
            </div>
          )
        })}
      </div>

      {/* Today shortcut */}
      <div className={styles.footer}>
        <button
          className={styles.todayBtn}
          type='button'
          onClick={() => {
            onJump(today)
            onClose()
          }}
        >
          Jump to today
        </button>
      </div>
    </div>
  )
}

export default JumpCalendar
