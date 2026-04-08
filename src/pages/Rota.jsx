import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRota } from '../context/RotaContext'
import Navbar from '../components/layout/Navbar'
import GenerateModal from '../components/layout/GenerateModal'
import BatchGenerateModal from '../components/layout/BatchGenerateModal'
import JumpCalendar from '../components/shared/JumpCalendar'
import CellEditModal from '../components/layout/CellEditModal'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLocalStorage } from '../hooks/useLocalStorage'
import {
  getWeekDates,
  formatDate,
  formatShort,
  getMondayOfWeek,
  addWeeks,
  getMonthDates,
  getMonthWeeks,
  getYearMonths,
  isSameDay,
  dateKey,
} from '../utils/dateUtils'
import {
  calculateStaffHoursForWeek,
  getWeeksInMonth,
} from '../utils/hoursCalculator'

const TODAY = new Date()
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getDayHealth(rota, dayOfWeek, staffMap = {}) {
  if (!rota) return 'unplanned'
  const early = rota.early?.[dayOfWeek] || []
  const late = rota.late?.[dayOfWeek] || []
  if (early.length === 0 && late.length === 0) return 'unplanned'
  const sleepIns = late.filter((e) => e.sleepIn).length
  if (early.length < 3 || late.length < 3 || sleepIns !== 2) return 'gap'
  const earlyHasF = early.some((e) => staffMap[e.id]?.gender === 'F')
  const lateHasF = late.some((e) => staffMap[e.id]?.gender === 'F')
  const earlyHasD = early.some((e) => staffMap[e.id]?.driver)
  const lateHasD = late.some((e) => staffMap[e.id]?.driver)
  if (!earlyHasF || !lateHasF || !earlyHasD || !lateHasD) return 'breach'
  return 'ok'
}

function getMonthHealth(monthDates, month, getRotaForDate, staffMap = {}) {
  let hasGap = false
  let hasBreach = false
  let hasPlanned = false

  monthDates.forEach((date) => {
    if (date.getMonth() !== month) return
    const dayOfWeek = (date.getDay() + 6) % 7
    const rota = getRotaForDate(date)
    const h = getDayHealth(rota, dayOfWeek, staffMap)
    if (h !== 'unplanned') hasPlanned = true
    if (h === 'gap') hasGap = true
    if (h === 'breach') hasBreach = true
  })

  if (!hasPlanned) return 'unplanned'
  if (hasGap) return 'gap'
  if (hasBreach) return 'breach'
  return 'ok'
}

const HEALTH_COLOURS = {
  gap: '#e85c3d',
  breach: '#c4883a',
  ok: '#2ecc8a',
  unplanned: '#2e3045',
}

const HEALTH_TEXT = {
  gap: '#e85c3d',
  breach: '#c4883a',
  ok: '#2ecc8a',
  unplanned: '#3d405a',
}

