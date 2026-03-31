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
  isSameDay,
} from '../utils/dateUtils'

const TODAY = new Date()
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Rota() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [viewMode, setViewMode] = useState('week')
  const [currentMonday, setMonday] = useState(getMondayOfWeek(TODAY))
  const [rota, setRota] = useState(mockRota)
  const [showGenerate, setShowGenerate] = useState(false)
  const [jumpValue, setJumpValue] = useState('')
  const [showJump, setShowJump] = useState(false)

  const weekDates = getWeekDates(currentMonday)
  const monthDates = useMemo(() => {
    return getMonthDates(currentMonday.getFullYear(), currentMonday.getMonth())
  }, [currentMonday])

  const staffMap = Object.fromEntries(mockStaff.map((s) => [s.id, s]))
  const canEdit = ['manager', 'deputy', 'superadmin'].includes(user?.activeRole)
  const canSeeGaps = [
    'manager',
    'deputy',
    'senior',
    'operationallead',
    'superadmin',
  ].includes(user?.activeRole)

  const startLabel = formatDate(weekDates[0])
  const endLabel = formatDate(weekDates[6])
  const monthLabel = currentMonday.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  const prevWeek = () => setMonday((prev) => addWeeks(prev, -1))
  const nextWeek = () => setMonday((prev) => addWeeks(prev, 1))
  const prevMonth = () =>
    setMonday((prev) => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() - 1)
      return getMondayOfWeek(new Date(d.getFullYear(), d.getMonth(), 1))
    })
  const nextMonth = () =>
    setMonday((prev) => {
      const d = new Date(prev)
      d.setMonth(d.getMonth() + 1)
      return getMondayOfWeek(new Date(d.getFullYear(), d.getMonth(), 1))
    })

  const handleJump = () => {
    if (!jumpValue) return
    const picked = new Date(jumpValue)
    if (isNaN(picked)) return
    setMonday(getMondayOfWeek(picked))
    setShowJump(false)
    setJumpValue('')
  }

  const getViolations = (dayIdx) => {
    const v = []
    const early = rota.early[dayIdx] || []
    const late = rota.late[dayIdx] || []
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
            <h1 style={s.title}>Weekly Rota</h1>
            <p style={s.subtitle}>
              Meadowview House ·{' '}
              {viewMode === 'week' ? `${startLabel} – ${endLabel}` : monthLabel}
            </p>
          </div>
          <div style={s.headerRight}>
            <div style={s.viewToggle}>
              {['week', 'month'].map((v) => (
                <button
                  key={v}
                  style={{
                    ...s.toggleBtn,
                    background: viewMode === v ? '#6c8fff' : 'transparent',
                    color: viewMode === v ? '#fff' : '#9499b0',
                  }}
                  onClick={() => setViewMode(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
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

        {/* Compliance strip */}
        {canSeeGaps && (
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

        {/* Week navigation */}
        <div style={s.weekNav}>
          <button
            style={s.navArrow}
            onClick={viewMode === 'week' ? prevWeek : prevMonth}
          >
            <FontAwesomeIcon icon='chevron-left' />
          </button>
          <span style={s.weekLabel}>
            {viewMode === 'week' ? `${startLabel} – ${endLabel}` : monthLabel}
          </span>
          <button
            style={s.navArrow}
            onClick={viewMode === 'week' ? nextWeek : nextMonth}
          >
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
            <span style={{ ...s.legendItem, color: '#2a7f62' }}>■ Early</span>
            <span style={{ ...s.legendItem, color: '#7a4fa8' }}>■ Late</span>
            <span style={{ ...s.legendItem, color: '#c4883a' }}>
              ■ Sleep-in
            </span>
          </div>
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
                const staffList = rota.early[dayIdx] || []
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
                const staffList = rota.late[dayIdx] || []
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
                  {(rota.onCall[dayIdx] || []).map((id) => {
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

        {/* ── MONTH VIEW ── */}
        {viewMode === 'month' && (
          <div style={s.monthWrap}>
            <div style={s.monthHeader}>
              {DAYS.map((d) => (
                <div key={d} style={s.monthDayHead}>
                  {d}
                </div>
              ))}
            </div>

            <div style={s.monthGrid}>
              {monthDates.map((date, i) => {
                const isCurrentMonth =
                  date.getMonth() === currentMonday.getMonth()
                const isToday = isSameDay(date, TODAY)
                const dayOfWeek = (date.getDay() + 6) % 7
                const early = rota.early[dayOfWeek] || []
                const late = rota.late[dayOfWeek] || []
                const sleepIns = late.filter((e) => e.sleepIn).length
                const gaps =
                  (early.length < 3 ? 1 : 0) + (late.length < 3 ? 1 : 0)

                return (
                  <div
                    key={i}
                    style={{
                      ...s.monthCell,
                      opacity: isCurrentMonth ? 1 : 0.35,
                      background: isToday
                        ? 'rgba(108,143,255,0.08)'
                        : '#161820',
                      border: isToday
                        ? '1px solid rgba(108,143,255,0.35)'
                        : '1px solid rgba(255,255,255,0.07)',
                    }}
                    onClick={() => {
                      setMonday(getMondayOfWeek(date))
                      setViewMode('week')
                    }}
                  >
                    <div
                      style={{
                        ...s.monthDateNum,
                        color: isToday
                          ? '#6c8fff'
                          : isCurrentMonth
                            ? '#e8eaf0'
                            : '#5d6180',
                      }}
                    >
                      {date.getDate()}
                    </div>

                    {isCurrentMonth && (
                      <div style={s.monthDots}>
                        {early.length > 0 && (
                          <span
                            style={{ ...s.dot, background: '#2a7f62' }}
                            title='Early shift'
                          />
                        )}
                        {late.length > 0 && (
                          <span
                            style={{ ...s.dot, background: '#7a4fa8' }}
                            title='Late shift'
                          />
                        )}
                        {sleepIns > 0 && (
                          <span
                            style={{ ...s.dot, background: '#c4883a' }}
                            title='Sleep-in'
                          />
                        )}
                        {canSeeGaps && gaps > 0 && (
                          <span
                            style={{ ...s.dot, background: '#e85c3d' }}
                            title={`${gaps} gap(s)`}
                          />
                        )}
                      </div>
                    )}

                    {canSeeGaps && isCurrentMonth && gaps > 0 && (
                      <div style={s.monthGap}>
                        {gaps} gap{gaps > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={s.monthLegend}>
              <span style={{ ...s.legendItem, color: '#2a7f62' }}>■ Early</span>
              <span style={{ ...s.legendItem, color: '#7a4fa8' }}>■ Late</span>
              <span style={{ ...s.legendItem, color: '#c4883a' }}>
                ■ Sleep-in
              </span>
              {canSeeGaps && (
                <span style={{ ...s.legendItem, color: '#e85c3d' }}>■ Gap</span>
              )}
              <span
                style={{
                  fontSize: '11px',
                  color: '#5d6180',
                  marginLeft: '8px',
                }}
              >
                Click any day to jump to that week
              </span>
            </div>
          </div>
        )}
      </div>

      {showGenerate && (
        <GenerateModal
          onClose={() => setShowGenerate(false)}
          onApply={(newRota) => setRota(newRota)}
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
  body: { padding: '24px', maxWidth: '1100px', margin: '0 auto' },
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
    minWidth: '200px',
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
  legend: { display: 'flex', gap: '12px', marginLeft: 'auto' },
  legendItem: { fontSize: '12px' },
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
  monthWrap: { marginTop: '8px' },
  monthHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
    marginBottom: '4px',
  },
  monthDayHead: {
    textAlign: 'center',
    fontSize: '11px',
    fontWeight: 500,
    color: '#5d6180',
    padding: '6px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  monthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
  },
  monthCell: {
    borderRadius: '8px',
    padding: '8px',
    minHeight: '72px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    transition: 'border-color 0.15s',
  },
  monthDateNum: {
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'Syne, sans-serif',
  },
  monthDots: { display: 'flex', gap: '3px', flexWrap: 'wrap' },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  monthGap: {
    fontSize: '10px',
    color: '#e85c3d',
    fontWeight: 500,
    marginTop: 'auto',
  },
  monthLegend: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginTop: '12px',
    flexWrap: 'wrap',
  },
}

export default Rota
