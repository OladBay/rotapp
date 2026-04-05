import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import ShiftPickerCalendar from '../components/shared/ShiftPickerCalendar'
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
import {
  getSwapsForStaff,
  createSwapRequest,
  withdrawSwapRequest,
  acceptSwapRequest,
  declineSwapRequest,
} from '../utils/swapRequests'
import { mockStaff } from '../data/mockRota'
import LeaveCalendar from '../components/shared/LeaveCalendar'

const TODAY = new Date()
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Roles eligible for swapping — no managers or OL
const SWAPPABLE_ROLES = ['senior', 'rcw', 'relief']

function Calendar() {
  const { user } = useAuth()
  const [monthRota] = useLocalStorage('rotapp_month_rota', {})
  const [weekRotaState] = useLocalStorage('rotapp_week_rota', {
    early: Array(7).fill([]),
    late: Array(7).fill([]),
    onCall: Array(7).fill([]),
  })

  // View state
  const [viewMode, setViewMode] = useState('week')
  const [currentMonday, setMonday] = useState(getMondayOfWeek(TODAY))
  const [currentYear, setCurrentYear] = useState(TODAY.getFullYear())
  const [hoveredMonth, setHoveredMonth] = useState(null)

  // Shift detail / cancel modal
  const [selectedShift, setSelectedShift] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [customReasonText, setCustomReasonText] = useState('')
  const [showReasonForm, setShowReasonForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Time-off modal
  const [showTimeOffModal, setShowTimeOffModal] = useState(false)
  const [timeOffType, setTimeOffType] = useState('annual_leave')
  const [timeOffSelectedDates, setTimeOffSelectedDates] = useState([])
  const [timeOffNote, setTimeOffNote] = useState('')
  const [timeOffRefresh, setTimeOffRefresh] = useState(0)
  const [timeOffSubmitted, setTimeOffSubmitted] = useState(false)

  // Swap modal — initiator (Staff A)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapShift, setSwapShift] = useState(null) // shift Staff A wants to swap
  const [swapTargetId, setSwapTargetId] = useState('') // selected staff member
  const [swapTargetShiftKey, setSwapTargetShiftKey] = useState('') // "date|type" of target's shift
  const [swapNote, setSwapNote] = useState('')
  const [staffSearch, setStaffSearch] = useState('')
  const [swapSubmitted, setSwapSubmitted] = useState(false)
  const [swapRefresh, setSwapRefresh] = useState(0)

  // Swap respond modal — target (Staff C)
  const [respondSwap, setRespondSwap] = useState(null) // the swap request object

  const staffId = user?.id
  const staffName = user?.name

  const currentWeekKey = getGeneratorMondayKey(currentMonday)
  const currentWeekRota = monthRota[currentWeekKey] || weekRotaState

  // All staff eligible to swap with (excluding self and non-swappable roles)
  const swappableStaff = useMemo(
    () =>
      mockStaff.filter(
        (s) => s.id !== staffId && SWAPPABLE_ROLES.includes(s.role)
      ),
    [staffId]
  )

  // Build a map of target staff's rostered shifts across all stored weeks
  const getShiftsForStaff = useCallback(
    (targetStaffId) => {
      const shifts = []
      Object.entries(monthRota).forEach(([mondayKey, rota]) => {
        const [y, m, d] = mondayKey.split('-').map(Number)
        const monday = new Date(y, m - 1, d)
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
          const date = new Date(monday)
          date.setDate(monday.getDate() + dayIdx)
          const yr = date.getFullYear()
          const mo = String(date.getMonth() + 1).padStart(2, '0')
          const dy = String(date.getDate()).padStart(2, '0')
          const dateStr = `${yr}-${mo}-${dy}`
          const earlyEntry = (rota.early?.[dayIdx] || []).find(
            (s) => s.id === targetStaffId
          )
          if (earlyEntry) {
            shifts.push({ date: dateStr, type: 'early', sleepIn: false })
          }
          const lateEntry = (rota.late?.[dayIdx] || []).find(
            (s) => s.id === targetStaffId
          )
          if (lateEntry) {
            shifts.push({
              date: dateStr,
              type: 'late',
              sleepIn: lateEntry.sleepIn || false,
            })
          }
        }
      })
      return shifts
    },
    [monthRota]
  )

  const targetShifts = useMemo(
    () => (swapTargetId ? getShiftsForStaff(swapTargetId) : []),
    [swapTargetId, getShiftsForStaff]
  )

  const selectedTargetShift = useMemo(() => {
    if (!swapTargetShiftKey) return null
    const [date, type, sameDayFlag] = swapTargetShiftKey.split('|')
    return { date, type, sleepIn: false, sameDay: sameDayFlag === 'sameday' }
  }, [swapTargetShiftKey])

  // My shifts for the current week
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

  // Swap helpers — re-reads on swapRefresh
  const mySwaps = useMemo(
    () => getSwapsForStaff(staffId || ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staffId, swapRefresh]
  )

  // Get the active swap for a specific shift (pending or awaiting_manager)
  const getActiveSwapForShift = (shift) => {
    if (!shift) return null
    return (
      mySwaps.find(
        (r) =>
          (r.initiatorId === staffId &&
            r.initiatorShift.date === shift.date &&
            r.initiatorShift.type === shift.type &&
            ['pending', 'awaiting_manager'].includes(r.status)) ||
          (r.targetId === staffId &&
            r.targetShift.date === shift.date &&
            r.targetShift.type === shift.type &&
            r.status === 'pending')
      ) || null
    )
  }

  // Get the most recent resolved swap for a shift (approved/rejected/declined)
  const getResolvedSwapForShift = (shift) => {
    if (!shift) return null
    return (
      mySwaps
        .filter(
          (r) =>
            ((r.initiatorId === staffId &&
              r.initiatorShift.date === shift.date &&
              r.initiatorShift.type === shift.type) ||
              (r.targetId === staffId &&
                r.targetShift.date === shift.date &&
                r.targetShift.type === shift.type)) &&
            ['approved', 'rejected', 'declined', 'withdrawn'].includes(r.status)
        )
        .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt))[0] ||
      null
    )
  }

  // Incoming swap requests where I am the target and status is pending
  const incomingSwaps = useMemo(
    () =>
      mySwaps.filter((r) => r.targetId === staffId && r.status === 'pending'),
    [mySwaps, staffId]
  )

  // Time-off helpers
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
  const yearMonths = useMemo(() => getYearMonths(currentYear), [currentYear])

  const getRotaForDate = (date) => {
    const monday = getMondayOfWeek(date)
    const key = dateKey(monday)
    return monthRota[key] || null
  }

  const hasShiftOnDate = (date, sid) => {
    const rota = getRotaForDate(date)
    if (!rota) return false
    const dayOfWeek = (date.getDay() + 6) % 7
    return (
      (rota.early?.[dayOfWeek] || []).some((s) => s.id === sid) ||
      (rota.late?.[dayOfWeek] || []).some((s) => s.id === sid)
    )
  }

  const handleMonthClick = (year, month) => {
    const firstOfMonth = new Date(year, month, 1)
    setMonday(getMondayOfWeek(firstOfMonth))
    setCurrentYear(year)
    setViewMode('week')
  }

  // ── Cancel request handlers ────────────────────────────────────────────

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

  // ── Time-off handlers ──────────────────────────────────────────────────

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

  // ── Swap handlers ──────────────────────────────────────────────────────

  const openSwapModal = (shift) => {
    setSwapShift(shift)
    setSwapTargetId('')
    setSwapTargetShiftKey('')
    setSwapNote('')
    setStaffSearch('')
    setSwapSubmitted(false)
    setShowSwapModal(true)
  }

  const closeSwapModal = () => {
    setShowSwapModal(false)
    setSwapShift(null)
    setSwapTargetId('')
    setSwapTargetShiftKey('')
    setSwapNote('')
    setSwapSubmitted(false)
  }

  const handleSubmitSwap = () => {
    if (!swapShift || !swapTargetId || !selectedTargetShift) return
    const target = mockStaff.find((s) => s.id === swapTargetId)
    createSwapRequest({
      initiatorId: staffId,
      initiatorName: staffName,
      initiatorShift: {
        date: swapShift.date,
        type: swapShift.type,
        sleepIn: swapShift.sleepIn,
      },
      targetId: swapTargetId,
      targetName: target?.name || swapTargetId,
      targetShift: {
        date: selectedTargetShift.date,
        type: selectedTargetShift.type,
        sleepIn: selectedTargetShift.sleepIn,
        sameDay: selectedTargetShift.sameDay || false,
      },
      note: swapNote,
    })
    setSwapRefresh((n) => n + 1)
    setSwapSubmitted(true)
  }

  const handleWithdrawSwap = (swapId) => {
    withdrawSwapRequest(swapId, staffId)
    setSwapRefresh((n) => n + 1)
    setSelectedShift(null)
  }

  const handleAcceptSwap = (swapId) => {
    acceptSwapRequest(swapId, staffId)
    setSwapRefresh((n) => n + 1)
    setRespondSwap(null)
  }

  const handleDeclineSwap = (swapId) => {
    declineSwapRequest(swapId, staffId)
    setSwapRefresh((n) => n + 1)
    setRespondSwap(null)
  }

  // Swap badge for a shift cell
  const getSwapBadge = (shift) => {
    const active = getActiveSwapForShift(shift)
    if (active) {
      if (active.status === 'pending' && active.initiatorId === staffId) {
        return {
          label: 'Swap pending',
          color: '#c4883a',
          bg: 'rgba(196,136,58,0.15)',
          border: 'rgba(196,136,58,0.3)',
        }
      }
      if (active.status === 'pending' && active.targetId === staffId) {
        return {
          label: 'Swap request',
          color: '#c4883a',
          bg: 'rgba(196,136,58,0.15)',
          border: 'rgba(196,136,58,0.3)',
        }
      }
      if (active.status === 'awaiting_manager') {
        return {
          label: 'With manager',
          color: '#6c8fff',
          bg: 'rgba(108,143,255,0.12)',
          border: 'rgba(108,143,255,0.25)',
        }
      }
    }
    const resolved = getResolvedSwapForShift(shift)
    if (resolved?.status === 'approved') {
      return {
        label: 'Swapped',
        color: '#2ecc8a',
        bg: 'rgba(46,204,138,0.12)',
        border: 'rgba(46,204,138,0.25)',
      }
    }
    if (resolved?.status === 'rejected' || resolved?.status === 'declined') {
      return {
        label: 'Swap rejected',
        color: '#e85c3d',
        bg: 'rgba(232,92,61,0.1)',
        border: 'rgba(232,92,61,0.25)',
      }
    }
    return null
  }

  // Can Staff A initiate a new swap on this shift?
  const canInitiateSwap = (shift) => {
    if (!shift) return false
    if (!SWAPPABLE_ROLES.includes(user?.activeRole)) return false
    // Block if there's already an active swap for this shift
    const active = getActiveSwapForShift(shift)
    return !active
  }

  const isSwappableRole = SWAPPABLE_ROLES.includes(user?.activeRole)

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
            {user?.activeRole !== 'relief' && (
              <button
                style={s.requestTimeOffBtn}
                onClick={() => setShowTimeOffModal(true)}
              >
                <FontAwesomeIcon icon='calendar-plus' /> Request time off
              </button>
            )}
            {/* Incoming swap requests badge */}
            {incomingSwaps.length > 0 && (
              <button
                style={s.incomingSwapBtn}
                onClick={() => setRespondSwap(incomingSwaps[0])}
              >
                <FontAwesomeIcon icon='right-left' />
                {incomingSwaps.length} swap request
                {incomingSwaps.length > 1 ? 's' : ''}
              </button>
            )}
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
                  const swapBadge = shift ? getSwapBadge(shift) : null
                  const hasIncomingForThisShift = shift
                    ? incomingSwaps.some(
                        (r) =>
                          r.targetShift.date === shift.date &&
                          r.targetShift.type === shift.type
                      )
                    : false

                  return (
                    <div
                      key={dayIdx}
                      style={{
                        ...s.cell,
                        cursor: shift ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (!shift) return
                        // If Staff C has an incoming swap on this cell, open respond modal
                        if (hasIncomingForThisShift) {
                          const incoming = incomingSwaps.find(
                            (r) =>
                              r.targetShift.date === shift.date &&
                              r.targetShift.type === shift.type
                          )
                          if (incoming) {
                            setRespondSwap(incoming)
                            return
                          }
                        }
                        setSelectedShift(shift)
                      }}
                    >
                      {/* Leave badges */}
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

                      {/* Swap badge */}
                      {swapBadge && (
                        <div
                          style={{
                            ...s.timeOffBadge,
                            background: swapBadge.bg,
                            color: swapBadge.color,
                            border: `1px solid ${swapBadge.border}`,
                          }}
                        >
                          <FontAwesomeIcon
                            icon='right-left'
                            style={{ marginRight: '4px', fontSize: '9px' }}
                          />
                          {swapBadge.label}
                        </div>
                      )}

                      {/* Shift or off-day */}
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
                            {shift.sleepIn && ' · Sleep-in'}
                            {isPending && ' · Pending'}
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

      {/* ── Shift detail modal ─────────────────────────────────────────── */}
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
                  <span style={{ ...s.detailVal, color: '#c4883a' }}>Yes</span>
                </div>
              )}
              <div style={s.detailRow}>
                <span style={s.detailLabel}>Status</span>
                {(() => {
                  const request = getShiftRequestStatus(selectedShift)
                  if (request?.status === 'pending')
                    return (
                      <span style={{ ...s.detailVal, color: '#c4883a' }}>
                        Cancellation requested
                      </span>
                    )
                  if (request?.status === 'approved')
                    return (
                      <span style={{ ...s.detailVal, color: '#e85c3d' }}>
                        Cancelled
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
                        Confirmed
                      </span>
                    )
                  return (
                    <span style={{ ...s.detailVal, color: '#2ecc8a' }}>
                      Confirmed
                    </span>
                  )
                })()}
              </div>
            </div>

            {/* Swap status section */}
            {(() => {
              const activeSwap = getActiveSwapForShift(selectedShift)
              const resolvedSwap = getResolvedSwapForShift(selectedShift)

              if (activeSwap && activeSwap.initiatorId === staffId) {
                // Staff A — their pending swap
                const otherName = activeSwap.targetName
                const statusLabel =
                  activeSwap.status === 'awaiting_manager'
                    ? `${otherName} accepted — awaiting manager`
                    : `Waiting for ${otherName} to respond`
                return (
                  <div style={s.swapStatusWrap}>
                    <div style={s.swapStatusRow}>
                      <FontAwesomeIcon
                        icon='right-left'
                        style={{ color: '#6c8fff', fontSize: '12px' }}
                      />
                      <span style={{ fontSize: '12px', color: '#9499b0' }}>
                        {statusLabel}
                      </span>
                    </div>
                    {activeSwap.status === 'pending' && (
                      <button
                        style={s.withdrawBtn}
                        onClick={() => handleWithdrawSwap(activeSwap.id)}
                      >
                        Withdraw swap request
                      </button>
                    )}
                  </div>
                )
              }

              if (
                resolvedSwap?.status === 'rejected' ||
                resolvedSwap?.status === 'declined'
              ) {
                // Allow Staff A to initiate a new swap
                return (
                  <div style={s.swapStatusWrap}>
                    <div
                      style={{
                        ...s.swapStatusRow,
                        color: '#e85c3d',
                        fontSize: '12px',
                      }}
                    >
                      <FontAwesomeIcon
                        icon='xmark'
                        style={{ fontSize: '11px' }}
                      />
                      <span>
                        Previous swap request was {resolvedSwap.status}
                      </span>
                    </div>
                    {isSwappableRole && (
                      <button
                        style={s.requestSwapBtn}
                        onClick={() => {
                          setSelectedShift(null)
                          openSwapModal(selectedShift)
                        }}
                      >
                        <FontAwesomeIcon icon='right-left' /> Request new swap
                      </button>
                    )}
                  </div>
                )
              }

              if (resolvedSwap?.status === 'approved') {
                return (
                  <div style={s.swapStatusWrap}>
                    <div
                      style={{
                        ...s.swapStatusRow,
                        color: '#2ecc8a',
                        fontSize: '12px',
                      }}
                    >
                      <FontAwesomeIcon
                        icon='check'
                        style={{ fontSize: '11px' }}
                      />
                      <span>Swap approved by {resolvedSwap.resolvedBy}</span>
                    </div>
                  </div>
                )
              }

              return null
            })()}

            {/* Cancel request section */}
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
                            if (updated) setSelectedShift({ ...selectedShift })
                          }}
                        >
                          Ping ({pingInfo.remainingPings})
                        </button>
                      ) : (
                        <button style={s.pingBtnDisabled} disabled>
                          Ping limit reached
                        </button>
                      )}
                    </div>
                  </>
                )
              }
              if (request?.status === 'approved') return null

              // Show swap + cancel buttons if no active swap
              const activeSwap = getActiveSwapForShift(selectedShift)
              if (!activeSwap) {
                if (!showReasonForm) {
                  return (
                    <div
                      style={{
                        padding: '0 20px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {isSwappableRole && canInitiateSwap(selectedShift) && (
                        <button
                          style={s.requestSwapBtn}
                          onClick={() => {
                            setSelectedShift(null)
                            openSwapModal(selectedShift)
                          }}
                        >
                          <FontAwesomeIcon icon='right-left' /> Request shift
                          swap
                        </button>
                      )}
                      <button
                        style={s.cancelShiftBtn}
                        onClick={() => setShowReasonForm(true)}
                      >
                        Request cancellation
                      </button>
                    </div>
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
                        <FontAwesomeIcon icon='triangle-exclamation' />{' '}
                        {message}
                      </div>
                    )}
                    <div style={s.reasonLabel}>Reason for cancellation:</div>
                    <select
                      style={s.reasonSelect}
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
                            (cancelReason === 'Other' &&
                              !customReasonText.trim())
                              ? 0.5
                              : 1,
                          cursor:
                            !cancelReason ||
                            (cancelReason === 'Other' &&
                              !customReasonText.trim())
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
              }
              return null
            })()}
          </div>
        </div>
      )}

      {/* ── Swap initiation modal (Staff A) ───────────────────────────── */}
      {showSwapModal && (
        <div style={s.overlay} onClick={closeSwapModal}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>
                <FontAwesomeIcon
                  icon='right-left'
                  style={{ marginRight: '8px', color: '#6c8fff' }}
                />
                Request shift swap
              </div>
              <button style={s.closeBtn} onClick={closeSwapModal}>
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>

            {swapSubmitted ? (
              <div style={s.confirmWrap}>
                <div style={{ fontSize: '36px', color: '#6c8fff' }}>
                  <FontAwesomeIcon icon='right-left' />
                </div>
                <div style={s.confirmTitle}>Swap request sent</div>
                <div style={s.confirmBody}>
                  Your request has been sent. Once they respond, it will go to
                  your manager for approval.
                </div>
                <button style={s.submitReasonBtn} onClick={closeSwapModal}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={s.modalBody}>
                  {/* Your shift */}
                  <div style={s.swapShiftCard}>
                    <div style={s.swapCardLabel}>Your shift</div>
                    <div style={s.swapCardMain}>
                      {swapShift?.type === 'early' ? 'Early' : 'Late'} ·{' '}
                      {swapShift?.date}
                    </div>
                    <div style={s.swapCardSub}>
                      {swapShift?.type === 'early'
                        ? '07:00–14:30'
                        : '14:00–23:00'}
                      {swapShift?.sleepIn ? ' · Sleep-in' : ''}
                    </div>
                  </div>

                  <div style={s.swapArrow}>
                    <FontAwesomeIcon
                      icon='right-left'
                      style={{
                        color: '#5d6180',
                        fontSize: '16px',
                        transform: 'rotate(90deg)',
                      }}
                    />
                  </div>

                  {/* Pick staff — searchable */}
                  <div style={{ position: 'relative' }}>
                    <div style={s.fieldLabel}>Swap with</div>
                    <input
                      style={s.reasonSelect}
                      type='text'
                      placeholder='Search staff name...'
                      value={staffSearch}
                      onChange={(e) => {
                        setStaffSearch(e.target.value)
                        setSwapTargetId('')
                        setSwapTargetShiftKey('')
                      }}
                      autoComplete='off'
                    />
                    {staffSearch && !swapTargetId && (
                      <div style={s.staffDropdown}>
                        {swappableStaff
                          .filter((st) =>
                            st.name
                              .toLowerCase()
                              .includes(staffSearch.toLowerCase())
                          )
                          .map((st) => (
                            <div
                              key={st.id}
                              style={s.staffDropdownItem}
                              onClick={() => {
                                setSwapTargetId(st.id)
                                setStaffSearch(st.name)
                                setSwapTargetShiftKey('')
                              }}
                            >
                              <span
                                style={{ fontSize: '13px', color: '#e8eaf0' }}
                              >
                                {st.name}
                              </span>
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: '#5d6180',
                                  fontFamily: 'DM Mono, monospace',
                                }}
                              >
                                {st.roleCode}
                              </span>
                            </div>
                          ))}
                        {swappableStaff.filter((st) =>
                          st.name
                            .toLowerCase()
                            .includes(staffSearch.toLowerCase())
                        ).length === 0 && (
                          <div
                            style={{
                              padding: '10px 12px',
                              fontSize: '13px',
                              color: '#5d6180',
                            }}
                          >
                            No staff found
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pick their shift — calendar picker */}
                  {swapTargetId && (
                    <div>
                      <div style={s.fieldLabel}>Their shift to swap</div>
                      <ShiftPickerCalendar
                        targetStaffId={swapTargetId}
                        monthRota={monthRota}
                        initiatorShiftDate={swapShift?.date}
                        selected={selectedTargetShift}
                        onSelect={(sh) =>
                          setSwapTargetShiftKey(
                            `${sh.date}|${sh.type}|${sh.sameDay ? 'sameday' : ''}`
                          )
                        }
                      />
                    </div>
                  )}

                  {/* Their shift preview */}
                  {selectedTargetShift && (
                    <div style={s.targetShiftCard}>
                      <div style={s.targetCardLabel}>
                        {mockStaff.find((s) => s.id === swapTargetId)?.name}'s
                        shift
                      </div>
                      {selectedTargetShift.availabilityOnly ? (
                        <>
                          <div style={s.swapCardMain}>
                            Availability requested
                          </div>
                          <div style={s.swapCardSub}>
                            {selectedTargetShift.date}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={s.swapCardMain}>
                            {selectedTargetShift.type === 'early'
                              ? 'Early'
                              : 'Late'}{' '}
                            · {selectedTargetShift.date}
                          </div>
                          <div style={s.swapCardSub}>
                            {selectedTargetShift.type === 'early'
                              ? '07:00–14:30'
                              : '14:00–23:00'}
                            {selectedTargetShift.sleepIn ? ' · Sleep-in' : ''}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Sleep-in warning */}
                  {selectedTargetShift?.sleepIn && (
                    <div style={s.swapWarn}>
                      <FontAwesomeIcon
                        icon='triangle-exclamation'
                        style={{ flexShrink: 0 }}
                      />
                      <span>
                        {mockStaff.find((s) => s.id === swapTargetId)?.name}'s
                        shift has a sleep-in. If approved, you will inherit it.
                        The manager will be informed.
                      </span>
                    </div>
                  )}
                  {swapShift?.sleepIn &&
                    selectedTargetShift &&
                    !selectedTargetShift.sleepIn && (
                      <div style={s.swapWarn}>
                        <FontAwesomeIcon
                          icon='triangle-exclamation'
                          style={{ flexShrink: 0 }}
                        />
                        <span>
                          Your shift has a sleep-in. If approved,{' '}
                          {mockStaff.find((s) => s.id === swapTargetId)?.name}{' '}
                          will inherit it. The manager will be informed.
                        </span>
                      </div>
                    )}

                  {/* Note */}
                  <div>
                    <div style={s.fieldLabel}>Note (optional)</div>
                    <textarea
                      style={s.reasonTextarea}
                      placeholder='Add a note for the other staff member or manager...'
                      value={swapNote}
                      onChange={(e) => setSwapNote(e.target.value)}
                      rows='3'
                    />
                  </div>
                </div>

                <div style={s.reasonActions}>
                  <button style={s.cancelReasonBtn} onClick={closeSwapModal}>
                    Cancel
                  </button>
                  <button
                    style={{
                      ...s.submitReasonBtn,
                      opacity: !swapTargetId || !swapTargetShiftKey ? 0.5 : 1,
                      cursor:
                        !swapTargetId || !swapTargetShiftKey
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                    disabled={!swapTargetId || !swapTargetShiftKey}
                    onClick={handleSubmitSwap}
                  >
                    Submit swap request
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Swap respond modal (Staff C) ───────────────────────────────── */}
      {respondSwap && (
        <div style={s.overlay} onClick={() => setRespondSwap(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>
                <FontAwesomeIcon
                  icon='right-left'
                  style={{ marginRight: '8px', color: '#6c8fff' }}
                />
                Swap request from {respondSwap.initiatorName}
              </div>
              <button style={s.closeBtn} onClick={() => setRespondSwap(null)}>
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div style={s.modalBody}>
              <div
                style={{ fontSize: '13px', color: '#9499b0', lineHeight: 1.5 }}
              >
                {respondSwap.initiatorName} wants to swap shifts with you.
                Accept or decline below.
              </div>

              {/* Their shift */}
              <div style={s.swapShiftCard}>
                <div style={s.swapCardLabel}>
                  {respondSwap.initiatorName} gives up
                </div>
                <div style={s.swapCardMain}>
                  {respondSwap.initiatorShift.type === 'early'
                    ? 'Early'
                    : 'Late'}{' '}
                  · {respondSwap.initiatorShift.date}
                </div>
                <div style={s.swapCardSub}>
                  {respondSwap.initiatorShift.type === 'early'
                    ? '07:00–14:30'
                    : '14:00–23:00'}
                  {respondSwap.initiatorShift.sleepIn ? ' · Sleep-in' : ''}
                </div>
              </div>

              <div style={s.swapArrow}>
                <FontAwesomeIcon
                  icon='right-left'
                  style={{
                    color: '#5d6180',
                    fontSize: '16px',
                    transform: 'rotate(90deg)',
                  }}
                />
              </div>

              {/* Your shift */}
              <div style={s.targetShiftCard}>
                <div style={s.targetCardLabel}>
                  {respondSwap.targetShift.sameDay
                    ? 'Same day — you cover'
                    : 'You give up'}
                </div>
                <div style={s.swapCardMain}>
                  {respondSwap.targetShift.type === 'early' ? 'Early' : 'Late'}{' '}
                  · {respondSwap.targetShift.date}
                </div>
                <div style={s.swapCardSub}>
                  {respondSwap.targetShift.type === 'early'
                    ? '07:00–14:30'
                    : '14:00–23:00'}
                  {respondSwap.targetShift.sleepIn ? ' · Sleep-in' : ''}
                </div>
              </div>

              {/* Sleep-in warning */}
              {respondSwap.initiatorShift.sleepIn && (
                <div style={s.swapWarn}>
                  <FontAwesomeIcon
                    icon='triangle-exclamation'
                    style={{ flexShrink: 0 }}
                  />
                  <span>
                    If you accept, you will inherit {respondSwap.initiatorName}
                    's sleep-in on {respondSwap.initiatorShift.date}.
                  </span>
                </div>
              )}

              {/* Initiator's note */}
              {respondSwap.note && (
                <div style={s.swapNote}>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#5d6180',
                      marginBottom: '4px',
                    }}
                  >
                    Note from {respondSwap.initiatorName}
                  </div>
                  <div style={{ fontSize: '13px', color: '#9499b0' }}>
                    {respondSwap.note}
                  </div>
                </div>
              )}
            </div>

            <div style={s.reasonActions}>
              <button
                style={{
                  ...s.cancelReasonBtn,
                  color: '#e85c3d',
                  borderColor: 'rgba(232,92,61,0.3)',
                }}
                onClick={() => handleDeclineSwap(respondSwap.id)}
              >
                Decline
              </button>
              <button
                style={{ ...s.submitReasonBtn, background: '#2ecc8a' }}
                onClick={() => handleAcceptSwap(respondSwap.id)}
              >
                Accept swap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Time-off modal ─────────────────────────────────────────────── */}
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
  incomingSwapBtn: {
    background: 'rgba(196,136,58,0.12)',
    border: '1px solid rgba(196,136,58,0.3)',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#c4883a',
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
  miniDateNum: { fontSize: '9px', fontFamily: 'DM Mono, monospace' },
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
  staffDropdown: {
    position: 'absolute',
    top: '68px',
    left: 0,
    right: 0,
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    zIndex: 60,
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  staffDropdownItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    transition: 'background 0.1s',
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
    display: 'flex',
    alignItems: 'center',
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
    flex: 1,
  },
  modalNote: { fontSize: '13px', color: '#9499b0', margin: 0 },
  field: { display: 'flex', flexDirection: 'column' },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: { fontSize: '13px', color: '#9499b0' },
  detailVal: { fontSize: '13px', fontWeight: 500, color: '#e8eaf0' },
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
  },
  requestSwapBtn: {
    width: '100%',
    background: 'rgba(108,143,255,0.1)',
    border: '1px solid rgba(108,143,255,0.25)',
    borderRadius: '8px',
    color: '#6c8fff',
    padding: '10px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
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
  },
  confirmWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '32px 24px',
    gap: '12px',
  },
  confirmIcon: { fontSize: '40px', color: '#2ecc8a' },
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
  // Swap-specific styles
  swapShiftCard: {
    background: 'rgba(108,143,255,0.07)',
    border: '1px solid rgba(108,143,255,0.2)',
    borderRadius: '10px',
    padding: '12px 14px',
  },
  targetShiftCard: {
    background: 'rgba(46,204,138,0.07)',
    border: '1px solid rgba(46,204,138,0.2)',
    borderRadius: '10px',
    padding: '12px 14px',
  },
  swapCardLabel: {
    fontSize: '11px',
    color: '#6c8fff',
    fontWeight: 500,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  targetCardLabel: {
    fontSize: '11px',
    color: '#2ecc8a',
    fontWeight: 500,
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  swapCardMain: { fontSize: '14px', fontWeight: 500, color: '#e8eaf0' },
  swapCardSub: { fontSize: '12px', color: '#9499b0', marginTop: '2px' },
  swapArrow: { textAlign: 'center', margin: '-4px 0' },
  fieldLabel: {
    fontSize: '12px',
    color: '#9499b0',
    marginBottom: '6px',
    fontWeight: 500,
  },
  swapWarn: {
    background: 'rgba(196,136,58,0.1)',
    border: '1px solid rgba(196,136,58,0.25)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '12px',
    color: '#c4883a',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  swapNote: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '8px',
    padding: '10px 12px',
  },
  swapStatusWrap: {
    padding: '12px 24px 16px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  swapStatusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#6c8fff',
    fontSize: '12px',
  },
}

export default Calendar