function Rota() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [hideZeroHours, setHideZeroHours] = useState(false)
  const [isNavPinned, setIsNavPinned] = useState(() => {
    try {
      const pinned = localStorage.getItem('rotapp_month_nav_pinned')
      return pinned === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const jumpDate = sessionStorage.getItem('rota_jump_date')
    if (jumpDate) {
      const targetDate = new Date(jumpDate)
      if (!isNaN(targetDate)) {
        setMonday(getMondayOfWeek(targetDate))
        setCurrentYear(targetDate.getFullYear())
        setViewMode('week')
      }
      sessionStorage.removeItem('rota_jump_date')
    }
  }, [])

  const [viewMode, setViewMode] = useState('month')
  const [currentMonday, setMonday] = useState(getMondayOfWeek(TODAY))
  const [currentYear, setCurrentYear] = useState(TODAY.getFullYear())
  const [hoveredMonth, setHoveredMonth] = useState(null)

  const [overwriteTarget, setOverwriteTarget] = useState(null)

  const { staff, staffMap, monthRota, setMonthRota, timeOff } = useRota()

  const [weekRota, setWeekRota] = useLocalStorage('rotapp_week_rota', {
    early: Array(7).fill([]),
    late: Array(7).fill([]),
    onCall: Array(7).fill([]),
  })

  const [generateTarget, setGenerateTarget] = useState(null)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [editCell, setEditCell] = useState(null)
  const [showJump, setShowJump] = useState(false)

  const weekDates = getWeekDates(currentMonday)
  const yearMonths = useMemo(() => getYearMonths(currentYear), [currentYear])

  const canEdit = ['manager', 'deputy', 'superadmin'].includes(user?.activeRole)

  const canSeeGaps = [
    'manager',
    'deputy',
    'senior',
    'operationallead',
    'superadmin',
  ].includes(user?.activeRole)

  const currentRotaForWeek = monthRota[dateKey(currentMonday)] || weekRota

  const startLabel = formatDate(weekDates[0])
  const endLabel = formatDate(weekDates[6])

  const prevWeek = () => setMonday((prev) => addWeeks(prev, -1))
  const nextWeek = () => setMonday((prev) => addWeeks(prev, 1))

  const togglePinNav = () => {
    const newValue = !isNavPinned
    setIsNavPinned(newValue)
    localStorage.setItem('rotapp_month_nav_pinned', String(newValue))
  }

  const handleJump = (date) => {
    if (!date || isNaN(date)) return
    setMonday(getMondayOfWeek(date))
    setCurrentYear(date.getFullYear())
    setViewMode('week')
  }

  const getViolations = (dayIdx) => {
    const v = []
    const early = currentRotaForWeek.early[dayIdx] || []
    const late = currentRotaForWeek.late[dayIdx] || []
    const sleepIns = late.filter((e) => e.sleepIn)
    if (early.length < 3) v.push(`Early: ${early.length}/3`)
    if (late.length < 3) v.push(`Late: ${late.length}/3`)
    if (sleepIns.length !== 2) v.push(`Sleep-ins: ${sleepIns.length}/2`)
    return v
  }

  const totalViolations = DAYS.reduce(
    (a, _, i) => a + getViolations(i).length,
    0
  )

  const handleApplyMonth = ({ weekRotas }) => {
    setMonthRota((prev) => ({ ...prev, ...weekRotas }))
  }

  const handleApplyBatch = (newWeekRotas) => {
    setMonthRota((prev) => ({ ...prev, ...newWeekRotas }))
  }

  const getRotaForDate = (date) => {
    const monday = getMondayOfWeek(date)
    const key = dateKey(monday)
    return (
      monthRota[key] || (isSameDay(monday, currentMonday) ? weekRota : null)
    )
  }

  // Uses Monday-ownership rule — a week belongs to the month its Monday
  // falls in. Prevents boundary weeks from making the next month appear
  // as already having a rota.
  const monthHasRota = (year, month) => {
    const weeks = getMonthWeeks(year, month)
    return weeks.some((monday) => !!monthRota[dateKey(monday)])
  }

  const handleGenerateClick = (year, month, label, e) => {
    e.stopPropagation()
    if (monthHasRota(year, month)) {
      setOverwriteTarget({ year, month, label })
    } else {
      setGenerateTarget({ year, month, label })
    }
  }

  const handleCellSave = (day, shift, updatedList) => {
    const key = dateKey(currentMonday)
    if (shift === 'early') {
      const newEarly = currentRotaForWeek.early.map((d, i) =>
        i === day ? updatedList : d
      )
      const updatedRota = { ...currentRotaForWeek, early: newEarly }
      if (monthRota[key]) {
        setMonthRota((prev) => ({ ...prev, [key]: updatedRota }))
      } else {
        setWeekRota(updatedRota)
      }
    } else {
      const newLate = currentRotaForWeek.late.map((d, i) =>
        i === day ? updatedList : d
      )
      const updatedRota = { ...currentRotaForWeek, late: newLate }
      if (monthRota[key]) {
        setMonthRota((prev) => ({ ...prev, [key]: updatedRota }))
      } else {
        setWeekRota(updatedRota)
      }
    }
  }

  return (
    <div style={s.page}>
      <Navbar />

      <div style={s.body}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.breadcrumb} onClick={() => navigate('/dashboard')}>
              <FontAwesomeIcon icon='chevron-left' /> Dashboard
            </div>
            <h1 style={s.title}>
              {viewMode === 'week' ? 'Weekly Rota' : 'Rota Planner'}
            </h1>
            <p style={s.subtitle}>
              Meadowview House ·{' '}
              {viewMode === 'week'
                ? `${startLabel} – ${endLabel}`
                : `${currentYear}`}
            </p>
          </div>
          <div style={s.headerRight}>
            <div style={s.viewToggle}>
              {[
                { value: 'month', label: 'Month' },
                { value: 'week', label: 'Week' },
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
            {canEdit && viewMode === 'week' && (
              <div style={s.headerActions}>
                <button style={s.secondaryBtn}>Publish</button>
              </div>
            )}
          </div>
        </div>

        {/* Compliance strip — week view only */}
        {viewMode === 'week' && canSeeGaps && (
          <div style={s.compStrip}>
            {totalViolations === 0 ? (
              <span style={{ ...s.chip, ...s.chipOk }}>
                <FontAwesomeIcon icon='check' /> All shifts compliant
              </span>
            ) : (
              <span style={{ ...s.chip, ...s.chipWarn }}>
                <FontAwesomeIcon icon='triangle-exclamation' />{' '}
                {totalViolations} violation{totalViolations > 1 ? 's' : ''} this
                week
              </span>
            )}
            <span style={{ ...s.chip, ...s.chipInfo }}>
              2 sleep-ins checked nightly
            </span>
            <span style={{ ...s.chip, ...s.chipInfo }}>On-call: 7/7 days</span>
          </div>
        )}

        {/* Navigation bar */}
        <div
          style={{
            ...s.weekNav,
            position: isNavPinned ? 'sticky' : 'static',
            top: isNavPinned ? '56px' : 'auto',
            background: isNavPinned ? '#0f1117' : 'transparent',
            zIndex: isNavPinned ? 100 : 'auto',
            padding: isNavPinned ? '10px 24px' : '0',
            margin: isNavPinned ? '0 -24px' : '0',
            borderBottom: isNavPinned
              ? '1px solid rgba(255,255,255,0.07)'
              : 'none',
          }}
        >
          {viewMode === 'week' ? (
            <>
              <button style={s.navArrow} onClick={prevWeek}>
                <FontAwesomeIcon icon='chevron-left' />
              </button>
              <span style={s.weekLabel}>{`${startLabel} – ${endLabel}`}</span>
              <button style={s.navArrow} onClick={nextWeek}>
                <FontAwesomeIcon icon='chevron-right' />
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  style={{
                    ...s.jumpBtn,
                    background: showJump
                      ? 'rgba(108,143,255,0.1)'
                      : 'transparent',
                    color: showJump ? '#6c8fff' : '#9499b0',
                    border: showJump
                      ? '1px solid rgba(108,143,255,0.3)'
                      : '1px solid rgba(255,255,255,0.1)',
                  }}
                  onClick={() => setShowJump((v) => !v)}
                >
                  <FontAwesomeIcon
                    icon='calendar-days'
                    style={{ marginRight: '6px' }}
                  />
                  Jump to date
                </button>
                {showJump && (
                  <JumpCalendar
                    onJump={handleJump}
                    onClose={() => setShowJump(false)}
                    initialDate={new Date(currentMonday)}
                  />
                )}
              </div>
              <div style={s.legend}>
                <span style={{ ...s.legendItem, color: '#2a7f62' }}>
                  ■ Early
                </span>
                <span style={{ ...s.legendItem, color: '#7a4fa8' }}>
                  ■ Late
                </span>
                <span style={{ ...s.legendItem, color: '#c4883a' }}>
                  ■ Sleep-in
                </span>
              </div>
            </>
          ) : (
            <>
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
                style={s.jumpBtn}
                onClick={() => {
                  setCurrentYear(TODAY.getFullYear())
                  setMonday(getMondayOfWeek(TODAY))
                }}
              >
                Today
              </button>

              {/* Batch generate button — month view only, managers/deputies only */}
              {canEdit && (
                <button
                  style={s.batchBtn}
                  onClick={() => setShowBatchModal(true)}
                >
                  <FontAwesomeIcon icon='bolt' /> Batch generate
                </button>
              )}

              <div style={s.legend}>
                <span style={{ ...s.legendItem, color: HEALTH_COLOURS.ok }}>
                  ■ Compliant
                </span>
                <span style={{ ...s.legendItem, color: HEALTH_COLOURS.breach }}>
                  ■ Breach
                </span>
                <span style={{ ...s.legendItem, color: HEALTH_COLOURS.gap }}>
                  ■ Gap
                </span>
                <span style={{ ...s.legendItem, color: '#5d6180' }}>
                  ■ Not planned
                </span>
              </div>

              {/* Pin button - only in month view */}
              <button
                style={{
                  ...s.pinBtn,
                  color: isNavPinned ? '#6c8fff' : '#5d6180',
                  background: isNavPinned
                    ? 'rgba(108,143,255,0.1)'
                    : 'transparent',
                  border: isNavPinned
                    ? '1px solid rgba(108,143,255,0.3)'
                    : '1px solid rgba(255,255,255,0.1)',
                }}
                onClick={togglePinNav}
                title={
                  isNavPinned
                    ? 'Unpin navigation bar'
                    : 'Pin navigation bar (stays while scrolling)'
                }
              >
                <FontAwesomeIcon
                  icon='thumbtack'
                  style={{
                    transform: isNavPinned ? 'rotate(45deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              </button>
            </>
          )}
        </div>

        {/* MONTH VIEW */}
        {viewMode === 'month' && (
          <>
            <div style={s.hintText}>
              <FontAwesomeIcon icon='circle-info' /> Click any date to jump to
              that week
            </div>
            <div style={s.yearWrap}>
              {yearMonths.map(({ year, month, label }) => {
                const monthDates = getMonthDates(year, month)
                const hasRota = monthHasRota(year, month)

                const monthHealth = getMonthHealth(
                  monthDates,
                  month,
                  getRotaForDate,
                  staffMap
                )
                const isHovered = hoveredMonth === `${year}-${month}`

                return (
                  <div
                    key={`${year}-${month}`}
                    style={{
                      ...s.miniMonth,
                      border: hasRota
                        ? `1px solid ${HEALTH_COLOURS[monthHealth]}44`
                        : '1px solid rgba(255,255,255,0.06)',
                      background: hasRota
                        ? `${HEALTH_COLOURS[monthHealth]}08`
                        : '#161820',
                      transform: isHovered
                        ? 'translateY(-3px)'
                        : 'translateY(0)',
                      boxShadow: isHovered
                        ? '0 8px 24px rgba(0,0,0,0.35)'
                        : '0 1px 4px rgba(0,0,0,0.15)',
                    }}
                    onMouseEnter={() => setHoveredMonth(`${year}-${month}`)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    onClick={() => {
                      const firstOfMonth = new Date(year, month, 1)
                      setMonday(getMondayOfWeek(firstOfMonth))
                      setCurrentYear(year)
                      setViewMode('week')
                    }}
                  >
                    {/* Month title row */}
                    <div style={s.miniMonthHeader}>
                      <div style={s.miniMonthTitle}>{label}</div>
                      {hasRota && (
                        <span
                          style={{
                            ...s.rotaBadge,
                            color: HEALTH_COLOURS[monthHealth],
                            background: `${HEALTH_COLOURS[monthHealth]}15`,
                            border: `1px solid ${HEALTH_COLOURS[monthHealth]}30`,
                          }}
                        >
                          {monthHealth === 'ok' && (
                            <FontAwesomeIcon icon='check' />
                          )}
                          {monthHealth === 'gap' && (
                            <FontAwesomeIcon icon='triangle-exclamation' />
                          )}
                          {monthHealth === 'breach' && (
                            <FontAwesomeIcon icon='triangle-exclamation' />
                          )}
                          {monthHealth === 'ok'
                            ? ' Rota set'
                            : monthHealth === 'gap'
                              ? ' Has gaps'
                              : ' Has breaches'}
                        </span>
                      )}
                    </div>

                    {/* Day headers */}
                    <div style={s.miniDayHeaders}>
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <div key={i} style={s.miniDayHead}>
                          {d}
                        </div>
                      ))}
                    </div>

                    {/* Date grid */}
                    <div style={s.miniGrid}>
                      {monthDates.map((date, i) => {
                        const inMonth = date.getMonth() === month
                        const isToday = isSameDay(date, TODAY)
                        const dayOfWeek = (date.getDay() + 6) % 7
                        const rota = inMonth ? getRotaForDate(date) : null

                        const health = inMonth
                          ? getDayHealth(rota, dayOfWeek, staffMap)
                          : null
                        return (
                          <div
                            key={i}
                            style={{
                              ...s.miniCell,
                              opacity: inMonth ? 1 : 0,
                              background: inMonth
                                ? health === 'unplanned'
                                  ? HEALTH_COLOURS.unplanned
                                  : `${HEALTH_COLOURS[health]}22`
                                : 'transparent',
                              border: isToday
                                ? '1.5px solid #6c8fff'
                                : inMonth && health !== 'unplanned'
                                  ? `1px solid ${HEALTH_COLOURS[health]}55`
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
                                  : inMonth
                                    ? health === 'unplanned'
                                      ? HEALTH_TEXT.unplanned
                                      : HEALTH_TEXT[health]
                                    : 'transparent',
                                fontWeight: isToday ? 700 : 400,
                              }}
                            >
                              {date.getDate()}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Footer — stats or generate button */}
                    <div style={s.miniFooter}>
                      {isHovered && canEdit ? (
                        <button
                          style={{
                            ...s.generateBtn,
                            background: hasRota
                              ? 'rgba(196,136,58,0.15)'
                              : 'rgba(108,143,255,0.15)',
                            color: hasRota ? '#c4883a' : '#6c8fff',
                            border: hasRota
                              ? '1px solid rgba(196,136,58,0.3)'
                              : '1px solid rgba(108,143,255,0.3)',
                          }}
                          onClick={(e) =>
                            handleGenerateClick(year, month, label, e)
                          }
                        >
                          <FontAwesomeIcon icon='bolt' />
                          {hasRota ? ' Regenerate' : ' Generate'}
                        </button>
                      ) : (
                        (() => {
                          const counts = {
                            ok: 0,
                            breach: 0,
                            gap: 0,
                            unplanned: 0,
                          }
                          monthDates.forEach((date) => {
                            if (date.getMonth() !== month) return
                            const dayOfWeek = (date.getDay() + 6) % 7
                            const rota = getRotaForDate(date)
                            const h = getDayHealth(rota, dayOfWeek, staffMap)
                            counts[h]++
                          })
                          return (
                            <>
                              {counts.gap > 0 && (
                                <span
                                  style={{
                                    ...s.miniChip,
                                    color: '#e85c3d',
                                    background: 'rgba(232,92,61,0.12)',
                                  }}
                                >
                                  {counts.gap} gap{counts.gap > 1 ? 's' : ''}
                                </span>
                              )}
                              {counts.breach > 0 && (
                                <span
                                  style={{
                                    ...s.miniChip,
                                    color: '#c4883a',
                                    background: 'rgba(196,136,58,0.12)',
                                  }}
                                >
                                  {counts.breach} breach
                                  {counts.breach > 1 ? 'es' : ''}
                                </span>
                              )}
                              {counts.gap === 0 &&
                                counts.breach === 0 &&
                                counts.unplanned === 0 && (
                                  <span
                                    style={{
                                      ...s.miniChip,
                                      color: '#2ecc8a',
                                      background: 'rgba(46,204,138,0.1)',
                                    }}
                                  >
                                    <FontAwesomeIcon icon='check' /> All clear
                                  </span>
                                )}
                              {counts.unplanned > 0 &&
                                counts.gap === 0 &&
                                counts.breach === 0 && (
                                  <span
                                    style={{
                                      ...s.miniChip,
                                      color: '#5d6180',
                                      background: 'rgba(255,255,255,0.05)',
                                    }}
                                  >
                                    Not planned
                                  </span>
                                )}
                            </>
                          )
                        })()
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* WEEK VIEW */}
        {viewMode === 'week' && (
          <>
            <div style={s.gridWrap}>
              <div
                style={{
                  ...s.grid,
                  gridTemplateColumns: '120px repeat(7, 1fr)',
                }}
              >
                {/* Header row */}
                <div style={s.colLabel} />
                {DAYS.map((day, i) => (
                  <div
                    key={i}
                    style={{
                      ...s.dayHeader,
                      background: isSameDay(weekDates[i], TODAY)
                        ? 'rgba(108,143,255,0.06)'
                        : 'transparent',
                    }}
                  >
                    <div
                      style={{
                        ...s.dayName,
                        color: isSameDay(weekDates[i], TODAY)
                          ? '#6c8fff'
                          : '#9499b0',
                      }}
                    >
                      {day}
                    </div>
                    <div
                      style={{
                        ...s.dayDate,
                        color: isSameDay(weekDates[i], TODAY)
                          ? '#6c8fff'
                          : '#e8eaf0',
                      }}
                    >
                      {formatShort(weekDates[i])}
                    </div>
                    {canSeeGaps && getViolations(i).length > 0 && (
                      <div
                        style={s.violationDot}
                        title={getViolations(i).join(', ')}
                      />
                    )}
                  </div>
                ))}

                {/* Early row */}
                <div style={s.shiftLabel}>
                  <div style={s.shiftName}>Early</div>
                  <div style={s.shiftTime}>07:00–14:30</div>
                </div>
                {DAYS.map((_, dayIdx) => {
                  const staffList = currentRotaForWeek.early[dayIdx] || []
                  const isGap = canSeeGaps && staffList.length < 3
                  return (
                    <div
                      key={dayIdx}
                      style={{
                        ...s.cell,
                        background: isGap
                          ? 'rgba(232,92,61,0.06)'
                          : 'transparent',
                        cursor: canEdit ? 'pointer' : 'default',
                      }}
                      onClick={() =>
                        canEdit && setEditCell({ day: dayIdx, shift: 'early' })
                      }
                    >
                      {staffList.map((entry) => {
                        const st = staffMap[entry.id]
                        if (!st) return null
                        return (
                          <div key={entry.id} style={s.chipEarly}>
                            <span style={s.chipName}>
                              {st.name.split(' ')[0]}
                            </span>
                            <span style={s.chipRole}>{st.roleCode}</span>
                          </div>
                        )
                      })}
                      {isGap && <div style={s.gapTag}>GAP</div>}
                      {canEdit && <div style={s.addBtn}>+ Add</div>}
                    </div>
                  )
                })}

                {/* Late row */}
                <div style={s.shiftLabel}>
                  <div style={s.shiftName}>Late</div>
                  <div style={s.shiftTime}>14:00–23:00</div>
                </div>
                {DAYS.map((_, dayIdx) => {
                  const staffList = currentRotaForWeek.late[dayIdx] || []
                  const isGap = canSeeGaps && staffList.length < 3
                  const sleepCount = staffList.filter((e) => e.sleepIn).length
                  return (
                    <div
                      key={dayIdx}
                      style={{
                        ...s.cell,
                        background: isGap
                          ? 'rgba(232,92,61,0.06)'
                          : 'transparent',
                        cursor: canEdit ? 'pointer' : 'default',
                      }}
                      onClick={() =>
                        canEdit && setEditCell({ day: dayIdx, shift: 'late' })
                      }
                    >
                      {staffList.map((entry) => {
                        const st = staffMap[entry.id]
                        if (!st) return null
                        return (
                          <div key={entry.id} style={s.chipLate}>
                            <span style={s.chipName}>
                              {st.name.split(' ')[0]}
                            </span>
                            <span style={s.chipRole}>{st.roleCode}</span>
                            {entry.sleepIn && (
                              <FontAwesomeIcon
                                icon='moon'
                                style={{ fontSize: '9px', color: '#c4883a' }}
                              />
                            )}
                          </div>
                        )
                      })}
                      {canSeeGaps && sleepCount < 2 && (
                        <div style={s.sleepWarn}>
                          <FontAwesomeIcon icon='triangle-exclamation' />{' '}
                          {sleepCount}/2 sleep-ins
                        </div>
                      )}
                      {isGap && <div style={s.gapTag}>GAP</div>}
                      {canEdit && <div style={s.addBtn}>+ Add</div>}
                    </div>
                  )
                })}

                {/* On-call row */}
                <div
                  style={{
                    ...s.shiftLabel,
                    background: 'rgba(58,138,196,0.06)',
                  }}
                >
                  <div style={{ ...s.shiftName, color: '#3a8ac4' }}>
                    On-call
                  </div>
                  <div style={s.shiftTime}>parallel</div>
                </div>
                {DAYS.map((_, dayIdx) => (
                  <div
                    key={dayIdx}
                    style={{ ...s.cell, background: 'rgba(58,138,196,0.04)' }}
                  >
                    {(currentRotaForWeek.onCall[dayIdx] || []).map((id) => {
                      const st = staffMap[id]
                      if (!st) return null
                      return (
                        <div key={id} style={s.chipOncall}>
                          {st.name.split(' ')[0]}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Staff Hours Summary Table - Collapsible */}
            <div style={s.summarySection}>
              <div
                style={s.summaryHeaderBar}
                onClick={() => setSummaryExpanded(!summaryExpanded)}
              >
                <div style={s.summaryTitle}>
                  <FontAwesomeIcon
                    icon={summaryExpanded ? 'chevron-down' : 'chevron-right'}
                  />
                  Staff Hours Summary
                </div>
                <div style={s.summaryHint}>
                  Click to {summaryExpanded ? 'collapse' : 'expand'}
                </div>
              </div>

              {summaryExpanded && (
                <>
                  <div style={s.summaryControls}>
                    <div style={s.summarySubtitle}>
                      Permanent staff (RCW + Senior) · Sorted by hours this week
                      (highest to lowest)
                    </div>
                    <button
                      style={s.toggleZeroBtn}
                      onClick={() => setHideZeroHours(!hideZeroHours)}
                    >
                      <FontAwesomeIcon
                        icon={hideZeroHours ? 'eye-slash' : 'eye'}
                      />
                      {hideZeroHours ? ' Show all staff' : ' Hide zero hours'}
                    </button>
                  </div>

                  <div style={s.tableWrap}>
                    <table style={s.summaryTable}>
                      <thead>
                        <tr style={s.tableHeaderRow}>
                          <th style={s.tableHeader}>Staff</th>
                          <th style={s.tableHeader}>This week</th>
                          <th style={s.tableHeader}>Contracted</th>
                          <th style={s.tableHeader}>Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const permanentStaff = staff.filter(
                            (s) => s.role === 'rcw' || s.role === 'senior'
                          )

                          let staffHours = permanentStaff.map((member) => {
                            const weekHours = calculateStaffHoursForWeek(
                              member.id,
                              currentRotaForWeek,
                              currentMonday,
                              leaveData
                            )
                            const weekVariance = weekHours - 37
                            return { ...member, weekHours, weekVariance }
                          })

                          if (hideZeroHours) {
                            staffHours = staffHours.filter(
                              (member) => member.weekHours > 0
                            )
                          }

                          const sortedStaff = [...staffHours].sort(
                            (a, b) => b.weekHours - a.weekHours
                          )

                          if (sortedStaff.length === 0) {
                            return (
                              <tr>
                                <td colSpan='4' style={s.emptyTableMessage}>
                                  No staff scheduled this week
                                </td>
                              </tr>
                            )
                          }

                          return sortedStaff.map((member) => {
                            const isUnderWeek = member.weekVariance < 0
                            const isOverWeek = member.weekVariance > 0
                            return (
                              <tr key={member.id} style={s.tableRow}>
                                <td style={s.tableCell}>
                                  <div style={s.staffCell}>
                                    <div
                                      style={{
                                        ...s.staffAvatar,
                                        background:
                                          member.gender === 'F'
                                            ? 'rgba(122,79,168,0.2)'
                                            : 'rgba(108,143,255,0.15)',
                                        color:
                                          member.gender === 'F'
                                            ? '#7a4fa8'
                                            : '#6c8fff',
                                      }}
                                    >
                                      {member.name
                                        .split(' ')
                                        .map((n) => n[0])
                                        .join('')}
                                    </div>
                                    <div>
                                      <div style={s.staffCellName}>
                                        {member.name}
                                      </div>
                                      <div style={s.staffCellRole}>
                                        {member.role}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td style={s.tableCell}>
                                  <span style={s.hoursValue}>
                                    {member.weekHours.toFixed(1)}h
                                  </span>
                                </td>
                                <td style={s.tableCell}>
                                  <span style={s.contractedValue}>37h</span>
                                </td>
                                <td style={s.tableCell}>
                                  <span
                                    style={{
                                      ...s.varianceValue,
                                      color: isUnderWeek
                                        ? '#e85c3d'
                                        : isOverWeek
                                          ? '#2ecc8a'
                                          : '#9499b0',
                                      background: isUnderWeek
                                        ? 'rgba(232,92,61,0.1)'
                                        : 'transparent',
                                      padding: isUnderWeek ? '2px 8px' : '0',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    {member.weekVariance > 0 ? '+' : ''}
                                    {member.weekVariance.toFixed(1)}h
                                    {isUnderWeek && (
                                      <FontAwesomeIcon
                                        icon='triangle-exclamation'
                                        style={{
                                          marginLeft: '6px',
                                          fontSize: '10px',
                                        }}
                                      />
                                    )}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Overwrite warning modal */}
      {overwriteTarget && (
        <div style={s.overlayWarn} onClick={() => setOverwriteTarget(null)}>
          <div style={s.warnModal} onClick={(e) => e.stopPropagation()}>
            <div style={s.warnIcon}>
              <FontAwesomeIcon icon='triangle-exclamation' />
            </div>
            <div style={s.warnTitle}>Rota already exists</div>
            <div style={s.warnBody}>
              <strong style={{ color: '#e8eaf0' }}>
                {overwriteTarget.label}
              </strong>{' '}
              already has a generated rota. Regenerating will overwrite all
              existing shifts for this month. Any manual edits will be lost.
            </div>
            <div style={s.warnActions}>
              <button
                style={s.warnCancelBtn}
                onClick={() => setOverwriteTarget(null)}
              >
                Cancel
              </button>
              <button
                style={s.warnConfirmBtn}
                onClick={() => {
                  setGenerateTarget(overwriteTarget)
                  setOverwriteTarget(null)
                }}
              >
                <FontAwesomeIcon icon='bolt' /> Yes, regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single month generate modal */}

      {generateTarget && (
        <GenerateModal
          onClose={() => setGenerateTarget(null)}
          onApplyMonth={handleApplyMonth}
          scopeYear={generateTarget.year}
          scopeMonth={generateTarget.month}
          monthLabel={generateTarget.label}
          staffMap={staffMap}
          timeOff={timeOff}
        />
      )}

      {/* Batch generate modal */}
      {showBatchModal && (
        <BatchGenerateModal
          onClose={() => setShowBatchModal(false)}
          onApplyBatch={handleApplyBatch}
          monthRota={monthRota}
          staffMap={staffMap}
          timeOff={timeOff}
        />
      )}

      {editCell && (
        <CellEditModal
          day={editCell.day}
          shift={editCell.shift}
          staffList={
            editCell.shift === 'early'
              ? currentRotaForWeek.early[editCell.day] || []
              : currentRotaForWeek.late[editCell.day] || []
          }
          staffMap={staffMap}
          staff={staff}
          onClose={() => setEditCell(null)}
          onSave={(updatedList) =>
            handleCellSave(editCell.day, editCell.shift, updatedList)
          }
        />
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
  body: { padding: '24px', maxWidth: '1200px', margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  breadcrumb: {
    fontSize: '12px',
    color: '#6c8fff',
    cursor: 'pointer',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  title: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '22px',
    fontWeight: 600,
    margin: 0,
  },
  subtitle: { fontSize: '13px', color: '#9499b0', marginTop: '4px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  headerActions: { display: 'flex', gap: '8px' },
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
  primaryBtn: {
    background: '#6c8fff',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '9px 16px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  secondaryBtn: {
    background: 'transparent',
    color: '#9499b0',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  batchBtn: {
    background: 'rgba(108,143,255,0.1)',
    color: '#6c8fff',
    border: '1px solid rgba(108,143,255,0.25)',
    borderRadius: '7px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  compStrip: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  chip: {
    fontSize: '12px',
    padding: '5px 10px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  chipOk: {
    background: 'rgba(46,204,138,0.1)',
    color: '#2ecc8a',
    border: '1px solid rgba(46,204,138,0.2)',
  },
  chipWarn: {
    background: 'rgba(232,92,61,0.1)',
    color: '#e85c3d',
    border: '1px solid rgba(232,92,61,0.2)',
  },
  chipInfo: {
    background: 'rgba(255,255,255,0.04)',
    color: '#9499b0',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  weekNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    transition: 'all 0.2s ease',
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
  jumpBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '7px',
    color: '#9499b0',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  legend: { display: 'flex', gap: '12px', marginLeft: 'auto' },
  legendItem: { fontSize: '11px' },
  pinBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '7px',
    width: '32px',
    height: '32px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    marginLeft: '4px',
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
  rotaBadge: {
    fontSize: '10px',
    fontWeight: 500,
    padding: '2px 7px',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
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
  miniFooter: {
    marginTop: '10px',
    display: 'flex',
    gap: '5px',
    flexWrap: 'wrap',
    minHeight: '26px',
    alignItems: 'center',
  },
  miniChip: {
    fontSize: '10px',
    fontWeight: 500,
    padding: '2px 7px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  generateBtn: {
    borderRadius: '7px',
    padding: '5px 12px',
    fontSize: '11.5px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    width: '100%',
    justifyContent: 'center',
  },
  gridWrap: { overflowX: 'auto' },
  grid: {
    display: 'grid',
    minWidth: '700px',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px',
    overflow: 'hidden',
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
  violationDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#e85c3d',
    margin: '4px auto 0',
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
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    position: 'relative',
  },
  chipEarly: {
    background: 'rgba(42,127,98,0.15)',
    border: '1px solid rgba(42,127,98,0.3)',
    borderRadius: '5px',
    padding: '3px 6px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  chipLate: {
    background: 'rgba(122,79,168,0.15)',
    border: '1px solid rgba(122,79,168,0.3)',
    borderRadius: '5px',
    padding: '3px 6px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  chipOncall: {
    background: 'rgba(58,138,196,0.12)',
    border: '1px solid rgba(58,138,196,0.25)',
    borderRadius: '5px',
    padding: '3px 6px',
    fontSize: '11px',
    color: '#3a8ac4',
  },
  chipName: { fontSize: '11px', color: '#e8eaf0', fontWeight: 500 },
  chipRole: {
    fontSize: '9px',
    color: '#9499b0',
    fontFamily: 'DM Mono, monospace',
  },
  gapTag: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#e85c3d',
    background: 'rgba(232,92,61,0.15)',
    border: '1px solid rgba(232,92,61,0.3)',
    borderRadius: '4px',
    padding: '2px 5px',
    alignSelf: 'flex-start',
  },
  sleepWarn: {
    fontSize: '10px',
    color: '#c4883a',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  addBtn: {
    fontSize: '10px',
    color: '#5d6180',
    marginTop: 'auto',
    cursor: 'pointer',
  },
  overlayWarn: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
    padding: '20px',
  },
  warnModal: {
    background: '#161820',
    border: '1px solid rgba(232,92,61,0.3)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '420px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px',
  },
  warnIcon: {
    fontSize: '32px',
    color: '#e85c3d',
    background: 'rgba(232,92,61,0.12)',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warnTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '18px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  warnBody: {
    fontSize: '13px',
    color: '#9499b0',
    lineHeight: 1.6,
    maxWidth: '340px',
  },
  warnActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '8px',
    width: '100%',
  },
  warnCancelBtn: {
    flex: 1,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#9499b0',
    padding: '10px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  warnConfirmBtn: {
    flex: 1,
    background: 'rgba(232,92,61,0.15)',
    border: '1px solid rgba(232,92,61,0.35)',
    borderRadius: '8px',
    color: '#e85c3d',
    padding: '10px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  hintText: {
    fontSize: '12px',
    color: '#5d6180',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '16px',
  },
  summarySection: {
    marginTop: '24px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  summaryHeaderBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    background: '#1d1f2b',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  summaryTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '14px',
    fontWeight: 600,
    color: '#e8eaf0',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  summaryHint: {
    fontSize: '11px',
    color: '#5d6180',
  },
  summaryControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '12px',
    marginBottom: '16px',
  },
  summarySubtitle: {
    fontSize: '11px',
    color: '#5d6180',
  },
  toggleZeroBtn: {
    background: 'rgba(108,143,255,0.1)',
    border: '1px solid rgba(108,143,255,0.2)',
    borderRadius: '6px',
    padding: '5px 10px',
    fontSize: '11px',
    color: '#6c8fff',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.07)',
    background: '#161820',
  },
  summaryTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    minWidth: '700px',
  },
  tableHeaderRow: {
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: '#1d1f2b',
  },
  tableHeader: {
    textAlign: 'left',
    padding: '12px 16px',
    color: '#9499b0',
    fontWeight: 500,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tableRow: {
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  tableCell: {
    padding: '10px 16px',
    color: '#e8eaf0',
  },
  staffCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  staffAvatar: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 600,
    fontFamily: 'Syne, sans-serif',
    flexShrink: 0,
  },
  staffCellName: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#e8eaf0',
  },
  staffCellRole: {
    fontSize: '10px',
    color: '#9499b0',
    fontFamily: 'DM Mono, monospace',
    marginTop: '2px',
  },
  hoursValue: {
    fontWeight: 500,
    color: '#e8eaf0',
    fontFamily: 'DM Mono, monospace',
  },
  contractedValue: {
    color: '#5d6180',
    fontFamily: 'DM Mono, monospace',
  },
  varianceValue: {
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: 'DM Mono, monospace',
  },
  emptyTableMessage: {
    textAlign: 'center',
    padding: '32px',
    color: '#5d6180',
    fontSize: '13px',
  },
}

export default Rota
