import { useState, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getLeaveDaysForStaff } from '../../utils/timeOffStorage'
import styles from './LeaveCalendar.module.css'

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

// LeaveCalendar accepts leaveDays as a prop — it does not read from context.
// Callers are responsible for passing the correct leaveDays array for the
// staff member being shown.
function LeaveCalendar({
  staffId,
  selectedDates = [],
  onSelectionChange,
  leaveDays = [],
}) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  // Get all leave days for this staff member
  const staffLeaveDays = useMemo(
    () => getLeaveDaysForStaff(leaveDays, staffId || ''),
    [leaveDays, staffId]
  )

  // Build a map of date → status for blocking already-taken days
  // Only block approved and pending days — declined days are available again
  const blockedMap = useMemo(() => {
    const map = {}
    staffLeaveDays.forEach((e) => {
      if (e.date && (e.status === 'approved' || e.status === 'pending')) {
        map[e.date] = e.status
      }
    })
    return map
  }, [staffLeaveDays])

  const todayStr = toDateStr(today)

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

  const toggleDate = (dateStr, outside) => {
    if (outside) return
    if (blockedMap[dateStr]) return
    const already = selectedDates.includes(dateStr)
    if (already) {
      onSelectionChange(selectedDates.filter((d) => d !== dateStr))
    } else {
      onSelectionChange([...selectedDates, dateStr].sort())
    }
  }

  const formatSelectedSummary = () => {
    if (selectedDates.length === 0) return null
    return selectedDates
      .map((ds) => {
        const [y, m, d] = ds.split('-').map(Number)
        return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        })
      })
      .join(', ')
  }

  return (
    <div className={styles.wrap}>
      {/* Month navigation */}
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
        {calendarDays.map(({ dateStr, outside }, i) => {
          const isToday = dateStr === todayStr
          const isSelected = selectedDates.includes(dateStr)
          const blockedStatus = blockedMap[dateStr]
          const isBlocked = !!blockedStatus && !outside
          const isPast = !outside && dateStr < todayStr

          const cellClass = [
            styles.cell,
            outside
              ? ''
              : isSelected
                ? styles.cellSelected
                : blockedStatus === 'approved'
                  ? styles.cellApproved
                  : blockedStatus === 'pending'
                    ? styles.cellPending
                    : isPast
                      ? ''
                      : styles.cellAvailable,
          ]
            .filter(Boolean)
            .join(' ')

          const numClass = [
            styles.cellNum,
            outside
              ? styles.cellNumOutside
              : isSelected
                ? styles.cellNumSelected
                : blockedStatus === 'approved'
                  ? styles.cellNumApproved
                  : blockedStatus === 'pending'
                    ? styles.cellNumPending
                    : isPast
                      ? styles.cellNumPast
                      : isToday
                        ? styles.cellNumToday
                        : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={i}
              className={cellClass}
              onClick={() => !isPast && toggleDate(dateStr, outside)}
            >
              <span className={numClass}>
                {outside ? '' : new Date(dateStr + 'T00:00:00').getDate()}
              </span>
              {isToday && !isSelected && !outside && (
                <span className={styles.todayDot} />
              )}
              {blockedStatus === 'approved' && !outside && (
                <span className={styles.statusDotApproved} />
              )}
              {blockedStatus === 'pending' && !outside && (
                <span className={styles.statusDotPending} />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendDotSelected} />
          <span className={styles.legendText}>Selected</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDotApproved} />
          <span className={styles.legendText}>Approved leave</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendDotPending} />
          <span className={styles.legendText}>Leave pending</span>
        </div>
      </div>

      {/* Selection summary */}
      {selectedDates.length > 0 && (
        <div className={styles.summary}>
          <FontAwesomeIcon icon='circle-info' style={{ flexShrink: 0 }} />
          <span>
            {selectedDates.length} day{selectedDates.length > 1 ? 's' : ''}{' '}
            selected{' — '}
            {formatSelectedSummary()}
          </span>
        </div>
      )}
    </div>
  )
}

export default LeaveCalendar
