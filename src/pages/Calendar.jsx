import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLocalStorage } from '../hooks/useLocalStorage'
import {
  getWeekDates,
  formatDate,
  formatShort,
  getMondayOfWeek,
  addWeeks,
  getMonthDates,
  getYearMonths,
  isSameDay,
  dateKey,
  getGeneratorMondayKey,
} from '../utils/dateUtils'
import {
  addRequest,
  updateRequest,
  getShiftRequest,
  loadRequests,
  getRecentRequestWarning,
  pingRequest,
  getPingInfo,
} from '../utils/cancelRequests'
import {
  getTimeOffForStaff,
  addTimeOff,
  generateTimeOffId,
} from '../utils/timeOffStorage'
import LeaveCalendar from '../components/shared/LeaveCalendar'

const TODAY = new Date()
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Calendar() {
  const { user } = useAuth()
  const [monthRota] = useLocalStorage('rotapp_month_rota', {})
  const [weekRotaState, setWeekRota] = useLocalStorage('rotapp_week_rota', {
    early: Array(7).fill([]),
    late: Array(7).fill([]),
    onCall: Array(7).fill([]),
  })

  // View state
  const [viewMode, setViewMode] = useState('week')
  const [currentMonday, setMonday] = useState(getMondayOfWeek(TODAY))
  const [currentYear, setCurrentYear] = useState(TODAY.getFullYear())
  const [hoveredMonth, setHoveredMonth] = useState(null)

  // Shift cancel modal states
  const [selectedShift, setSelectedShift] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [customReasonText, setCustomReasonText] = useState('')
  const [showReasonForm, setShowReasonForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Time-off request modal
  const [showTimeOffModal, setShowTimeOffModal] = useState(false)
  const [timeOffType, setTimeOffType] = useState('annual_leave')
  const [timeOffSelectedDates, setTimeOffSelectedDates] = useState([])
  const [timeOffNote, setTimeOffNote] = useState('')
  const [timeOffRefresh, setTimeOffRefresh] = useState(0)
  const [timeOffSubmitted, setTimeOffSubmitted] = useState(false)

  const staffId = user?.id
  const staffName = user?.name

  const currentWeekKey = getGeneratorMondayKey(currentMonday)
  const currentWeekRota = monthRota[currentWeekKey] || weekRotaState

  const myShiftsForWeek = useMemo(() => {
    const shifts = []
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const date = new Date(currentMonday)
      date.setDate(currentMonday.getDate() + dayIdx)
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`

      const earlyStaff = currentWeekRota.early?.[dayIdx] || []
      const myEarly = earlyStaff.find((s) => s.id === staffId)
      if (myEarly) {
        shifts.push({
          date: dateStr,
          day: dayIdx,
          dayName: DAYS[dayIdx],
          type: 'early',
          sleepIn: false,
          home: user?.home || 'Meadowview House',
        })
      }

      const lateStaff = currentWeekRota.late?.[dayIdx] || []
      const myLate = lateStaff.find((s) => s.id === staffId)
      if (myLate) {
        shifts.push({
          date: dateStr,
          day: dayIdx,
          dayName: DAYS[dayIdx],
          type: 'late',
          sleepIn: myLate.sleepIn || false,
          home: user?.home || 'Meadowview House',
        })
      }
    }
    return shifts
  }, [currentWeekRota, currentMonday, staffId, user?.home])

  const getShiftForDay = (date) => myShiftsForWeek.find((s) => s.date === date)

  const getShiftRequestStatus = (shift) => {
    if (!shift || !staffId) return null
    const requests = loadRequests()
    return requests.find(
      (r) =>
        r.staffId === staffId &&
        r.shiftDate === shift.date &&
        r.shiftType === shift.type
    )
  }

  // Time-off helpers — re-reads on timeOffRefresh
  const myTimeOff = useMemo(
    () => getTimeOffForStaff(staffId || ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staffId, timeOffRefresh]
  )
  const getTimeOffForDateStr = (dateStr) =>
    myTimeOff.filter((e) => e.date === dateStr)

  // Navigation
  const prevWeek = () => setMonday((prev) => addWeeks(prev, -1))
  const nextWeek = () => setMonday((prev) => addWeeks(prev, 1))
  const weekDates = getWeekDates(currentMonday)
  const startLabel = formatDate(weekDates[0])
  const endLabel = formatDate(weekDates[6])

  const handleWithdraw = (requestId) => {
    updateRequest(requestId, {
      status: 'withdrawn',
      withdrawnAt: new Date().toISOString(),
    })
    setSelectedShift(null)
  }

  const handleSubmitRequest = () => {
    if (!cancelReason) return
    if (cancelReason === 'Other' && !customReasonText.trim()) return
    setSubmitting(true)
    addRequest({
      staffId,
      staffName,
      shiftDate: selectedShift.date,
      shiftType: selectedShift.type,
      reason: cancelReason,
      customReason: cancelReason === 'Other' ? customReasonText : '',
    })
    setTimeout(() => {
      setSelectedShift(null)
      setCancelReason('')
      setCustomReasonText('')
      setShowReasonForm(false)
      setSubmitting(false)
    }, 500)
  }

  const handleSubmitTimeOff = () => {
    if (timeOffSelectedDates.length === 0) return
    timeOffSelectedDates.forEach((dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number)
      addTimeOff(new Date(y, m - 1, d), {
        id: generateTimeOffId(),
        staffId,
        staffName,
        type: timeOffType,
        status: 'pending',
        notes: timeOffNote || null,
        requestedAt: new Date().toISOString(),
      })
    })
    setTimeOffRefresh((n) => n + 1)
    setTimeOffSubmitted(true)
  }

  const closeTimeOffModal = () => {
    setShowTimeOffModal(false)
    setTimeOffSelectedDates([])
    setTimeOffNote('')
    setTimeOffType('annual_leave')
    setTimeOffSubmitted(false)
  }

  const getRotaForDate = (date) => {
    const monday = getMondayOfWeek(date)
    const key = dateKey(monday)
    return monthRota[key] || null
  }

  const hasShiftOnDate = (date, staffId) => {
    const rota = getRotaForDate(date)
    if (!rota) return false
    const dayOfWeek = (date.getDay() + 6) % 7
    const earlyHas = (rota.early?.[dayOfWeek] || []).some(
      (s) => s.id === staffId
    )
    const lateHas = (rota.late?.[dayOfWeek] || []).some((s) => s.id === staffId)
    return earlyHas || lateHas
  }

  const yearMonths = useMemo(() => getYearMonths(currentYear), [currentYear])

  const handleMonthClick = (year, month) => {
    const firstOfMonth = new Date(year, month, 1)
    setMonday(getMondayOfWeek(firstOfMonth))
    setCurrentYear(year)
    setViewMode('week')
  }

  return (
    <div style={s.page}>
      <Navbar />

      <div style={s.body}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.title}>My Schedule</h1>
            <p style={s.subtitle}>
              {viewMode === 'week'
                ? `${startLabel} – ${endLabel}`
                : `${currentYear}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              style={s.requestTimeOffBtn}
              onClick={() => setShowTimeOffModal(true)}
            >
              <FontAwesomeIcon icon='calendar-plus' /> Request time off
            </button>
            <div style={s.viewToggle}>
              {[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ].map((v) => (
                <button
                  key={v.value}
                  style={{
                    ...s.toggleBtn,
                    background:
                      viewMode === v.value ? '#6c8fff' : 'transparent',
                    color: viewMode === v.value ? '#fff' : '#9499b0',
                  }}
                  onClick={() => setViewMode(v.value)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* WEEK VIEW */}
        {viewMode === 'week' && (
          <>
            <div style={s.weekNav}>
              <button style={s.navArrow} onClick={prevWeek}>
                <FontAwesomeIcon icon='chevron-left' />
              </button>
              <span style={s.weekLabel}>{`${startLabel} – ${endLabel}`}</span>
              <button style={s.navArrow} onClick={nextWeek}>
                <FontAwesomeIcon icon='chevron-right' />
              </button>
              <button
                style={s.todayBtn}
                onClick={() => setMonday(getMondayOfWeek(TODAY))}
              >
                Today
              </button>
            </div>

            <div style={s.gridWrap}>
              <div style={s.grid}>
                {/* Header row */}
                <div style={s.colLabel} />
                {DAYS.map((day, i) => {
                  const date = weekDates[i]
                  const isToday = isSameDay(date, TODAY)
                  return (
                    <div
                      key={i}
                      style={{
                        ...s.dayHeader,
                        background: isToday
                          ? 'rgba(108,143,255,0.06)'
                          : 'transparent',
                      }}
                    >
                      <div
                        style={{
                          ...s.dayName,
                          color: isToday ? '#6c8fff' : '#9499b0',
                        }}
                      >
                        {day}
                      </div>
                      <div
                        style={{
                          ...s.dayDate,
                          color: isToday ? '#6c8fff' : '#e8eaf0',
                        }}
                      >
                        {formatShort(date)}
                      </div>
                    </div>
                  )
                })}

                {/* My Shifts row */}
                <div style={s.shiftLabel}>
                  <div style={s.shiftName}>My Shifts</div>
                  <div style={s.shiftTime}>Your assigned shifts</div>
                </div>
                {DAYS.map((_, dayIdx) => {
                  const date = weekDates[dayIdx]
                  const y2 = date.getFullYear()
                  const m2 = String(date.getMonth() + 1).padStart(2, '0')
                  const d2 = String(date.getDate()).padStart(2, '0')
                  const dateStr = `${y2}-${m2}-${d2}`
                  const shift = getShiftForDay(dateStr)
                  const shiftRequest = shift
                    ? getShiftRequestStatus(shift)
                    : null
                  const isPending = shiftRequest?.status === 'pending'
                  const isApproved = shiftRequest?.status === 'approved'
                  const timeOffEntries = getTimeOffForDateStr(dateStr)

                  return (
                    <div
                      key={dayIdx}
                      style={{
                        ...s.cell,
                        cursor: shift ? 'pointer' : 'default',
                      }}
                      onClick={() => shift && setSelectedShift(shift)}
                    >
                      {/* Leave badges — always shown when present, regardless of shift */}
                      {timeOffEntries.map((e) => (
                        <div
                          key={e.id}
                          style={{
                            ...s.timeOffBadge,
                            background:
                              e.status === 'pending'
                                ? 'rgba(196,136,58,0.15)'
                                : 'rgba(108,143,255,0.12)',
                            color:
                              e.status === 'pending' ? '#c4883a' : '#6c8fff',
                            border:
                              e.status === 'pending'
                                ? '1px solid rgba(196,136,58,0.3)'
                                : '1px solid rgba(108,143,255,0.25)',
                          }}
                        >
                          <FontAwesomeIcon
                            icon='umbrella-beach'
                            style={{ marginRight: '4px' }}
                          />
                          {e.status === 'pending'
                            ? 'Leave pending'
                            : 'On leave'}
                        </div>
                      ))}

                      {/* Shift or off-day content */}
                      {isApproved ? (
                        <div style={s.cancelledTag}>Cancelled</div>
                      ) : shift ? (
                        <div
                          style={{
                            ...s.shiftCard,
                            background: isPending
                              ? 'rgba(196,136,58,0.15)'
                              : shift.type === 'early'
                                ? 'rgba(42,127,98,0.15)'
                                : 'rgba(122,79,168,0.15)',
                            border: isPending
                              ? '1px solid rgba(196,136,58,0.35)'
                              : shift.type === 'early'
                                ? '1px solid rgba(42,127,98,0.35)'
                                : '1px solid rgba(122,79,168,0.35)',
                          }}
                        >
                          <div
                            style={{
                              ...s.shiftType,
                              color: isPending
                                ? '#c4883a'
                                : shift.type === 'early'
                                  ? '#2a7f62'
                                  : '#7a4fa8',
                            }}
                          >
                            {shift.type === 'early' ? 'Early' : 'Late'}
                            {shift.sleepIn && ' · 💤 Sleep-in'}
                            {isPending && ' · ⏳ Pending'}
                          </div>
                          <div style={s.shiftTime}>
                            {shift.type === 'early'
                              ? '07:00–14:30'
                              : '14:00–23:00'}
                          </div>
                          <div style={s.shiftHome}>{shift.home}</div>
                        </div>
                      ) : (
                        <div style={s.offDay}>
                          {timeOffEntries.length === 0 && '—'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* MONTH VIEW */}
        {viewMode === 'month' && (
          <>
            <div style={s.monthNav}>
              <button
                style={s.navArrow}
                onClick={() => setCurrentYear((y) => y - 1)}
              >
                <FontAwesomeIcon icon='chevron-left' />
              </button>
              <span style={s.weekLabel}>{currentYear}</span>
              <button
                style={s.navArrow}
                onClick={() => setCurrentYear((y) => y + 1)}
              >
                <FontAwesomeIcon icon='chevron-right' />
              </button>
              <button
                style={s.todayBtn}
                onClick={() => {
                  setCurrentYear(TODAY.getFullYear())
                  setMonday(getMondayOfWeek(TODAY))
                }}
              >
                Today
              </button>
            </div>

            <div style={s.yearWrap}>
              {yearMonths.map(({ year, month, label }) => {
                const monthDates = getMonthDates(year, month)
                const isHovered = hoveredMonth === `${year}-${month}`
                let shiftCount = 0
                monthDates.forEach((date) => {
                  if (
                    date.getMonth() === month &&
                    hasShiftOnDate(date, staffId)
                  ) {
                    shiftCount++
                  }
                })

                return (
                  <div
                    key={`${year}-${month}`}
                    style={{
                      ...s.miniMonth,
                      border:
                        shiftCount > 0
                          ? '1px solid rgba(108,143,255,0.3)'
                          : '1px solid rgba(255,255,255,0.06)',
                      background:
                        shiftCount > 0 ? 'rgba(108,143,255,0.04)' : '#161820',
                      transform: isHovered
                        ? 'translateY(-3px)'
                        : 'translateY(0)',
                      boxShadow: isHovered
                        ? '0 8px 24px rgba(0,0,0,0.35)'
                        : '0 1px 4px rgba(0,0,0,0.15)',
                    }}
                    onMouseEnter={() => setHoveredMonth(`${year}-${month}`)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    onClick={() => handleMonthClick(year, month)}
                  >
                    <div style={s.miniMonthHeader}>
                      <div style={s.miniMonthTitle}>{label}</div>
                      {shiftCount > 0 && (
                        <span style={s.shiftCountBadge}>
                          {shiftCount} shift{shiftCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div style={s.miniDayHeaders}>
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <div key={i} style={s.miniDayHead}>
                          {d}
                        </div>
                      ))}
                    </div>

                    <div style={s.miniGrid}>
                      {monthDates.map((date, i) => {
                        const inMonth = date.getMonth() === month
                        const isToday = isSameDay(date, TODAY)
                        const hasShift =
                          inMonth && hasShiftOnDate(date, staffId)
                        return (
                          <div
                            key={i}
                            style={{
                              ...s.miniCell,
                              opacity: inMonth ? 1 : 0,
                              background: hasShift
                                ? 'rgba(108,143,255,0.25)'
                                : 'transparent',
                              border: isToday
                                ? '1.5px solid #6c8fff'
                                : hasShift
                                  ? '1px solid rgba(108,143,255,0.4)'
                                  : '1px solid rgba(255,255,255,0.04)',
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!inMonth) return
                              setMonday(getMondayOfWeek(date))
                              setCurrentYear(year)
                              setViewMode('week')
                            }}
                          >
                            <span
                              style={{
                                ...s.miniDateNum,
                                color: isToday
                                  ? '#6c8fff'
                                  : hasShift
                                    ? '#6c8fff'
                                    : inMonth
                                      ? '#5d6180'
                                      : 'transparent',
                                fontWeight: hasShift ? 600 : 400,
                              }}
                            >
                              {date.getDate()}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Shift detail modal */}
      {selectedShift && (
        <div
          style={s.overlay}
          onClick={() => {
            setSelectedShift(null)
            setShowReasonForm(false)
            setCancelReason('')
            setCustomReasonText('')
          }}
        >
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>Shift Details</div>
              <button
                style={s.closeBtn}
                onClick={() => {
                  setSelectedShift(null)
                  setShowReasonForm(false)
                  setCancelReason('')
                  setCustomReasonText('')
                }}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>

            <div style={s.modalBody}>
              <div style={s.detailRow}>
                <span style={s.detailLabel}>Day</span>
                <span style={s.detailVal}>
                  {selectedShift.dayName}, {selectedShift.date}
                </span>
              </div>
              <div style={s.detailRow}>
                <span style={s.detailLabel}>Shift</span>
                <span
                  style={{
                    ...s.detailVal,
                    color:
                      selectedShift.type === 'early' ? '#2a7f62' : '#7a4fa8',
                    textTransform: 'capitalize',
                  }}
                >
                  {selectedShift.type}
                </span>
              </div>
              <div style={s.detailRow}>
                <span style={s.detailLabel}>Time</span>
                <span style={s.detailVal}>
                  {selectedShift.type === 'early'
                    ? '07:00–14:30'
                    : '14:00–23:00'}
                </span>
              </div>
              <div style={s.detailRow}>
                <span style={s.detailLabel}>Home</span>
                <span style={s.detailVal}>{selectedShift.home}</span>
              </div>
              {selectedShift.sleepIn && (
                <div style={s.detailRow}>
                  <span style={s.detailLabel}>Sleep-in</span>
                  <span style={{ ...s.detailVal, color: '#c4883a' }}>
                    💤 Yes
                  </span>
                </div>
              )}
              <div style={s.detailRow}>
                <span style={s.detailLabel}>Status</span>
                {(() => {
                  const request = getShiftRequestStatus(selectedShift)
                  if (request?.status === 'pending')
                    return (
                      <span style={{ ...s.detailVal, color: '#c4883a' }}>
                        ⏳ Cancellation requested
                      </span>
                    )
                  if (request?.status === 'approved')
                    return (
                      <span style={{ ...s.detailVal, color: '#e85c3d' }}>
                        ✗ Cancelled (approved)
                      </span>
                    )
                  if (request?.status === 'rejected')
                    return (
                      <span style={{ ...s.detailVal, color: '#9499b0' }}>
                        Cancellation rejected
                      </span>
                    )
                  if (request?.status === 'withdrawn')
                    return (
                      <span style={{ ...s.detailVal, color: '#2ecc8a' }}>
                        ✓ Confirmed (request withdrawn)
                      </span>
                    )
                  return (
                    <span style={{ ...s.detailVal, color: '#2ecc8a' }}>
                      ✓ Confirmed
                    </span>
                  )
                })()}
              </div>
              {(() => {
                const request = getShiftRequestStatus(selectedShift)
                if (request?.status === 'rejected' && request.rejectionReason) {
                  return (
                    <div style={s.detailRow}>
                      <span style={s.detailLabel}>Rejection reason</span>
                      <span
                        style={{
                          ...s.detailVal,
                          color: '#e85c3d',
                          fontSize: '12px',
                        }}
                      >
                        {request.rejectionReason}
                      </span>
                    </div>
                  )
                }
                return null
              })()}
            </div>

            {(() => {
              const request = getShiftRequestStatus(selectedShift)
              if (request?.status === 'pending') {
                const pingInfo = getPingInfo(request)
                return (
                  <>
                    <div style={s.pendingWarning}>
                      <FontAwesomeIcon icon='clock' /> Cancellation request
                      pending manager approval
                    </div>
                    {pingInfo.lastPingedAt && (
                      <div style={s.lastPingInfo}>
                        <FontAwesomeIcon icon='paper-plane' /> Last pinged:{' '}
                        {new Date(pingInfo.lastPingedAt).toLocaleString()}
                      </div>
                    )}
                    <div style={s.buttonGroup}>
                      <button
                        style={s.withdrawBtn}
                        onClick={() => handleWithdraw(request.id)}
                      >
                        Withdraw request
                      </button>
                      {pingInfo.canPing ? (
                        <button
                          style={s.pingBtn}
                          onClick={() => {
                            const updated = pingRequest(request.id, staffId)
                            if (updated) {
                              setSelectedShift({ ...selectedShift })
                              alert(
                                `Ping sent! (${pingInfo.remainingPings - 1} pings remaining)`
                              )
                            }
                          }}
                        >
                          <FontAwesomeIcon icon='bell' /> Ping (
                          {pingInfo.remainingPings})
                        </button>
                      ) : (
                        <button style={s.pingBtnDisabled} disabled>
                          <FontAwesomeIcon icon='bell-slash' /> Ping limit
                          reached
                        </button>
                      )}
                    </div>
                  </>
                )
              }
              if (request?.status === 'approved') return null
              if (!showReasonForm) {
                return (
                  <button
                    style={s.cancelShiftBtn}
                    onClick={() => setShowReasonForm(true)}
                  >
                    Request cancellation
                  </button>
                )
              }
              const { shouldWarn, message } = getRecentRequestWarning(
                staffId,
                selectedShift.date,
                selectedShift.type
              )
              return (
                <div style={s.reasonForm}>
                  {shouldWarn && (
                    <div style={s.warningNoteInline}>
                      <FontAwesomeIcon icon='triangle-exclamation' /> {message}
                    </div>
                  )}
                  <div style={s.reasonLabel}>Reason for cancellation:</div>
                  <select
                    style={s.reasonSelect}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  >
                    <option value=''>Select a reason...</option>
                    <option value='Sick'>🤒 Sick</option>
                    <option value='Family emergency'>
                      🏠 Family emergency
                    </option>
                    <option value='Transport issue'>🚗 Transport issue</option>
                    <option value='Other'>📝 Other (please specify)</option>
                  </select>
                  {cancelReason === 'Other' && (
                    <textarea
                      style={s.reasonTextarea}
                      placeholder='Please specify your reason...'
                      value={customReasonText}
                      onChange={(e) => setCustomReasonText(e.target.value)}
                      rows='3'
                    />
                  )}
                  <div style={s.reasonActions}>
                    <button
                      style={s.cancelReasonBtn}
                      onClick={() => {
                        setShowReasonForm(false)
                        setCancelReason('')
                        setCustomReasonText('')
                      }}
                    >
                      Back
                    </button>
                    <button
                      style={{
                        ...s.submitReasonBtn,
                        opacity:
                          !cancelReason ||
                          (cancelReason === 'Other' && !customReasonText.trim())
                            ? 0.5
                            : 1,
                        cursor:
                          !cancelReason ||
                          (cancelReason === 'Other' && !customReasonText.trim())
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                      disabled={
                        !cancelReason ||
                        (cancelReason === 'Other' && !customReasonText.trim())
                      }
                      onClick={handleSubmitRequest}
                    >
                      {submitting ? 'Submitting...' : 'Submit request'}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Time-off request modal */}
      {showTimeOffModal && (
        <div style={s.overlay} onClick={closeTimeOffModal}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>Request Time Off</div>
              <button style={s.closeBtn} onClick={closeTimeOffModal}>
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>

            {timeOffSubmitted ? (
              <div style={s.confirmWrap}>
                <div style={s.confirmIcon}>
                  <FontAwesomeIcon icon='circle-check' />
                </div>
                <div style={s.confirmTitle}>Request submitted</div>
                <div style={s.confirmBody}>
                  Your manager has been notified and will review your request.
                  You'll see a pending badge on your calendar until it's
                  approved.
                </div>
                <button style={s.submitReasonBtn} onClick={closeTimeOffModal}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div style={s.modalBody}>
                  <p style={s.modalNote}>
                    Tap days below to select. Days with existing leave are not
                    available.
                  </p>

                  <LeaveCalendar
                    staffId={staffId}
                    selectedDates={timeOffSelectedDates}
                    onSelectionChange={setTimeOffSelectedDates}
                  />

                  <div style={s.field}>
                    <label style={s.detailLabel}>Leave type</label>
                    <select
                      style={{ ...s.reasonSelect, marginTop: '6px' }}
                      value={timeOffType}
                      onChange={(e) => setTimeOffType(e.target.value)}
                    >
                      <option value='annual_leave'>Annual leave</option>
                      <option value='sick'>Sick</option>
                      <option value='training'>Training</option>
                      <option value='other'>Other</option>
                    </select>
                  </div>

                  <div style={s.field}>
                    <label style={s.detailLabel}>Note (optional)</label>
                    <input
                      style={{ ...s.reasonSelect, marginTop: '6px' }}
                      type='text'
                      placeholder='e.g. holiday, appointment'
                      value={timeOffNote}
                      onChange={(e) => setTimeOffNote(e.target.value)}
                    />
                  </div>
                </div>

                <div style={s.reasonActions}>
                  <button style={s.cancelReasonBtn} onClick={closeTimeOffModal}>
                    Cancel
                  </button>
                  <button
                    style={{
                      ...s.submitReasonBtn,
                      opacity: timeOffSelectedDates.length > 0 ? 1 : 0.5,
                      cursor:
                        timeOffSelectedDates.length > 0
                          ? 'pointer'
                          : 'not-allowed',
                    }}
                    disabled={timeOffSelectedDates.length === 0}
                    onClick={handleSubmitTimeOff}
                  >
                    Submit request
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0f1117',
    color: '#e8eaf0',
    fontFamily: 'DM Sans, sans-serif',
  },
  body: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  title: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '22px',
    fontWeight: 600,
    margin: 0,
  },
  subtitle: { fontSize: '13px', color: '#9499b0', marginTop: '4px' },
  requestTimeOffBtn: {
    background: 'rgba(108,143,255,0.12)',
    border: '1px solid rgba(108,143,255,0.25)',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#6c8fff',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
  },
  viewToggle: {
    display: 'flex',
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '3px',
    gap: '2px',
  },
  toggleBtn: {
    border: 'none',
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    transition: 'all 0.15s',
  },
  weekNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  monthNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  navArrow: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '7px',
    color: '#9499b0',
    width: '32px',
    height: '32px',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#e8eaf0',
    minWidth: '180px',
    textAlign: 'center',
    fontFamily: 'Syne, sans-serif',
  },
  todayBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '7px',
    color: '#9499b0',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  gridWrap: { overflowX: 'auto' },
  grid: {
    display: 'grid',
    gridTemplateColumns: '120px repeat(7, 1fr)',
    minWidth: '700px',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px',
    overflow: 'visible',
  },
  colLabel: {
    background: '#1d1f2b',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
  },
  dayHeader: {
    padding: '10px 8px',
    textAlign: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    borderRight: '1px solid rgba(255,255,255,0.05)',
  },
  dayName: { fontSize: '11px', fontWeight: 500, textTransform: 'uppercase' },
  dayDate: {
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'Syne, sans-serif',
    marginTop: '2px',
  },
  shiftLabel: {
    padding: '12px 14px',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    background: '#1d1f2b',
  },
  shiftName: { fontSize: '12px', fontWeight: 600, color: '#e8eaf0' },
  shiftTime: {
    fontSize: '10px',
    color: '#5d6180',
    marginTop: '2px',
    fontFamily: 'DM Mono, monospace',
  },
  cell: {
    padding: '8px',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    minHeight: '80px',
  },
  shiftCard: { borderRadius: '8px', padding: '8px', height: '100%' },
  shiftType: { fontSize: '12px', fontWeight: 600 },
  shiftHome: { fontSize: '11px', color: '#5d6180', marginTop: '4px' },
  offDay: {
    fontSize: '12px',
    color: '#5d6180',
    textAlign: 'center',
    marginTop: '8px',
  },
  timeOffBadge: {
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    marginBottom: '3px',
  },
  cancelledTag: {
    fontSize: '11px',
    color: '#e85c3d',
    background: 'rgba(232,92,61,0.1)',
    borderRadius: '6px',
    padding: '8px',
    textAlign: 'center',
  },
  yearWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
  },
  miniMonth: {
    borderRadius: '14px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
    position: 'relative',
  },
  miniMonthHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  miniMonthTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '13px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  shiftCountBadge: {
    fontSize: '10px',
    fontWeight: 500,
    padding: '2px 7px',
    borderRadius: '5px',
    background: 'rgba(108,143,255,0.15)',
    color: '#6c8fff',
  },
  miniDayHeaders: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    marginBottom: '4px',
  },
  miniDayHead: {
    fontSize: '9px',
    color: '#5d6180',
    textAlign: 'center',
    fontWeight: 500,
  },
  miniGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px',
  },
  miniCell: {
    aspectRatio: '1',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  miniDateNum: {
    fontSize: '9px',
    fontFamily: 'DM Mono, monospace',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '20px',
  },
  modal: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '460px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  modalTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '16px',
    fontWeight: 600,
  },
  closeBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#9499b0',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  modalBody: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
    flex: 1,
  },
  modalNote: {
    fontSize: '13px',
    color: '#9499b0',
    margin: 0,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: { fontSize: '13px', color: '#9499b0' },
  detailVal: { fontSize: '13px', fontWeight: 500, color: '#e8eaf0' },
  rangeInfo: {
    fontSize: '12px',
    color: '#6c8fff',
    background: 'rgba(108,143,255,0.08)',
    border: '1px solid rgba(108,143,255,0.15)',
    borderRadius: '6px',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
  },
  pendingWarning: {
    padding: '12px 24px',
    background: 'rgba(196,136,58,0.1)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    color: '#c4883a',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  lastPingInfo: {
    padding: '8px 24px',
    fontSize: '12px',
    color: '#9499b0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    padding: '12px 24px 16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  withdrawBtn: {
    flex: 1,
    background: 'rgba(232,92,61,0.1)',
    border: '1px solid rgba(232,92,61,0.25)',
    borderRadius: '8px',
    color: '#e85c3d',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  pingBtn: {
    flex: 1,
    background: 'rgba(108,143,255,0.12)',
    border: '1px solid rgba(108,143,255,0.3)',
    borderRadius: '8px',
    color: '#6c8fff',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  pingBtnDisabled: {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#5d6180',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'not-allowed',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  cancelShiftBtn: {
    width: '100%',
    background: 'rgba(232,92,61,0.1)',
    border: '1px solid rgba(232,92,61,0.25)',
    borderRadius: '8px',
    color: '#e85c3d',
    padding: '10px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '8px',
  },
  reasonForm: {
    padding: '16px 24px 20px 24px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  reasonLabel: { fontSize: '13px', fontWeight: 500, color: '#9499b0' },
  reasonSelect: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#e8eaf0',
    fontFamily: 'DM Sans, sans-serif',
    width: '100%',
    boxSizing: 'border-box',
  },
  reasonTextarea: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#e8eaf0',
    fontFamily: 'DM Sans, sans-serif',
    width: '100%',
    resize: 'vertical',
    minHeight: '70px',
    maxHeight: '120px',
    boxSizing: 'border-box',
  },
  reasonActions: {
    display: 'flex',
    gap: '8px',
    padding: '16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  cancelReasonBtn: {
    flex: 1,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#9499b0',
    padding: '8px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  submitReasonBtn: {
    flex: 1,
    background: '#6c8fff',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  warningNoteInline: {
    padding: '10px',
    background: 'rgba(196,136,58,0.08)',
    border: '1px solid rgba(196,136,58,0.2)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#c4883a',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  confirmWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '32px 24px',
    gap: '12px',
  },
  confirmIcon: {
    fontSize: '40px',
    color: '#2ecc8a',
  },
  confirmTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '17px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  confirmBody: {
    fontSize: '13px',
    color: '#9499b0',
    lineHeight: 1.6,
    maxWidth: '300px',
    marginBottom: '8px',
  },
}

export default Calendar
