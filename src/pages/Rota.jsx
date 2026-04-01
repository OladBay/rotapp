import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import GenerateModal from '../components/layout/GenerateModal'
import { mockRota, mockStaff } from '../data/mockRota'
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
} from '../utils/dateUtils'

const TODAY = new Date()
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Day health classification ────────────────────────────────────────────────
// Returns 'gap' | 'breach' | 'ok' | 'unplanned'
// rota       — the week rota object { early, late, onCall }
// dayOfWeek  — 0 (Mon) … 6 (Sun)
function getDayHealth(rota, dayOfWeek) {
  if (!rota) return 'unplanned'
  const early = rota.early?.[dayOfWeek] || []
  const late = rota.late?.[dayOfWeek] || []

  // No data at all → unplanned
  if (early.length === 0 && late.length === 0) return 'unplanned'

  // Hard rule breach OR gap → red
  const sleepIns = late.filter((e) => e.sleepIn).length
  if (early.length < 3 || late.length < 3 || sleepIns !== 2) return 'gap'

  // Soft rule breaches → yellow (we check female and driver)
  const staffMap = Object.fromEntries(mockStaff.map((s) => [s.id, s]))
  const earlyHasF = early.some((e) => staffMap[e.id]?.gender === 'F')
  const lateHasF = late.some((e) => staffMap[e.id]?.gender === 'F')
  const earlyHasD = early.some((e) => staffMap[e.id]?.driver)
  const lateHasD = late.some((e) => staffMap[e.id]?.driver)
  if (!earlyHasF || !lateHasF || !earlyHasD || !lateHasD) return 'breach'

  return 'ok'
}

