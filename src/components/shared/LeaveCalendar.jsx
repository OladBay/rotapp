import { useState, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getTimeOffForStaff } from '../../utils/timeOffStorage'

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

function LeaveCalendar({ staffId, selectedDates = [], onSelectionChange }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const existingLeave = useMemo(
    () => getTimeOffForStaff(staffId || ''),
    [staffId]
  )

  const blockedMap = useMemo(() => {
    const map = {}
    existingLeave.forEach((e) => {
      if (e.date) map[e.date] = e.status
    })
    return map
  }, [existingLeave])

  const todayStr = toDateStr(today)

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    // Monday-based: getDay() returns 0=Sun, so shift
    const startOffset = (firstDay.getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()

    const cells = []

    // Padding from previous month
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthDays - i)
      cells.push({ date: d, dateStr: toDateStr(d), outside: true })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d)
      cells.push({ date, dateStr: toDateStr(date), outside: false })
    }

    // Pad to complete last row (always 6 rows = 42 cells)
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
        const date = new Date(y, m - 1, d)
        return date.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        })
      })
      .join(', ')
  }

  return (
    <div style={s.wrap}>
      {/* Month navigation */}
      <div style={s.header}>
        <button style={s.navBtn} onClick={prevMonth} type='button'>
          <FontAwesomeIcon icon='chevron-left' />
        </button>
        <span style={s.monthTitle}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button style={s.navBtn} onClick={nextMonth} type='button'>
          <FontAwesomeIcon icon='chevron-right' />
        </button>
      </div>

      {/* Day headers */}
      <div style={s.dayHeaders}>
        {DAYS.map((d) => (
          <div key={d} style={s.dayName}>
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div style={s.grid}>
        {calendarDays.map(({ dateStr, outside }, i) => {
          const isToday = dateStr === todayStr
          const isSelected = selectedDates.includes(dateStr)
          const blockedStatus = blockedMap[dateStr]
          const isBlocked = !!blockedStatus && !outside
          const isPast = !outside && dateStr < todayStr

          let cellStyle = { ...s.cell }
          let numStyle = { ...s.cellNum }

          if (outside) {
            numStyle.color = '#2e3040'
            cellStyle.cursor = 'default'
          } else if (isSelected) {
            cellStyle = { ...cellStyle, ...s.cellSelected }
            numStyle = { ...numStyle, color: '#fff', fontWeight: 600 }
          } else if (blockedStatus === 'approved') {
            cellStyle = { ...cellStyle, ...s.cellApproved }
            numStyle = { ...numStyle, color: '#2ecc8a' }
          } else if (blockedStatus === 'pending') {
            cellStyle = { ...cellStyle, ...s.cellPending }
            numStyle = { ...numStyle, color: '#c4883a' }
          } else if (isPast) {
            numStyle.color = '#3a3d52'
            cellStyle.cursor = 'default'
          } else if (isToday) {
            numStyle.color = '#6c8fff'
          } else {
            cellStyle.cursor = 'pointer'
          }

          return (
            <div
              key={i}
              style={cellStyle}
              onClick={() => !isPast && toggleDate(dateStr, outside)}
            >
              <span style={numStyle}>
                {outside ? '' : new Date(dateStr + 'T00:00:00').getDate()}
              </span>
              {isToday && !isSelected && !outside && (
                <span style={s.todayDot} />
              )}
              {blockedStatus === 'approved' && !outside && (
                <span style={{ ...s.statusDot, background: '#2ecc8a' }} />
              )}
              {blockedStatus === 'pending' && !outside && (
                <span style={{ ...s.statusDot, background: '#c4883a' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={s.legend}>
        <div style={s.legendItem}>
          <span style={{ ...s.legendDot, background: '#6c8fff' }} />
          <span style={s.legendText}>Selected</span>
        </div>
        <div style={s.legendItem}>
          <span style={{ ...s.legendDot, background: '#2ecc8a' }} />
          <span style={s.legendText}>Approved leave</span>
        </div>
        <div style={s.legendItem}>
          <span style={{ ...s.legendDot, background: '#c4883a' }} />
          <span style={s.legendText}>Leave pending</span>
        </div>
      </div>

      {/* Selection summary */}
      {selectedDates.length > 0 && (
        <div style={s.summary}>
          <FontAwesomeIcon
            icon='circle-info'
            style={{ marginRight: '6px', flexShrink: 0 }}
          />
          <span>
            {selectedDates.length} day{selectedDates.length > 1 ? 's' : ''}{' '}
            selected
            {' — '}
            {formatSelectedSummary()}
          </span>
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    width: '100%',
    fontFamily: 'DM Sans, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  monthTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '15px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  navBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '7px',
    color: '#9499b0',
    width: '30px',
    height: '30px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'DM Sans, sans-serif',
  },
  dayHeaders: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    marginBottom: '6px',
  },
  dayName: {
    textAlign: 'center',
    fontSize: '11px',
    fontWeight: 500,
    color: '#5d6180',
    textTransform: 'uppercase',
    padding: '4px 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px',
  },
  cell: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '40px',
    borderRadius: '8px',
    cursor: 'default',
    transition: 'background 0.12s',
    userSelect: 'none',
  },
  cellSelected: {
    background: '#6c8fff',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    margin: '2px auto',
    cursor: 'pointer',
  },
  cellApproved: {
    background: 'rgba(46,204,138,0.08)',
    borderRadius: '8px',
    cursor: 'not-allowed',
  },
  cellPending: {
    background: 'rgba(196,136,58,0.08)',
    borderRadius: '8px',
    cursor: 'not-allowed',
  },
  cellNum: {
    fontSize: '15px',
    fontWeight: 500,
    color: '#e8eaf0',
    lineHeight: 1,
  },
  todayDot: {
    position: 'absolute',
    bottom: '4px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    background: '#6c8fff',
  },
  statusDot: {
    position: 'absolute',
    bottom: '4px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '4px',
    height: '4px',
    borderRadius: '50%',
  },
  legend: {
    display: 'flex',
    gap: '16px',
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendText: {
    fontSize: '11px',
    color: '#9499b0',
  },
  summary: {
    marginTop: '12px',
    padding: '10px 14px',
    background: 'rgba(108,143,255,0.08)',
    border: '1px solid rgba(108,143,255,0.15)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#6c8fff',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '2px',
    lineHeight: 1.5,
  },
}

export default LeaveCalendar
