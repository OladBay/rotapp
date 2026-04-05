import { useState, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { getTimeOffForStaff } from '../../utils/timeOffStorage'

const DAYS_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTH_NAMES = [
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

function getMonthDates(year, month) {
  const first = new Date(year, month, 1)
  const startDay = (first.getDay() + 6) % 7
  const dates = []
  for (let i = 0; i < startDay; i++) {
    const d = new Date(year, month, 1 - (startDay - i))
    dates.push({ date: d, inMonth: false })
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let i = 1; i <= daysInMonth; i++) {
    dates.push({ date: new Date(year, month, i), inMonth: true })
  }
  while (dates.length % 7 !== 0) {
    const last = dates[dates.length - 1].date
    const next = new Date(last)
    next.setDate(last.getDate() + 1)
    dates.push({ date: next, inMonth: false })
  }
  return dates
}

function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMondayKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return toDateStr(date)
}

function getShiftInfo(monthRota, staffId, dateStr) {
  const mondayKey = getMondayKey(dateStr)
  const rota = monthRota[mondayKey]
  if (!rota) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const [my, mm, md] = mondayKey.split('-').map(Number)
  const dayIdx = Math.round(
    (new Date(y, m - 1, d) - new Date(my, mm - 1, md)) / (1000 * 60 * 60 * 24)
  )
  if (dayIdx < 0 || dayIdx > 6) return null
  const earlyEntry = (rota.early?.[dayIdx] || []).find((s) => s.id === staffId)
  const lateEntry = (rota.late?.[dayIdx] || []).find((s) => s.id === staffId)
  if (!earlyEntry && !lateEntry) return null
  return {
    early: !!earlyEntry,
    late: !!lateEntry,
    sleepIn: lateEntry?.sleepIn || false,
  }
}

export default function ShiftPickerCalendar({
  targetStaffId,
  monthRota,
  initiatorShiftDate, // Staff A's shift date — always selectable regardless
  onSelect, // ({ date, type, sleepIn, sameDay }) => void
  selected, // { date, type } | null
}) {
  const TODAY = new Date()
  const [year, setYear] = useState(TODAY.getFullYear())
  const [month, setMonth] = useState(TODAY.getMonth())
  const [activeDateStr, setActiveDateStr] = useState(null)

  const targetTimeOff = useMemo(
    () => getTimeOffForStaff(targetStaffId || ''),
    [targetStaffId]
  )

  const getLeaveForDate = (dateStr) =>
    targetTimeOff.filter((e) => e.date === dateStr && e.status === 'approved')

  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else setMonth((m) => m - 1)
    setActiveDateStr(null)
  }

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else setMonth((m) => m + 1)
    setActiveDateStr(null)
  }

  const handleDateClick = (dateStr, shiftInfo, isSameDay) => {
    if (isSameDay) {
      // Same date as Staff A's shift — always open picker
      setActiveDateStr(activeDateStr === dateStr ? null : dateStr)
      return
    }
    // Different date — only if Staff B has a published shift
    if (shiftInfo) {
      setActiveDateStr(activeDateStr === dateStr ? null : dateStr)
    }
  }

  const handleShiftSelect = (dateStr, type, sleepIn, sameDay = false) => {
    onSelect({ date: dateStr, type, sleepIn: sleepIn || false, sameDay })
    setActiveDateStr(null)
  }

  const isSelected = (dateStr, type) =>
    selected?.date === dateStr && selected?.type === type

  const getDotColor = (shiftInfo, hasLeave, isSameDay) => {
    if (isSameDay) return 'sameday'
    if (!shiftInfo && !hasLeave) return null
    if (shiftInfo?.early && shiftInfo?.late) return 'both'
    if (shiftInfo?.early && hasLeave) return 'both'
    if (shiftInfo?.late && hasLeave) return 'both'
    if (shiftInfo?.early) return '#2a7f62'
    if (shiftInfo?.late) return '#7a4fa8'
    if (hasLeave) return '#c4883a'
    return null
  }

  return (
    <div style={sc.wrap}>
      {/* Month nav */}
      <div style={sc.nav}>
        <button style={sc.navBtn} onClick={prevMonth}>
          <FontAwesomeIcon icon='chevron-left' />
        </button>
        <span style={sc.monthLabel}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button style={sc.navBtn} onClick={nextMonth}>
          <FontAwesomeIcon icon='chevron-right' />
        </button>
      </div>

      {/* Day headers */}
      <div style={sc.dayHeaders}>
        {DAYS_SHORT.map((d, i) => (
          <div key={i} style={sc.dayHead}>
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div style={sc.grid}>
        {monthDates.map(({ date, inMonth }, i) => {
          const dateStr = toDateStr(date)
          const isSameDay = dateStr === initiatorShiftDate
          const shiftInfo = inMonth
            ? getShiftInfo(monthRota, targetStaffId, dateStr)
            : null
          const leaveEntries = inMonth ? getLeaveForDate(dateStr) : []
          const hasLeave = leaveEntries.length > 0
          const dotColor = inMonth
            ? getDotColor(shiftInfo, hasLeave, isSameDay)
            : null

          // Clickable: same day always, other days only if Staff B has shift
          const isClickable =
            inMonth && (isSameDay || !!shiftInfo || (hasLeave && isSameDay))
          const isActive = activeDateStr === dateStr
          const isSelectedDate = selected?.date === dateStr

          return (
            <div key={i} style={{ position: 'relative' }}>
              <div
                style={{
                  ...sc.cell,
                  opacity: inMonth ? 1 : 0.15,
                  cursor: isClickable ? 'pointer' : 'default',
                  background: isSelectedDate
                    ? 'rgba(108,143,255,0.2)'
                    : isSameDay && inMonth
                      ? 'rgba(108,143,255,0.06)'
                      : isActive
                        ? 'rgba(255,255,255,0.06)'
                        : isClickable
                          ? 'rgba(255,255,255,0.02)'
                          : 'transparent',
                  border: isSelectedDate
                    ? '1px solid rgba(108,143,255,0.5)'
                    : isSameDay && inMonth
                      ? '1px solid rgba(108,143,255,0.35)'
                      : isActive
                        ? '1px solid rgba(255,255,255,0.15)'
                        : isClickable
                          ? '1px solid rgba(255,255,255,0.07)'
                          : '1px solid transparent',
                }}
                onClick={() =>
                  isClickable && handleDateClick(dateStr, shiftInfo, isSameDay)
                }
              >
                <span
                  style={{
                    ...sc.dateNum,
                    color: isSelectedDate
                      ? '#6c8fff'
                      : isSameDay && inMonth
                        ? '#6c8fff'
                        : isClickable
                          ? '#e8eaf0'
                          : '#3d405a',
                    fontWeight: isClickable ? 500 : 400,
                  }}
                >
                  {date.getDate()}
                </span>

                {/* Dot indicator */}
                {dotColor === 'sameday' ? (
                  <div style={{ ...sc.dot, background: '#6c8fff' }} />
                ) : dotColor === 'both' ? (
                  <div style={sc.splitDotWrap}>
                    <div style={{ ...sc.splitDot, background: '#2a7f62' }} />
                    <div style={{ ...sc.splitDot, background: '#7a4fa8' }} />
                  </div>
                ) : dotColor ? (
                  <div style={{ ...sc.dot, background: dotColor }} />
                ) : null}
              </div>

              {/* Shift picker popup */}
              {isActive && (
                <div style={sc.picker}>
                  <div style={sc.pickerDate}>
                    {date.toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                    {isSameDay && <span style={sc.sameDayTag}>same day</span>}
                  </div>

                  {/* Leave indicator */}
                  {hasLeave && (
                    <div style={sc.leaveTag}>
                      <FontAwesomeIcon
                        icon='umbrella-beach'
                        style={{ fontSize: '10px' }}
                      />
                      On approved leave
                    </div>
                  )}

                  {/* Published shift options */}
                  {shiftInfo && (
                    <>
                      {shiftInfo.early && (
                        <button
                          style={{
                            ...sc.shiftOpt,
                            background: isSelected(dateStr, 'early')
                              ? 'rgba(42,127,98,0.25)'
                              : 'rgba(42,127,98,0.1)',
                            border: isSelected(dateStr, 'early')
                              ? '1px solid rgba(42,127,98,0.6)'
                              : '1px solid rgba(42,127,98,0.3)',
                            color: '#2a7f62',
                          }}
                          onClick={() =>
                            handleShiftSelect(
                              dateStr,
                              'early',
                              false,
                              isSameDay
                            )
                          }
                        >
                          <span style={sc.shiftOptType}>Early</span>
                          <span style={sc.shiftOptTime}>07:00–14:30</span>
                          {isSelected(dateStr, 'early') && (
                            <FontAwesomeIcon
                              icon='check'
                              style={{ marginLeft: 'auto', fontSize: '10px' }}
                            />
                          )}
                        </button>
                      )}
                      {shiftInfo.late && (
                        <button
                          style={{
                            ...sc.shiftOpt,
                            background: isSelected(dateStr, 'late')
                              ? 'rgba(122,79,168,0.25)'
                              : 'rgba(122,79,168,0.1)',
                            border: isSelected(dateStr, 'late')
                              ? '1px solid rgba(122,79,168,0.6)'
                              : '1px solid rgba(122,79,168,0.3)',
                            color: '#7a4fa8',
                          }}
                          onClick={() =>
                            handleShiftSelect(
                              dateStr,
                              'late',
                              shiftInfo.sleepIn,
                              isSameDay
                            )
                          }
                        >
                          <span style={sc.shiftOptType}>
                            Late{shiftInfo.sleepIn ? ' · Sleep-in' : ''}
                          </span>
                          <span style={sc.shiftOptTime}>14:00–23:00</span>
                          {isSelected(dateStr, 'late') && (
                            <FontAwesomeIcon
                              icon='check'
                              style={{ marginLeft: 'auto', fontSize: '10px' }}
                            />
                          )}
                        </button>
                      )}
                    </>
                  )}

                  {/* Same day — no published shift for Staff B yet */}
                  {isSameDay && !shiftInfo && !hasLeave && (
                    <>
                      <button
                        style={{
                          ...sc.shiftOpt,
                          background: isSelected(dateStr, 'early')
                            ? 'rgba(108,143,255,0.2)'
                            : 'rgba(108,143,255,0.07)',
                          border: isSelected(dateStr, 'early')
                            ? '1px solid rgba(108,143,255,0.5)'
                            : '1px solid rgba(108,143,255,0.2)',
                          color: '#6c8fff',
                        }}
                        onClick={() =>
                          handleShiftSelect(dateStr, 'early', false, true)
                        }
                      >
                        <span style={sc.shiftOptType}>Early</span>
                        <span style={sc.shiftOptTime}>07:00–14:30</span>
                        {isSelected(dateStr, 'early') && (
                          <FontAwesomeIcon
                            icon='check'
                            style={{ marginLeft: 'auto', fontSize: '10px' }}
                          />
                        )}
                      </button>
                      <button
                        style={{
                          ...sc.shiftOpt,
                          background: isSelected(dateStr, 'late')
                            ? 'rgba(108,143,255,0.2)'
                            : 'rgba(108,143,255,0.07)',
                          border: isSelected(dateStr, 'late')
                            ? '1px solid rgba(108,143,255,0.5)'
                            : '1px solid rgba(108,143,255,0.2)',
                          color: '#6c8fff',
                        }}
                        onClick={() =>
                          handleShiftSelect(dateStr, 'late', false, true)
                        }
                      >
                        <span style={sc.shiftOptType}>Late</span>
                        <span style={sc.shiftOptTime}>14:00–23:00</span>
                        {isSelected(dateStr, 'late') && (
                          <FontAwesomeIcon
                            icon='check'
                            style={{ marginLeft: 'auto', fontSize: '10px' }}
                          />
                        )}
                      </button>
                    </>
                  )}

                  {/* Same day — Staff B on leave, offer shift options anyway */}
                  {isSameDay && hasLeave && !shiftInfo && (
                    <>
                      <button
                        style={{
                          ...sc.shiftOpt,
                          background: isSelected(dateStr, 'early')
                            ? 'rgba(196,136,58,0.2)'
                            : 'rgba(196,136,58,0.08)',
                          border: isSelected(dateStr, 'early')
                            ? '1px solid rgba(196,136,58,0.5)'
                            : '1px solid rgba(196,136,58,0.25)',
                          color: '#c4883a',
                        }}
                        onClick={() =>
                          handleShiftSelect(dateStr, 'early', false, true)
                        }
                      >
                        <span style={sc.shiftOptType}>Early (leave day)</span>
                        <span style={sc.shiftOptTime}>07:00–14:30</span>
                      </button>
                      <button
                        style={{
                          ...sc.shiftOpt,
                          background: isSelected(dateStr, 'late')
                            ? 'rgba(196,136,58,0.2)'
                            : 'rgba(196,136,58,0.08)',
                          border: isSelected(dateStr, 'late')
                            ? '1px solid rgba(196,136,58,0.5)'
                            : '1px solid rgba(196,136,58,0.25)',
                          color: '#c4883a',
                        }}
                        onClick={() =>
                          handleShiftSelect(dateStr, 'late', false, true)
                        }
                      >
                        <span style={sc.shiftOptType}>Late (leave day)</span>
                        <span style={sc.shiftOptTime}>14:00–23:00</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={sc.legend}>
        <span style={{ ...sc.legendItem, color: '#6c8fff' }}>■ Same day</span>
        <span style={{ ...sc.legendItem, color: '#2a7f62' }}>■ Early</span>
        <span style={{ ...sc.legendItem, color: '#7a4fa8' }}>■ Late</span>
        <span style={{ ...sc.legendItem, color: '#c4883a' }}>■ Leave</span>
        <span style={sc.legendItem}>
          <span style={{ color: '#2a7f62' }}>■</span>
          <span style={{ color: '#7a4fa8' }}>■</span> Both
        </span>
      </div>
    </div>
  )
}

const sc = {
  wrap: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '14px',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  navBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#9499b0',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '13px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  dayHeaders: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    marginBottom: '4px',
  },
  dayHead: {
    fontSize: '10px',
    color: '#5d6180',
    textAlign: 'center',
    fontWeight: 500,
    padding: '2px 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px',
  },
  cell: {
    borderRadius: '6px',
    padding: '4px 2px',
    minHeight: '36px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    transition: 'background 0.1s',
  },
  dateNum: {
    fontSize: '11px',
    fontFamily: 'DM Mono, monospace',
  },
  dot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
    marginTop: '2px',
  },
  splitDotWrap: {
    display: 'flex',
    gap: '2px',
    marginTop: '2px',
  },
  splitDot: {
    width: '4px',
    height: '4px',
    borderRadius: '50%',
  },
  picker: {
    position: 'absolute',
    top: '42px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '10px',
    zIndex: 50,
    minWidth: '168px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  pickerDate: {
    fontSize: '11px',
    color: '#9499b0',
    fontWeight: 500,
    marginBottom: '2px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  sameDayTag: {
    fontSize: '10px',
    color: '#6c8fff',
    background: 'rgba(108,143,255,0.12)',
    border: '1px solid rgba(108,143,255,0.25)',
    borderRadius: '4px',
    padding: '1px 5px',
  },
  leaveTag: {
    fontSize: '11px',
    color: '#c4883a',
    background: 'rgba(196,136,58,0.1)',
    border: '1px solid rgba(196,136,58,0.2)',
    borderRadius: '6px',
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  shiftOpt: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderRadius: '7px',
    padding: '7px 10px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    width: '100%',
    textAlign: 'left',
  },
  shiftOptType: {
    fontSize: '12px',
    fontWeight: 500,
  },
  shiftOptTime: {
    fontSize: '11px',
    fontFamily: 'DM Mono, monospace',
    opacity: 0.7,
  },
  legend: {
    display: 'flex',
    gap: '12px',
    marginTop: '10px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  legendItem: {
    fontSize: '10px',
    color: '#5d6180',
  },
}
