import { useState, useEffect, useRef, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

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

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Close on Escape
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
    <div ref={wrapRef} style={s.wrap}>
      {/* Header */}
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
        {calendarDays.map(({ date, dateStr, outside }, i) => {
          const isToday = dateStr === todayStr
          const isOutside = outside

          let cellStyle = { ...s.cell }
          let numStyle = { ...s.cellNum }

          if (isOutside) {
            numStyle.color = '#2e3040'
            cellStyle.cursor = 'default'
          } else if (isToday) {
            cellStyle = { ...cellStyle, ...s.cellToday }
            numStyle = { ...numStyle, color: '#6c8fff', fontWeight: 600 }
          } else {
            cellStyle = { ...cellStyle, ...s.cellAvailable }
          }

          return (
            <div
              key={i}
              style={cellStyle}
              onClick={() => {
                if (isOutside) return
                onJump(date)
                onClose()
              }}
            >
              <span style={numStyle}>{isOutside ? '' : date.getDate()}</span>
              {isToday && <span style={s.todayDot} />}
            </div>
          )
        })}
      </div>

      {/* Today shortcut */}
      <div style={s.footer}>
        <button
          style={s.todayBtn}
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

const s = {
  wrap: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    left: 0,
    zIndex: 200,
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    padding: '16px',
    width: '280px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    fontFamily: 'DM Sans, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
  },
  monthTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '14px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  navBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '7px',
    color: '#9499b0',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'DM Sans, sans-serif',
  },
  dayHeaders: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    marginBottom: '4px',
  },
  dayName: {
    textAlign: 'center',
    fontSize: '10px',
    fontWeight: 500,
    color: '#5d6180',
    textTransform: 'uppercase',
    padding: '3px 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '1px',
  },
  cell: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '34px',
    borderRadius: '7px',
    cursor: 'default',
    userSelect: 'none',
  },
  cellAvailable: {
    cursor: 'pointer',
    transition: 'background 0.1s',
    ':hover': { background: 'rgba(108,143,255,0.1)' },
  },
  cellToday: {
    background: 'rgba(108,143,255,0.12)',
    border: '1px solid rgba(108,143,255,0.3)',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    margin: '1px auto',
    cursor: 'pointer',
  },
  cellNum: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#e8eaf0',
    lineHeight: 1,
  },
  todayDot: {
    position: 'absolute',
    bottom: '3px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '3px',
    height: '3px',
    borderRadius: '50%',
    background: '#6c8fff',
  },
  footer: {
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    justifyContent: 'center',
  },
  todayBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '7px',
    color: '#6c8fff',
    padding: '6px 16px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    width: '100%',
  },
}

export default JumpCalendar
