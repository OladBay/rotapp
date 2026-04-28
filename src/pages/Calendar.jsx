import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRota } from '../context/RotaContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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
  getRecentRequestWarning,
  pingRequest,
  getPingInfo,
} from '../utils/cancelRequests'
import {
  createLeaveRequest,
  getLeaveDaysForStaff,
  getLeaveDayForDate,
} from '../utils/timeOffStorage'
import LeaveCalendar from '../components/shared/LeaveCalendar'
import { createPortal } from 'react-dom'
import { useTopBarInit } from '../hooks/useTopBarInit'
import styles from './Calendar.module.css'

const TODAY = new Date()
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Calendar() {
  const { user } = useAuth()
  const {
    monthRota,
    leaveDays,
    refreshLeave,
    cancelRequests,
    refreshCancels,
    homeName,
  } = useRota()

  const [weekRotaState] = useState({
    early: Array(7).fill([]),
    late: Array(7).fill([]),
    onCall: Array(7).fill([]),
  })

  // ── View state ──
  const [viewMode, setViewMode] = useState('week')
  const [currentMonday, setMonday] = useState(getMondayOfWeek(TODAY))
  const [currentYear, setCurrentYear] = useState(TODAY.getFullYear())
  const [hoveredMonth, setHoveredMonth] = useState(null)

  // ── Modals ──
  const [selectedShift, setSelectedShift] = useState(null)
  const [cancelledShiftDetail, setCancelledShiftDetail] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [customReasonText, setCustomReasonText] = useState('')
  const [cancelNote, setCancelNote] = useState('')
  const [showReasonForm, setShowReasonForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showTimeOffModal, setShowTimeOffModal] = useState(false)
  const [timeOffType, setTimeOffType] = useState('annual_leave')
  const [timeOffSelectedDates, setTimeOffSelectedDates] = useState([])
  const [timeOffNote, setTimeOffNote] = useState('')
  const [timeOffSubmitted, setTimeOffSubmitted] = useState(false)

  const staffId = user?.id
  const staffName = user?.name

  const currentWeekKey = getGeneratorMondayKey(currentMonday)
  const currentWeekRota = monthRota[currentWeekKey] || weekRotaState

  // ── Derived data ──
  const myLeaveDays = useMemo(
    () => getLeaveDaysForStaff(leaveDays, staffId || ''),
    [leaveDays, staffId]
  )

  // ── Rota helpers ──
  const getRotaForDate = useCallback(
    (date) => {
      const monday = getMondayOfWeek(date)
      const key = dateKey(monday)
      return monthRota[key] || null
    },
    [monthRota]
  )

  const getDateState = useCallback(
    (date, sid) => {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

      // Cancelled
      const isCancelled = cancelRequests.some(
        (r) =>
          r.staff_id === sid &&
          r.shift_date === dateStr &&
          r.status === 'approved'
      )
      if (isCancelled) return 'cancelled'

      // Leave
      const leaveDay = getLeaveDayForDate(leaveDays, sid, dateStr)
      if (leaveDay) {
        return leaveDay.status === 'pending' ? 'leave-pending' : 'leave'
      }

      // Rota shift
      const rota = getRotaForDate(date)
      if (!rota) return 'none'
      const dayOfWeek = (date.getDay() + 6) % 7
      const lateStaff = rota.late?.[dayOfWeek] || []
      const myLate = lateStaff.find((s) => s.id === sid)
      if (myLate) return myLate.sleepIn ? 'sleep-in' : 'late'
      const earlyStaff = rota.early?.[dayOfWeek] || []
      const onEarly = earlyStaff.some((s) => s.id === sid)
      if (onEarly) return 'early'
      return 'none'
    },
    [getRotaForDate, cancelRequests, leaveDays]
  )

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
      if (myEarly)
        shifts.push({
          date: dateStr,
          day: dayIdx,
          dayName: DAYS[dayIdx],
          type: 'early',
          sleepIn: false,
          home: user?.home || '',
        })
      const lateStaff = currentWeekRota.late?.[dayIdx] || []
      const myLate = lateStaff.find((s) => s.id === staffId)
      if (myLate)
        shifts.push({
          date: dateStr,
          day: dayIdx,
          dayName: DAYS[dayIdx],
          type: 'late',
          sleepIn: myLate.sleepIn || false,
          home: user?.home || '',
        })
    }
    return shifts
  }, [currentWeekRota, currentMonday, staffId, user?.home])

  // ── getDayState ────────────────────────────────────────────────────────
  const getDayState = useCallback(
    (dateStr) => {
      const shift = myShiftsForWeek.find((s) => s.date === dateStr) || null
      const shiftRequest =
        shift && staffId
          ? getShiftRequest(cancelRequests, staffId, shift.date, shift.type)
          : null
      const approvedCancel =
        cancelRequests.find(
          (r) =>
            r.staff_id === staffId &&
            r.shift_date === dateStr &&
            r.status === 'approved'
        ) || null
      const leaveDay = getLeaveDayForDate(leaveDays, staffId, dateStr)
      const leaveDayEntries = leaveDay ? [leaveDay] : []
      return {
        shift,
        shiftRequest,
        approvedCancel,
        timeOffEntries: leaveDayEntries,
        isPending: shiftRequest?.status === 'pending',
        isCancelled: !!approvedCancel,
      }
    },
    [myShiftsForWeek, cancelRequests, staffId, leaveDays]
  )

  // ── Navigation ──
  const prevWeek = () => setMonday((prev) => addWeeks(prev, -1))
  const nextWeek = () => setMonday((prev) => addWeeks(prev, 1))
  const weekDates = getWeekDates(currentMonday)
  const startLabel = formatDate(weekDates[0])
  const endLabel = formatDate(weekDates[6])

  useTopBarInit(
    'My Shifts',
    viewMode === 'week'
      ? `Your shifts for ${startLabel} – ${endLabel}`
      : `Your shifts for ${new Date().getFullYear()}`
  )
  const yearMonths = useMemo(() => getYearMonths(currentYear), [currentYear])

  const handleMonthClick = (year, month) => {
    const firstOfMonth = new Date(year, month, 1)
    setMonday(getMondayOfWeek(firstOfMonth))
    setCurrentYear(year)
    setViewMode('week')
  }

  // ── Cancel request handlers ──
  const handleWithdraw = async (requestId) => {
    await updateRequest(requestId, {
      status: 'withdrawn',
      withdrawnAt: new Date().toISOString(),
    })
    refreshCancels()
    setSelectedShift(null)
  }

  const handleSubmitRequest = async () => {
    if (!cancelReason) return
    if (cancelReason === 'Other' && !customReasonText.trim()) return
    setSubmitting(true)
    await addRequest(
      {
        staffId,
        staffName,
        shiftDate: selectedShift.date,
        shiftType: selectedShift.type,
        reason: cancelReason,
        customReason: cancelReason === 'Other' ? customReasonText : '',
        notes: cancelNote.trim() || null,
        homeId: user.home,
        orgId: user.org_id,
      },
      cancelRequests
    )
    refreshCancels()
    setTimeout(() => {
      setSelectedShift(null)
      setCancelReason('')
      setCustomReasonText('')
      setCancelNote('')
      setShowReasonForm(false)
      setSubmitting(false)
    }, 500)
  }

  // ── Time-off handlers ──
  const handleSubmitTimeOff = async () => {
    if (timeOffSelectedDates.length === 0) return
    await createLeaveRequest({
      orgId: user.org_id,
      homeId: user.home,
      staffId: user.id,
      staffName: user.name,
      dates: timeOffSelectedDates,
      type: timeOffType,
      notes: timeOffNote || null,
      status: 'pending',
    })
    refreshLeave()
    setTimeOffSubmitted(true)
  }

  const closeTimeOffModal = () => {
    setShowTimeOffModal(false)
    setTimeOffSelectedDates([])
    setTimeOffNote('')
    setTimeOffType('annual_leave')
    setTimeOffSubmitted(false)
  }

  const topBarSlot = document.getElementById('topbar-actions')

  return (
    <div className={styles.page}>
      {topBarSlot &&
        createPortal(
          <div className={styles.viewToggle}>
            {[
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ].map((v) => (
              <button
                key={v.value}
                className={`${styles.toggleBtn}${viewMode === v.value ? ` ${styles.toggleBtnActive}` : ''}`}
                onClick={() => setViewMode(v.value)}
              >
                {v.label}
              </button>
            ))}
          </div>,
          topBarSlot
        )}

      <div className={styles.body}>
        {/* Header */}

        {/* WEEK VIEW */}
        {viewMode === 'week' && (
          <>
            <div className={styles.weekNav}>
              <button className={styles.navArrow} onClick={prevWeek}>
                <FontAwesomeIcon icon='chevron-left' />
              </button>
              <span
                className={styles.weekLabel}
              >{`${startLabel} – ${endLabel}`}</span>
              <button className={styles.navArrow} onClick={nextWeek}>
                <FontAwesomeIcon icon='chevron-right' />
              </button>
              <button
                className={styles.todayBtn}
                onClick={() => setMonday(getMondayOfWeek(TODAY))}
              >
                Today
              </button>
            </div>

            <div className={styles.gridWrap}>
              <div className={styles.grid}>
                <div className={styles.colLabel} />
                {DAYS.map((day, i) => {
                  const date = weekDates[i]
                  const isToday = isSameDay(date, TODAY)
                  return (
                    <div
                      key={i}
                      className={styles.dayHeader}
                      style={{
                        background: isToday
                          ? 'var(--accent-bg)'
                          : 'transparent',
                      }}
                    >
                      <div
                        className={`${styles.dayName}${isToday ? ` ${styles.dayNameToday}` : ''}`}
                      >
                        {day}
                      </div>
                      <div
                        className={`${styles.dayDate}${isToday ? ` ${styles.dayDateToday}` : ''}`}
                      >
                        {formatShort(date)}
                      </div>
                    </div>
                  )
                })}

                <div className={styles.shiftLabel}>
                  <div className={styles.shiftName}>My Shifts</div>
                  <div className={styles.shiftTime}>Your assigned shifts</div>
                </div>

                {DAYS.map((_, dayIdx) => {
                  const date = weekDates[dayIdx]
                  const y2 = date.getFullYear()
                  const m2 = String(date.getMonth() + 1).padStart(2, '0')
                  const d2 = String(date.getDate()).padStart(2, '0')
                  const dateStr = `${y2}-${m2}-${d2}`
                  const {
                    shift,
                    approvedCancel,
                    timeOffEntries,
                    isPending,
                    isCancelled,
                  } = getDayState(dateStr)

                  return (
                    <div
                      key={dayIdx}
                      className={styles.cell}
                      style={{
                        cursor: shift || isCancelled ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (isCancelled) {
                          setCancelledShiftDetail({
                            date: dateStr,
                            dayName: DAYS[dayIdx],
                            type: approvedCancel.shift_type,
                            sleepIn: shift?.sleepIn || false,
                            home: shift?.home || user?.home || '',
                            cancelRecord: approvedCancel,
                          })
                          return
                        }
                        if (!shift) return
                        setSelectedShift(shift)
                      }}
                    >
                      {/* Leave badges */}
                      {timeOffEntries.map((e) => (
                        <div
                          key={e.id}
                          className={styles.timeOffBadge}
                          style={{
                            background:
                              e.status === 'pending'
                                ? 'var(--color-warning-bg)'
                                : 'var(--accent-bg)',
                            color:
                              e.status === 'pending'
                                ? 'var(--color-warning)'
                                : 'var(--accent)',
                            border:
                              e.status === 'pending'
                                ? '1px solid var(--color-warning-border)'
                                : '1px solid var(--accent-border)',
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

                      {/* Cancelled shift badge */}
                      {isCancelled ? (
                        <div className={styles.cancelledTag}>
                          <FontAwesomeIcon
                            icon='circle-xmark'
                            style={{ marginRight: '4px', fontSize: '10px' }}
                          />
                          Shift cancelled
                        </div>
                      ) : shift ? (
                        <div
                          className={styles.shiftCard}
                          style={{
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
                            className={styles.shiftType}
                            style={{
                              color: isPending
                                ? 'var(--color-warning)'
                                : shift.type === 'early'
                                  ? '#2a7f62'
                                  : '#7a4fa8',
                            }}
                          >
                            {shift.type === 'early' ? 'Early' : 'Late'}
                            {shift.sleepIn && ' · Sleep-in'}
                            {isPending && ' · Pending'}
                          </div>
                          <div className={styles.shiftTime}>
                            {shift.type === 'early'
                              ? '07:00–14:30'
                              : '14:00–23:00'}
                          </div>
                          <div className={styles.shiftHome}>
                            {homeName || '—'}
                          </div>
                        </div>
                      ) : (
                        <div className={styles.offDay}>
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
            <div className={styles.monthNav}>
              <button
                className={styles.navArrow}
                onClick={() => setCurrentYear((y) => y - 1)}
              >
                <FontAwesomeIcon icon='chevron-left' />
              </button>
              <span className={styles.weekLabel}>{currentYear}</span>
              <button
                className={styles.navArrow}
                onClick={() => setCurrentYear((y) => y + 1)}
              >
                <FontAwesomeIcon icon='chevron-right' />
              </button>
              <button
                className={styles.todayBtn}
                onClick={() => {
                  setCurrentYear(TODAY.getFullYear())
                  setMonday(getMondayOfWeek(TODAY))
                }}
              >
                Today
              </button>
            </div>

            {/* Legend */}
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span
                  className={`${styles.legendDot} ${styles.legendDotEarly}`}
                />
                Early shift
              </div>
              <div className={styles.legendItem}>
                <span
                  className={`${styles.legendDot} ${styles.legendDotLate}`}
                />
                Late shift
              </div>
              <div className={styles.legendItem}>
                <span
                  className={`${styles.legendDot} ${styles.legendDotSleepIn}`}
                />
                Sleep-in
              </div>
              <div className={styles.legendItem}>
                <span
                  className={`${styles.legendDot} ${styles.legendDotPending}`}
                />
                Cancellation pending
              </div>
              <div className={styles.legendItem}>
                <span
                  className={`${styles.legendDot} ${styles.legendDotCancelled}`}
                />
                Cancelled
              </div>
              <div className={styles.legendItem}>
                <span
                  className={`${styles.legendDot} ${styles.legendDotLeave}`}
                />
                On leave
              </div>
            </div>

            <div className={styles.yearWrap}>
              {yearMonths.map(({ year, month, label }) => {
                const monthDates = getMonthDates(year, month)
                const isHovered = hoveredMonth === `${year}-${month}`
                let shiftCount = 0
                monthDates.forEach((date) => {
                  if (
                    date.getMonth() === month &&
                    getDateState(date, staffId) !== 'none'
                  )
                    shiftCount++
                })

                return (
                  <div
                    key={`${year}-${month}`}
                    className={styles.miniMonth}
                    style={{
                      border:
                        shiftCount > 0
                          ? '1px solid var(--accent-border)'
                          : '1px solid var(--border-subtle)',
                      background:
                        shiftCount > 0
                          ? 'var(--accent-bg)'
                          : 'var(--bg-raised)',
                      transform: isHovered
                        ? 'translateY(-3px)'
                        : 'translateY(0)',
                      boxShadow: isHovered
                        ? 'var(--shadow-lg)'
                        : 'var(--shadow-sm)',
                    }}
                    onMouseEnter={() => setHoveredMonth(`${year}-${month}`)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    onClick={() => handleMonthClick(year, month)}
                  >
                    <div className={styles.miniMonthHeader}>
                      <div className={styles.miniMonthTitle}>{label}</div>
                      {shiftCount > 0 && (
                        <span className={styles.shiftCountBadge}>
                          {shiftCount} shift{shiftCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className={styles.miniDayHeaders}>
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <div key={i} className={styles.miniDayHead}>
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className={styles.miniGrid}>
                      {monthDates.map((date, i) => {
                        const inMonth = date.getMonth() === month
                        const isToday = isSameDay(date, TODAY)
                        const dateState = inMonth
                          ? getDateState(date, staffId)
                          : 'none'

                        const STATE_BG = {
                          early: 'rgba(42, 127, 98, 0.25)',
                          late: 'rgba(122, 79, 168, 0.25)',
                          'sleep-in': 'rgba(196, 136, 58, 0.25)',
                          'leave-pending': 'rgba(196, 136, 58, 0.15)',
                          cancelled: 'var(--color-danger-bg)',
                          leave: 'var(--accent-bg)',
                          none: 'transparent',
                        }
                        const STATE_BORDER = {
                          early: '1px solid rgba(42, 127, 98, 0.5)',
                          late: '1px solid rgba(122, 79, 168, 0.5)',
                          'sleep-in': '1px solid rgba(196, 136, 58, 0.5)',
                          'leave-pending': '1px solid rgba(196, 136, 58, 0.4)',
                          cancelled: '1px solid var(--color-danger-border)',
                          leave: '1px solid var(--accent-border)',
                          none: '1px solid var(--border-subtle)',
                        }
                        const STATE_COLOR = {
                          early: 'rgba(42, 127, 98, 0.9)',
                          late: '#7a4fa8',
                          'sleep-in': 'var(--color-warning)',
                          'leave-pending': 'var(--color-warning)',
                          cancelled: 'var(--color-danger)',
                          leave: 'var(--accent)',
                          none: 'var(--text-muted)',
                        }

                        return (
                          <div
                            key={i}
                            className={styles.miniCell}
                            style={{
                              opacity: inMonth ? 1 : 0,
                              background: STATE_BG[dateState],
                              border: isToday
                                ? '1.5px solid var(--accent)'
                                : STATE_BORDER[dateState],
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
                              className={styles.miniDateNum}
                              style={{
                                color: isToday
                                  ? 'var(--accent)'
                                  : inMonth
                                    ? STATE_COLOR[dateState]
                                    : 'transparent',
                                fontWeight: dateState !== 'none' ? 600 : 400,
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

      {/* ── Shift detail modal ── */}
      {selectedShift && (
        <div
          className={styles.overlay}
          onClick={() => {
            setSelectedShift(null)
            setShowReasonForm(false)
            setCancelReason('')
            setCustomReasonText('')
            setCancelNote('')
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Shift Details</div>
              <button
                className={styles.closeBtn}
                onClick={() => {
                  setSelectedShift(null)
                  setShowReasonForm(false)
                  setCancelReason('')
                  setCustomReasonText('')
                  setCancelNote('')
                }}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Day</span>
                <span className={styles.detailVal}>
                  {selectedShift.dayName}, {selectedShift.date}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Shift</span>
                <span
                  className={styles.detailVal}
                  style={{
                    color:
                      selectedShift.type === 'early' ? '#2a7f62' : '#7a4fa8',
                    textTransform: 'capitalize',
                  }}
                >
                  {selectedShift.type}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Time</span>
                <span className={styles.detailVal}>
                  {selectedShift.type === 'early'
                    ? '07:00–14:30'
                    : '14:00–23:00'}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Home</span>
                <span className={styles.detailVal}>{homeName || '—'}</span>
              </div>
              {selectedShift.sleepIn && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Sleep-in</span>
                  <span
                    className={styles.detailVal}
                    style={{ color: 'var(--color-warning)' }}
                  >
                    Yes
                  </span>
                </div>
              )}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Status</span>
                {(() => {
                  const request = getShiftRequest(
                    cancelRequests,
                    staffId,
                    selectedShift.date,
                    selectedShift.type
                  )
                  if (request?.status === 'pending')
                    return (
                      <span
                        className={styles.detailVal}
                        style={{ color: 'var(--color-warning)' }}
                      >
                        Cancellation requested
                      </span>
                    )
                  if (request?.status === 'rejected')
                    return (
                      <span
                        className={styles.detailVal}
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        Cancellation rejected
                      </span>
                    )
                  return (
                    <span
                      className={styles.detailVal}
                      style={{ color: 'var(--color-success)' }}
                    >
                      Confirmed
                    </span>
                  )
                })()}
              </div>
            </div>

            {/* Cancel request section */}
            {(() => {
              const request = getShiftRequest(
                cancelRequests,
                staffId,
                selectedShift.date,
                selectedShift.type
              )
              if (request?.status === 'pending') {
                const pingInfo = getPingInfo(request)
                return (
                  <>
                    <div className={styles.pendingWarning}>
                      <FontAwesomeIcon icon='clock' /> Cancellation request
                      pending manager approval
                    </div>
                    <div className={styles.buttonGroup}>
                      <button
                        className={styles.withdrawBtn}
                        onClick={() => handleWithdraw(request.id)}
                      >
                        Withdraw request
                      </button>
                      {pingInfo.canPing ? (
                        <button
                          className={styles.pingBtn}
                          onClick={async () => {
                            await pingRequest(
                              request.id,
                              staffId,
                              cancelRequests
                            )
                            refreshCancels()
                          }}
                        >
                          Ping ({pingInfo.remainingPings})
                        </button>
                      ) : (
                        <button className={styles.pingBtnDisabled} disabled>
                          Ping limit reached
                        </button>
                      )}
                    </div>
                  </>
                )
              }

              if (!showReasonForm) {
                return (
                  <div className={styles.cancelShiftWrap}>
                    <button
                      className={styles.cancelShiftBtn}
                      onClick={() => setShowReasonForm(true)}
                    >
                      Request cancellation
                    </button>
                  </div>
                )
              }

              const { shouldWarn, message } = getRecentRequestWarning(
                cancelRequests,
                staffId,
                selectedShift.date,
                selectedShift.type
              )
              return (
                <div className={styles.reasonForm}>
                  {shouldWarn && (
                    <div className={styles.warningNoteInline}>
                      <FontAwesomeIcon icon='triangle-exclamation' /> {message}
                    </div>
                  )}
                  <div className={styles.reasonLabel}>
                    Reason for cancellation:
                  </div>
                  <select
                    className={styles.reasonSelect}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  >
                    <option value=''>Select a reason...</option>
                    <option value='Sick'>Sick</option>
                    <option value='Family emergency'>Family emergency</option>
                    <option value='Transport issue'>Transport issue</option>
                    <option value='Other'>Other (please specify)</option>
                  </select>
                  {cancelReason === 'Other' && (
                    <div className={styles.field}>
                      <label className={styles.reasonLabel}>
                        Please specify your reason
                      </label>
                      <textarea
                        className={styles.reasonTextarea}
                        placeholder='Describe your reason...'
                        value={customReasonText}
                        onChange={(e) => setCustomReasonText(e.target.value)}
                        rows='2'
                      />
                    </div>
                  )}
                  <div className={styles.fieldDivided}>
                    <label className={styles.reasonLabel}>
                      Additional note{' '}
                      <span className={styles.reasonLabelOptional}>
                        (optional)
                      </span>
                    </label>
                    <textarea
                      className={styles.reasonTextarea}
                      placeholder='Anything else your manager should know...'
                      value={cancelNote}
                      onChange={(e) => setCancelNote(e.target.value)}
                      rows='2'
                    />
                  </div>
                  <div className={styles.reasonActions}>
                    <button
                      className={styles.cancelReasonBtn}
                      onClick={() => {
                        setShowReasonForm(false)
                        setCancelReason('')
                        setCustomReasonText('')
                        setCancelNote('')
                      }}
                    >
                      Back
                    </button>
                    <button
                      className={styles.submitReasonBtn}
                      style={{
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

      {/* ── Cancelled shift detail modal ── */}
      {cancelledShiftDetail && (
        <div
          className={styles.overlay}
          onClick={() => setCancelledShiftDetail(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Cancelled Shift</div>
              <button
                className={styles.closeBtn}
                onClick={() => setCancelledShiftDetail(null)}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Day</span>
                <span className={styles.detailVal}>
                  {cancelledShiftDetail.dayName}, {cancelledShiftDetail.date}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Shift</span>
                <span
                  className={styles.detailVal}
                  style={{
                    color:
                      cancelledShiftDetail.type === 'early'
                        ? '#2a7f62'
                        : '#7a4fa8',
                    textTransform: 'capitalize',
                  }}
                >
                  {cancelledShiftDetail.type}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Time</span>
                <span className={styles.detailVal}>
                  {cancelledShiftDetail.type === 'early'
                    ? '07:00–14:30'
                    : '14:00–23:00'}
                </span>
              </div>
              {cancelledShiftDetail.sleepIn && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Sleep-in</span>
                  <span
                    className={styles.detailVal}
                    style={{ color: 'var(--color-warning)' }}
                  >
                    Yes
                  </span>
                </div>
              )}
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Status</span>
                <span
                  className={styles.detailVal}
                  style={{ color: 'var(--color-danger)' }}
                >
                  Cancelled
                </span>
              </div>
              {cancelledShiftDetail.cancelRecord?.reason && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Reason</span>
                  <span className={styles.detailVal}>
                    {cancelledShiftDetail.cancelRecord.reason === 'Other'
                      ? cancelledShiftDetail.cancelRecord.custom_reason
                      : cancelledShiftDetail.cancelRecord.reason}
                  </span>
                </div>
              )}
              {cancelledShiftDetail.cancelRecord?.reviewed_at && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Approved on</span>
                  <span className={styles.detailVal}>
                    {new Date(
                      cancelledShiftDetail.cancelRecord.reviewed_at
                    ).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
            <div className={styles.cancelledNoteWrap}>
              <div className={styles.cancelledNote}>
                <FontAwesomeIcon icon='triangle-exclamation' /> This shift has
                been removed from the rota. Contact your manager if this was a
                mistake.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Time-off modal ── */}
      {showTimeOffModal && (
        <div className={styles.overlay} onClick={closeTimeOffModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Request Time Off</div>
              <button className={styles.closeBtn} onClick={closeTimeOffModal}>
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            {timeOffSubmitted ? (
              <div className={styles.confirmWrap}>
                <div className={styles.confirmIcon}>
                  <FontAwesomeIcon icon='circle-check' />
                </div>
                <div className={styles.confirmTitle}>Request submitted</div>
                <div className={styles.confirmBody}>
                  Your manager has been notified and will review your request.
                  You'll see a pending badge on your calendar until it's
                  approved.
                </div>
                <button
                  className={styles.submitReasonBtn}
                  onClick={closeTimeOffModal}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className={styles.modalBody}>
                  <p className={styles.modalNote}>
                    Tap days below to select. Days with existing leave are not
                    available.
                  </p>
                  <LeaveCalendar
                    staffId={staffId}
                    selectedDates={timeOffSelectedDates}
                    onSelectionChange={setTimeOffSelectedDates}
                    leaveDays={myLeaveDays}
                  />
                  <div className={styles.field}>
                    <label className={styles.detailLabel}>Leave type</label>
                    <select
                      className={styles.reasonSelect}
                      value={timeOffType}
                      onChange={(e) => setTimeOffType(e.target.value)}
                    >
                      <option value='annual_leave'>Annual leave</option>
                      <option value='sick'>Sick</option>
                      <option value='training'>Training</option>
                      <option value='other'>Other</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.detailLabel}>
                      Note (optional)
                    </label>
                    <input
                      className={styles.reasonSelect}
                      type='text'
                      placeholder='e.g. holiday, appointment'
                      value={timeOffNote}
                      onChange={(e) => setTimeOffNote(e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.reasonActions}>
                  <button
                    className={styles.cancelReasonBtn}
                    onClick={closeTimeOffModal}
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.submitReasonBtn}
                    style={{
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

export default Calendar
