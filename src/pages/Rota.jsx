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
import { getActiveMoveForStaff } from '../utils/staffMoves'
import { calculateStaffHoursForWeek } from '../utils/hoursCalculator'
import styles from './Rota.module.css'

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
  unplanned: 'var(--bg-elevated)',
}

const HEALTH_TEXT = {
  gap: '#e85c3d',
  breach: '#c4883a',
  ok: '#2ecc8a',
  unplanned: 'var(--text-muted)',
}

function Rota() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [hideZeroHours, setHideZeroHours] = useState(false)
  const [isNavPinned, setIsNavPinned] = useState(() => {
    try {
      return localStorage.getItem('rotapp_month_nav_pinned') === 'true'
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

  const {
    staff,
    staffMap,
    staffLoading,
    monthRota,
    setMonthRota,
    resetRota,
    rotaLoading,
    refreshMonthRota,
    leaveDays,
    cancelRequests,
    homeName,
    moveRecords,
  } = useRota()

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
    <div className={styles.page}>
      <Navbar />

      <div className={styles.body}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div
              className={styles.breadcrumb}
              onClick={() => navigate('/dashboard')}
            >
              <FontAwesomeIcon icon='chevron-left' /> Dashboard
            </div>
            <h1 className={styles.title}>
              {viewMode === 'week' ? 'Weekly Rota' : 'Rota Planner'}
            </h1>

            <p className={styles.subtitle}>
              {homeName || '—'} ·{' '}
              {viewMode === 'week'
                ? `${startLabel} – ${endLabel}`
                : `${currentYear}`}
            </p>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.viewToggle}>
              {[
                { value: 'month', label: 'Month' },
                { value: 'week', label: 'Week' },
              ].map((v) => (
                <button
                  key={v.value}
                  className={`${styles.toggleBtn}${viewMode === v.value ? ` ${styles.toggleBtnActive}` : ''}`}
                  onClick={() => setViewMode(v.value)}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {canEdit && viewMode === 'week' && (
              <div className={styles.headerActions}>
                <button className={styles.secondaryBtn}>Publish</button>
              </div>
            )}
          </div>
        </div>

        {/* Compliance strip — week view only */}
        {viewMode === 'week' && canSeeGaps && (
          <div className={styles.compStrip}>
            {totalViolations === 0 ? (
              <span className={`${styles.chip} ${styles.chipOk}`}>
                <FontAwesomeIcon icon='check' /> All shifts compliant
              </span>
            ) : (
              <span className={`${styles.chip} ${styles.chipWarn}`}>
                <FontAwesomeIcon icon='triangle-exclamation' />{' '}
                {totalViolations} violation{totalViolations > 1 ? 's' : ''} this
                week
              </span>
            )}
            <span className={`${styles.chip} ${styles.chipInfo}`}>
              2 sleep-ins checked nightly
            </span>
            <span className={`${styles.chip} ${styles.chipInfo}`}>
              On-call: 7/7 days
            </span>
          </div>
        )}

        {/* Navigation bar */}
        <div
          className={`${styles.weekNav}${isNavPinned ? ` ${styles.weekNavPinned}` : ''}`}
        >
          {viewMode === 'week' ? (
            <>
              <button className={styles.navArrow} onClick={prevWeek}>
                <FontAwesomeIcon icon='chevron-left' />
              </button>
              <span
                className={styles.weekLabel}
              >{`${startLabel} – ${endLabel}`}</span>
              <button className={styles.navArrow} onClick={nextWeek}>
                <FontAwesomeIcon icon='chevron-right' />
              </button>

              <div className={styles.jumpBtnWrap}>
                <button
                  className={`${styles.jumpBtn}${showJump ? ` ${styles.jumpBtnActive}` : ''}`}
                  onClick={() => setShowJump((v) => !v)}
                >
                  <FontAwesomeIcon icon='calendar-days' />
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

              <div className={styles.legend}>
                <span
                  className={styles.legendItem}
                  style={{ color: '#2a7f62' }}
                >
                  ■ Early
                </span>
                <span
                  className={styles.legendItem}
                  style={{ color: '#7a4fa8' }}
                >
                  ■ Late
                </span>
                <span
                  className={styles.legendItem}
                  style={{ color: '#c4883a' }}
                >
                  ■ Sleep-in
                </span>
              </div>
            </>
          ) : (
            <>
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
                className={styles.jumpBtn}
                onClick={() => {
                  setCurrentYear(TODAY.getFullYear())
                  setMonday(getMondayOfWeek(TODAY))
                }}
              >
                Today
              </button>

              {canEdit && (
                <button
                  className={styles.batchBtn}
                  onClick={() => setShowBatchModal(true)}
                >
                  <FontAwesomeIcon icon='bolt' /> Batch generate
                </button>
              )}

              <div className={styles.legend}>
                <span
                  className={styles.legendItem}
                  style={{ color: HEALTH_COLOURS.ok }}
                >
                  ■ Compliant
                </span>
                <span
                  className={styles.legendItem}
                  style={{ color: HEALTH_COLOURS.breach }}
                >
                  ■ Breach
                </span>
                <span
                  className={styles.legendItem}
                  style={{ color: HEALTH_COLOURS.gap }}
                >
                  ■ Gap
                </span>
                <span
                  className={styles.legendItem}
                  style={{ color: 'var(--text-muted)' }}
                >
                  ■ Not planned
                </span>
              </div>

              <button
                className={`${styles.pinBtn}${isNavPinned ? ` ${styles.pinBtnActive}` : ''}`}
                onClick={togglePinNav}
                title={
                  isNavPinned ? 'Unpin navigation bar' : 'Pin navigation bar'
                }
              >
                <FontAwesomeIcon icon='thumbtack' />
              </button>
            </>
          )}
        </div>

        {/* MONTH VIEW */}
        {viewMode === 'month' && (
          <>
            <div className={styles.yearWrap}>
              {yearMonths.map(({ year, month, label }) => {
                const monthDates = getMonthDates(year, month)
                const hasRota = monthHasRota(year, month)
                const isHovered = hoveredMonth === label
                const monthHealth = getMonthHealth(
                  monthDates,
                  month,
                  getRotaForDate,
                  staffMap
                )

                return (
                  <div
                    key={label}
                    className={styles.miniMonth}
                    onMouseEnter={() => setHoveredMonth(label)}
                    onMouseLeave={() => setHoveredMonth(null)}
                    onClick={() => {
                      setMonday(getMondayOfWeek(new Date(year, month, 1)))
                      setCurrentYear(year)
                      setViewMode('week')
                    }}
                  >
                    <div className={styles.miniMonthHeader}>
                      <span className={styles.miniMonthTitle}>{label}</span>
                      {hasRota && (
                        <span
                          className={styles.rotaBadge}
                          style={{
                            background:
                              monthHealth === 'ok'
                                ? 'var(--color-success-bg)'
                                : monthHealth === 'breach'
                                  ? 'var(--color-warning-bg)'
                                  : monthHealth === 'gap'
                                    ? 'var(--color-danger-bg)'
                                    : 'var(--bg-overlay)',
                            color:
                              monthHealth === 'ok'
                                ? 'var(--color-success)'
                                : monthHealth === 'breach'
                                  ? 'var(--color-warning)'
                                  : monthHealth === 'gap'
                                    ? 'var(--color-danger)'
                                    : 'var(--text-muted)',
                          }}
                        >
                          {monthHealth === 'ok' && (
                            <>
                              <FontAwesomeIcon icon='check' /> Compliant
                            </>
                          )}
                          {monthHealth === 'breach' && ' Has breaches'}
                          {monthHealth === 'gap' && ' Has gaps'}
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
                        const dayOfWeek = (date.getDay() + 6) % 7
                        const rota = inMonth ? getRotaForDate(date) : null
                        const health = inMonth
                          ? getDayHealth(rota, dayOfWeek, staffMap)
                          : null

                        return (
                          <div
                            key={i}
                            className={styles.miniCell}
                            style={{
                              opacity: inMonth ? 1 : 0,
                              background: inMonth
                                ? health === 'unplanned'
                                  ? HEALTH_COLOURS.unplanned
                                  : `${HEALTH_COLOURS[health]}22`
                                : 'transparent',
                              border: isToday
                                ? '1.5px solid var(--accent)'
                                : inMonth && health !== 'unplanned'
                                  ? `1px solid ${HEALTH_COLOURS[health]}55`
                                  : '1px solid var(--border-subtle)',
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

                    <div className={styles.miniFooter}>
                      {isHovered && canEdit ? (
                        <button
                          className={styles.generateBtn}
                          style={{
                            background: hasRota
                              ? 'var(--color-warning-bg)'
                              : 'var(--accent-bg)',
                            color: hasRota
                              ? 'var(--color-warning)'
                              : 'var(--accent)',
                            border: hasRota
                              ? '1px solid var(--color-warning-border)'
                              : '1px solid var(--accent-border)',
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
                                  className={styles.miniChip}
                                  style={{
                                    color: 'var(--color-danger)',
                                    background: 'var(--color-danger-bg)',
                                  }}
                                >
                                  {counts.gap} gap{counts.gap > 1 ? 's' : ''}
                                </span>
                              )}
                              {counts.breach > 0 && (
                                <span
                                  className={styles.miniChip}
                                  style={{
                                    color: 'var(--color-warning)',
                                    background: 'var(--color-warning-bg)',
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
                                    className={styles.miniChip}
                                    style={{
                                      color: 'var(--color-success)',
                                      background: 'var(--color-success-bg)',
                                    }}
                                  >
                                    <FontAwesomeIcon icon='check' /> All clear
                                  </span>
                                )}
                              {counts.unplanned > 0 &&
                                counts.gap === 0 &&
                                counts.breach === 0 && (
                                  <span
                                    className={styles.miniChip}
                                    style={{
                                      color: 'var(--text-muted)',
                                      background: 'var(--bg-hover)',
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
            <div className={styles.gridWrap}>
              <div
                className={styles.grid}
                style={{ gridTemplateColumns: '120px repeat(7, 1fr)' }}
              >
                {/* Header row */}
                <div className={styles.colLabel} />
                {DAYS.map((day, i) => {
                  const isToday = isSameDay(weekDates[i], TODAY)
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
                        {formatShort(weekDates[i])}
                      </div>
                      {canSeeGaps && getViolations(i).length > 0 && (
                        <div
                          className={styles.violationDot}
                          title={getViolations(i).join(', ')}
                        />
                      )}
                    </div>
                  )
                })}

                {/* Early row */}
                <div className={styles.shiftLabel}>
                  <div className={styles.shiftName}>Early</div>
                  <div className={styles.shiftTime}>07:00–14:30</div>
                </div>
                {DAYS.map((_, dayIdx) => {
                  const staffList = currentRotaForWeek.early[dayIdx] || []
                  const isGap = canSeeGaps && staffList.length < 3
                  return (
                    <div
                      key={dayIdx}
                      className={styles.cell}
                      style={{
                        background: isGap
                          ? 'var(--color-danger-bg)'
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
                        const hasMoved = !!getActiveMoveForStaff(
                          moveRecords,
                          entry.id,
                          user.home
                        )
                        return (
                          <div key={entry.id} className={styles.chipEarly}>
                            <span className={styles.chipName}>
                              {st.name.split(' ')[0]}
                            </span>
                            <span className={styles.chipRole}>
                              {st.roleCode}
                            </span>
                            {hasMoved && (
                              <span className={styles.movedTag}>
                                <FontAwesomeIcon icon='right-left' /> Moved
                              </span>
                            )}
                          </div>
                        )
                      })}
                      {isGap && <div className={styles.gapTag}>GAP</div>}
                      {canEdit && <div className={styles.addBtn}>+ Add</div>}
                    </div>
                  )
                })}

                {/* Late row */}
                <div className={styles.shiftLabel}>
                  <div className={styles.shiftName}>Late</div>
                  <div className={styles.shiftTime}>14:00–23:00</div>
                </div>
                {DAYS.map((_, dayIdx) => {
                  const staffList = currentRotaForWeek.late[dayIdx] || []
                  const isGap = canSeeGaps && staffList.length < 3
                  const sleepCount = staffList.filter((e) => e.sleepIn).length
                  return (
                    <div
                      key={dayIdx}
                      className={styles.cell}
                      style={{
                        background: isGap
                          ? 'var(--color-danger-bg)'
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
                        const hasMoved = !!getActiveMoveForStaff(
                          moveRecords,
                          entry.id,
                          user.home
                        )
                        return (
                          <div key={entry.id} className={styles.chipLate}>
                            <span className={styles.chipName}>
                              {st.name.split(' ')[0]}
                            </span>
                            <span className={styles.chipRole}>
                              {st.roleCode}
                            </span>
                            {entry.sleepIn && (
                              <FontAwesomeIcon
                                icon='moon'
                                style={{ fontSize: '9px', color: '#c4883a' }}
                              />
                            )}
                            {hasMoved && (
                              <span className={styles.movedTag}>
                                <FontAwesomeIcon icon='right-left' /> Moved
                              </span>
                            )}
                          </div>
                        )
                      })}

                      {canSeeGaps && sleepCount < 2 && (
                        <div className={styles.sleepWarn}>
                          <FontAwesomeIcon icon='triangle-exclamation' />{' '}
                          {sleepCount}/2 sleep-ins
                        </div>
                      )}
                      {isGap && <div className={styles.gapTag}>GAP</div>}
                      {canEdit && <div className={styles.addBtn}>+ Add</div>}
                    </div>
                  )
                })}

                {/* On-call row */}
                <div
                  className={styles.shiftLabel}
                  style={{ background: 'var(--color-info-bg)' }}
                >
                  <div
                    className={styles.shiftName}
                    style={{ color: 'var(--color-info)' }}
                  >
                    On-call
                  </div>
                  <div className={styles.shiftTime}>parallel</div>
                </div>
                {DAYS.map((_, dayIdx) => (
                  <div
                    key={dayIdx}
                    className={styles.cell}
                    style={{ background: 'var(--color-info-bg)' }}
                  >
                    {(currentRotaForWeek.onCall[dayIdx] || []).map((id) => {
                      const st = staffMap[id]
                      if (!st) return null
                      return (
                        <div key={id} className={styles.chipOncall}>
                          {st.name.split(' ')[0]}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Staff Hours Summary */}
            <div className={styles.summarySection}>
              <div
                className={styles.summaryHeaderBar}
                onClick={() => setSummaryExpanded(!summaryExpanded)}
              >
                <div className={styles.summaryTitle}>
                  <FontAwesomeIcon
                    icon={summaryExpanded ? 'chevron-down' : 'chevron-right'}
                  />
                  Staff Hours Summary
                </div>
                <div className={styles.summaryHint}>
                  Click to {summaryExpanded ? 'collapse' : 'expand'}
                </div>
              </div>

              {summaryExpanded && (
                <>
                  <div className={styles.summaryControls}>
                    <div className={styles.summarySubtitle}>
                      Permanent staff (RCW + Senior) · Sorted by hours this week
                      (highest to lowest)
                    </div>
                    <button
                      className={styles.toggleZeroBtn}
                      onClick={() => setHideZeroHours(!hideZeroHours)}
                    >
                      <FontAwesomeIcon
                        icon={hideZeroHours ? 'eye-slash' : 'eye'}
                      />
                      {hideZeroHours ? ' Show all staff' : ' Hide zero hours'}
                    </button>
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={styles.summaryTable}>
                      <thead>
                        <tr className={styles.tableHeaderRow}>
                          <th className={styles.tableHeader}>Staff</th>
                          <th className={styles.tableHeader}>This week</th>
                          <th className={styles.tableHeader}>Contracted</th>
                          <th className={styles.tableHeader}>Variance</th>
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
                              leaveDays
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
                                <td
                                  colSpan='4'
                                  className={styles.emptyTableMessage}
                                >
                                  No staff scheduled this week
                                </td>
                              </tr>
                            )
                          }

                          return sortedStaff.map((member) => {
                            const isUnderWeek = member.weekVariance < 0
                            const isOverWeek = member.weekVariance > 0
                            return (
                              <tr key={member.id} className={styles.tableRow}>
                                <td className={styles.tableCell}>
                                  <div className={styles.staffCell}>
                                    <div
                                      className={styles.staffAvatar}
                                      style={{
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
                                      <div className={styles.staffCellName}>
                                        {member.name}
                                      </div>
                                      <div className={styles.staffCellRole}>
                                        {member.role}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className={styles.tableCell}>
                                  <span className={styles.hoursValue}>
                                    {member.weekHours.toFixed(1)}h
                                  </span>
                                </td>
                                <td className={styles.tableCell}>
                                  <span className={styles.contractedValue}>
                                    37h
                                  </span>
                                </td>
                                <td className={styles.tableCell}>
                                  <span
                                    className={styles.varianceValue}
                                    style={{
                                      color: isUnderWeek
                                        ? 'var(--color-danger)'
                                        : isOverWeek
                                          ? 'var(--color-success)'
                                          : 'var(--text-secondary)',
                                      background: isUnderWeek
                                        ? 'var(--color-danger-bg)'
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
        <div
          className={styles.overlayWarn}
          onClick={() => setOverwriteTarget(null)}
        >
          <div
            className={styles.warnModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.warnIcon}>
              <FontAwesomeIcon icon='triangle-exclamation' />
            </div>
            <div className={styles.warnTitle}>Rota already exists</div>
            <div className={styles.warnBody}>
              <strong>{overwriteTarget.label}</strong> already has a generated
              rota. Regenerating will overwrite all existing shifts for this
              month. Any manual edits will be lost.
            </div>
            <div className={styles.warnActions}>
              <button
                className={styles.warnCancelBtn}
                onClick={() => setOverwriteTarget(null)}
              >
                Cancel
              </button>
              <button
                className={styles.warnConfirmBtn}
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

      {generateTarget && (
        <GenerateModal
          onClose={() => setGenerateTarget(null)}
          onApplyMonth={handleApplyMonth}
          scopeYear={generateTarget.year}
          scopeMonth={generateTarget.month}
          monthLabel={generateTarget.label}
          staffMap={staffMap}
          timeOff={leaveDays}
        />
      )}

      {showBatchModal && (
        <BatchGenerateModal
          onClose={() => setShowBatchModal(false)}
          onApplyBatch={handleApplyBatch}
          monthRota={monthRota}
          staffMap={staffMap}
          timeOff={leaveDays}
          homeName={homeName}
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

export default Rota