// Colour values for day health
const HEALTH_COLOURS = {
  gap: '#e85c3d',
  breach: '#c4883a',
  ok: '#2ecc8a',
  unplanned: '#2e3045', // muted, "not yet planned"
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

  // viewMode: 'week' | 'year'
  const [viewMode, setViewMode] = useState('week')
  const [currentMonday, setMonday] = useState(getMondayOfWeek(TODAY))
  const [currentYear, setCurrentYear] = useState(TODAY.getFullYear())

  // Rota data:
  //   weekRota  — single-week rota (the original shape, for the current week)
  //   monthRota — map of { [mondayKey]: rota } when a full month has been generated
  const [weekRota, setWeekRota] = useState(mockRota)
  const [monthRota, setMonthRota] = useState({}) // { [mondayKey]: rota }

  const [showGenerate, setShowGenerate] = useState(false)
  const [jumpValue, setJumpValue] = useState('')
  const [showJump, setShowJump] = useState(false)

  const weekDates = getWeekDates(currentMonday)
  const yearMonths = useMemo(() => getYearMonths(currentYear), [currentYear])

  const staffMap = Object.fromEntries(mockStaff.map((s) => [s.id, s]))
  const canEdit = ['manager', 'deputy', 'superadmin'].includes(user?.activeRole)
  const canSeeGaps = [
    'manager',
    'deputy',
    'senior',
    'operationallead',
    'superadmin',
  ].includes(user?.activeRole)

  // The rota to display for the current week —
  // if we have a month-generated rota for this Monday, use it; otherwise fall back to weekRota
  const currentRotaForWeek = monthRota[dateKey(currentMonday)] || weekRota

  const startLabel = formatDate(weekDates[0])
  const endLabel = formatDate(weekDates[6])

  // Month label derived from currentMonday (used in week view header + generate modal)
  const monthLabel = currentMonday.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  // ── Navigation ──────────────────────────────────────────────────────────────
  const prevWeek = () => setMonday((prev) => addWeeks(prev, -1))
  const nextWeek = () => setMonday((prev) => addWeeks(prev, 1))

  const handleJump = () => {
    if (!jumpValue) return
    const picked = new Date(jumpValue)
    if (isNaN(picked)) return
    setMonday(getMondayOfWeek(picked))
    setCurrentYear(picked.getFullYear())
    setShowJump(false)
    setJumpValue('')
    setViewMode('week')
  }

  // ── Violations for the current week (used in compliance strip) ──────────────
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

  // ── Generate modal callbacks ────────────────────────────────────────────────
  const handleApplyWeek = (newRota) => {
    setWeekRota(newRota)
  }

  const handleApplyMonth = ({ weekRotas }) => {
    setMonthRota((prev) => ({ ...prev, ...weekRotas }))
  }

  // ── Get rota for any given date (for year view colouring) ───────────────────
  const getRotaForDate = (date) => {
    const monday = getMondayOfWeek(date)
    const key = dateKey(monday)
    return (
      monthRota[key] || (isSameDay(monday, currentMonday) ? weekRota : null)
    )
  }

  return (
    <div style={s.page}>
      <Navbar />

      <div style={s.body}>
        {/* ── Header ── */}
        <div style={s.header}>
          <div>
            <div style={s.breadcrumb} onClick={() => navigate('/dashboard')}>
              <FontAwesomeIcon icon='chevron-left' /> Dashboard
            </div>
            <h1 style={s.title}>
              {viewMode === 'week' ? 'Weekly Rota' : 'Rota Calendar'}
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
                { value: 'week', label: 'Week' },
                { value: 'year', label: 'Month' },
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
            {canEdit && (
              <div style={s.headerActions}>
                <button style={s.secondaryBtn}>Publish</button>
                <button
                  style={s.primaryBtn}
                  onClick={() => setShowGenerate(true)}
                >
                  <FontAwesomeIcon icon='bolt' /> Generate
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Compliance strip (week view only) ── */}
        {viewMode === 'week' && canSeeGaps && (
          <div style={s.compStrip}>
            {totalViolations === 0 ? (
              <span style={{ ...s.chip, ...s.chipOk }}>
                ✓ All shifts compliant
              </span>
            ) : (
              <span style={{ ...s.chip, ...s.chipWarn }}>
                ⚠ {totalViolations} violation{totalViolations > 1 ? 's' : ''}{' '}
                this week
              </span>
            )}
            <span style={{ ...s.chip, ...s.chipInfo }}>
              2 sleep-ins checked nightly
            </span>
            <span style={{ ...s.chip, ...s.chipInfo }}>On-call: 7/7 days</span>
          </div>
        )}

        {/* ── Navigation bar ── */}
        <div style={s.weekNav}>
          {viewMode === 'week' ? (
            <>
              <button style={s.navArrow} onClick={prevWeek}>
                <FontAwesomeIcon icon='chevron-left' />
              </button>
              <span style={s.weekLabel}>{`${startLabel} – ${endLabel}`}</span>
              <button style={s.navArrow} onClick={nextWeek}>
                <FontAwesomeIcon icon='chevron-right' />
              </button>
              <button style={s.jumpBtn} onClick={() => setShowJump(!showJump)}>
                Jump to date
              </button>
              {showJump && (
                <div style={s.jumpWrap}>
                  <input
                    type='date'
                    value={jumpValue}
                    onChange={(e) => setJumpValue(e.target.value)}
                    style={s.jumpInput}
                  />
                  <button style={s.primaryBtn} onClick={handleJump}>
                    Go
                  </button>
                </div>
              )}
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
              {/* Year view legend */}
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
            </>
          )}
        </div>

        {/* ── WEEK VIEW ── */}
        {viewMode === 'week' && (
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
                    }}
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
                    }}
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
                          {entry.sleepIn && <span>💤</span>}
                        </div>
                      )
                    })}
                    {canSeeGaps && sleepCount < 2 && (
                      <div style={s.sleepWarn}>⚠ {sleepCount}/2 sleep-ins</div>
                    )}
                    {isGap && <div style={s.gapTag}>GAP</div>}
                    {canEdit && <div style={s.addBtn}>+ Add</div>}
                  </div>
                )
              })}

              {/* On-call row */}
              <div
                style={{ ...s.shiftLabel, background: 'rgba(58,138,196,0.06)' }}
              >
                <div style={{ ...s.shiftName, color: '#3a8ac4' }}>On-call</div>
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
        )}

        {/* ── YEAR VIEW ── */}
        {viewMode === 'year' && (
          <div style={s.yearWrap}>
            {yearMonths.map(({ year, month, label }) => {
              const monthDates = getMonthDates(year, month)

              return (
                <div
                  key={`${year}-${month}`}
                  style={s.miniMonth}
                  onClick={() => {
                    // Navigate to first Monday of this month and switch to week view
                    const firstOfMonth = new Date(year, month, 1)
                    setMonday(getMondayOfWeek(firstOfMonth))
                    setCurrentYear(year)
                    setViewMode('week')
                  }}
                >
                  {/* Month name header */}
                  <div style={s.miniMonthTitle}>{label}</div>

                  {/* Day-of-week headers */}
                  <div style={s.miniDayHeaders}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                      <div key={i} style={s.miniDayHead}>
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div style={s.miniGrid}>
                    {monthDates.map((date, i) => {
                      const inMonth = date.getMonth() === month
                      const isToday = isSameDay(date, TODAY)
                      const dayOfWeek = (date.getDay() + 6) % 7
                      const rota = inMonth ? getRotaForDate(date) : null
                      const health = inMonth
                        ? getDayHealth(rota, dayOfWeek)
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
                                : `${HEALTH_COLOURS[health]}22` // transparent fill
                              : 'transparent',
                            border: isToday
                              ? '1.5px solid #6c8fff'
                              : inMonth && health !== 'unplanned'
                                ? `1px solid ${HEALTH_COLOURS[health]}55`
                                : '1px solid rgba(255,255,255,0.04)',
                          }}
                          onClick={(e) => {
                            // Stop month-click from also firing
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

                  {/* Month summary chips */}
                  <div style={s.miniFooter}>
                    {(() => {
                      // Count health states for days in this month
                      const counts = { ok: 0, breach: 0, gap: 0, unplanned: 0 }
                      monthDates.forEach((date) => {
                        if (date.getMonth() !== month) return
                        const dayOfWeek = (date.getDay() + 6) % 7
                        const rota = getRotaForDate(date)
                        const h = getDayHealth(rota, dayOfWeek)
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
                                ✓ All clear
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
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showGenerate && (
        <GenerateModal
          onClose={() => setShowGenerate(false)}
          onApply={handleApplyWeek}
          onApplyMonth={handleApplyMonth}
          currentMonday={currentMonday}
          scopeYear={currentMonday.getFullYear()}
          scopeMonth={currentMonday.getMonth()}
          monthLabel={monthLabel}
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
  compStrip: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  chip: {
    fontSize: '12px',
    fontWeight: 500,
    padding: '5px 10px',
    borderRadius: '20px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
  },
  chipOk: { background: 'rgba(46,204,138,0.12)', color: '#2ecc8a' },
  chipWarn: { background: 'rgba(232,92,61,0.12)', color: '#e85c3d' },
  chipInfo: { background: 'rgba(108,143,255,0.12)', color: '#6c8fff' },
  weekNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  navArrow: {
    width: '30px',
    height: '30px',
    borderRadius: '7px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: '#9499b0',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: {
    fontSize: '13px',
    color: '#e8eaf0',
    fontFamily: 'DM Mono, monospace',
    minWidth: '140px',
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
  jumpWrap: { display: 'flex', gap: '8px', alignItems: 'center' },
  jumpInput: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '7px',
    color: '#e8eaf0',
    padding: '6px 10px',
    fontSize: '13px',
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none',
  },
  legend: {
    display: 'flex',
    gap: '12px',
    marginLeft: 'auto',
    flexWrap: 'wrap',
  },
  legendItem: { fontSize: '12px' },
  // ── Week grid ──
  gridWrap: { overflowX: 'auto' },
  grid: {
    display: 'grid',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px',
    overflow: 'hidden',
    minWidth: '500px',
    background: '#161820',
  },
  colLabel: {
    background: '#1d1f2b',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
  },
  dayHeader: {
    padding: '10px 10px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    textAlign: 'center',
    position: 'relative',
  },
  dayName: {
    fontSize: '11px',
    fontWeight: 500,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
  },
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
    position: 'absolute',
    top: '8px',
    right: '8px',
  },
  shiftLabel: {
    padding: '12px 10px',
    background: '#1d1f2b',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  shiftName: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#e8eaf0',
    fontFamily: 'Syne, sans-serif',
  },
  shiftTime: {
    fontSize: '10px',
    color: '#5d6180',
    fontFamily: 'DM Mono, monospace',
    marginTop: '3px',
  },
  cell: {
    padding: '8px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    minHeight: '90px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  chipEarly: {
    background: 'rgba(42,127,98,0.18)',
    border: '1px solid rgba(42,127,98,0.35)',
    color: '#2a7f62',
    borderRadius: '6px',
    padding: '4px 7px',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  chipLate: {
    background: 'rgba(122,79,168,0.18)',
    border: '1px solid rgba(122,79,168,0.35)',
    color: '#7a4fa8',
    borderRadius: '6px',
    padding: '4px 7px',
    fontSize: '11px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  chipOncall: {
    background: 'rgba(58,138,196,0.12)',
    color: '#3a8ac4',
    borderRadius: '5px',
    padding: '3px 7px',
    fontSize: '11px',
  },
  chipName: { flex: 1 },
  chipRole: { fontSize: '9px', opacity: 0.7, fontFamily: 'DM Mono, monospace' },
  sleepWarn: { fontSize: '10px', color: '#c4883a' },
  gapTag: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#e85c3d',
    background: 'rgba(232,92,61,0.12)',
    padding: '2px 6px',
    borderRadius: '4px',
    width: 'fit-content',
  },
  addBtn: {
    fontSize: '11px',
    color: '#5d6180',
    border: '1px dashed rgba(255,255,255,0.1)',
    borderRadius: '6px',
    padding: '4px 8px',
    cursor: 'pointer',
    textAlign: 'center',
    marginTop: 'auto',
  },
  // ── Year view ──
  yearWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
  },
  miniMonth: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '14px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    ':hover': { borderColor: 'rgba(108,143,255,0.3)' },
  },
  miniMonthTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '13px',
    fontWeight: 600,
    color: '#e8eaf0',
    marginBottom: '8px',
    letterSpacing: '0.2px',
  },
  miniDayHeaders: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    marginBottom: '4px',
  },
  miniDayHead: {
    textAlign: 'center',
    fontSize: '9px',
    color: '#3d405a',
    fontWeight: 500,
    padding: '2px 0',
  },
  miniGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px',
  },
  miniCell: {
    borderRadius: '3px',
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    minWidth: 0,
    transition: 'opacity 0.1s',
  },
  miniDateNum: {
    fontSize: '9px',
    lineHeight: 1,
    userSelect: 'none',
  },
  miniFooter: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  miniChip: {
    fontSize: '9.5px',
    fontWeight: 500,
    padding: '2px 6px',
    borderRadius: '4px',
  },
}

export default Rota
