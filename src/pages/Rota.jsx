import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import { mockRota, mockStaff } from '../data/mockRota'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DATES = ['31 Mar','1 Apr','2 Apr','3 Apr','4 Apr','5 Apr','6 Apr']
const TODAY = 1

function Rota() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rota, setRota] = useState(mockRota)

  const staffMap = Object.fromEntries(mockStaff.map(s => [s.id, s]))
  const canEdit = ['manager','deputy','superadmin'].includes(user?.activeRole)
  const canSeeGaps = ['manager','deputy','senior','operationallead','superadmin'].includes(user?.activeRole)

  const getViolations = (dayIdx) => {
    const v = []
    const early = rota.early[dayIdx] || []
    const late = rota.late[dayIdx] || []
    const sleepIns = late.filter(e => e.sleepIn)
    if (early.length < 3) v.push(`Early understaffed (${early.length}/3)`)
    if (late.length < 3)  v.push(`Late understaffed (${late.length}/3)`)
    if (sleepIns.length !== 2) v.push(`Sleep-ins: ${sleepIns.length}/2`)
    const earlyHasF = early.some(e => staffMap[e.id]?.gender === 'F')
    const lateHasF  = late.some(e => staffMap[e.id]?.gender === 'F')
    if (!earlyHasF) v.push('Early: no female')
    if (!lateHasF)  v.push('Late: no female')
    return v
  }

  const totalViolations = DAYS.reduce((a,_,i) => a + getViolations(i).length, 0)

  return (
    <div style={s.page}>
      <Navbar />

      <div style={s.body}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.breadcrumb} onClick={() => navigate('/dashboard')}>
              ← Dashboard
            </div>
            <h1 style={s.title}>Weekly Rota</h1>
            <p style={s.subtitle}>Meadowview House · w/c 31 Mar 2025</p>
          </div>
          {canEdit && (
            <div style={s.headerActions}>
              <button style={s.secondaryBtn}>Publish</button>
              <button style={s.primaryBtn}>⚡ Generate</button>
            </div>
          )}
        </div>

        {/* Compliance strip */}
        {canSeeGaps && (
          <div style={s.compStrip}>
            {totalViolations === 0
              ? <span style={{...s.chip, ...s.chipOk}}>✓ All shifts compliant</span>
              : <span style={{...s.chip, ...s.chipWarn}}>⚠ {totalViolations} violation{totalViolations > 1 ? 's' : ''} this week</span>
            }
            <span style={{...s.chip, ...s.chipInfo}}>2 sleep-ins checked nightly</span>
            <span style={{...s.chip, ...s.chipInfo}}>On-call: 7/7 days</span>
          </div>
        )}

        {/* Legend */}
        <div style={s.legend}>
          <span style={{...s.legendItem, color:'#2a7f62'}}>■ Early 07:00–14:30</span>
          <span style={{...s.legendItem, color:'#7a4fa8'}}>■ Late 14:00–23:00</span>
          <span style={{...s.legendItem, color:'#c4883a'}}>■ Sleep-in tag</span>
        </div>

        {/* Grid */}
        <div style={s.gridWrap}>
          <div style={s.grid}>

            {/* Header row */}
            <div style={s.colLabel} />
            {DAYS.map((day, i) => (
              <div key={day} style={{
                ...s.dayHeader,
                background: i === TODAY ? 'rgba(108,143,255,0.06)' : 'transparent'
              }}>
                <div style={{
                  ...s.dayName,
                  color: i === TODAY ? '#6c8fff' : '#9499b0'
                }}>{day}</div>
                <div style={{
                  ...s.dayDate,
                  color: i === TODAY ? '#6c8fff' : '#e8eaf0'
                }}>{DATES[i]}</div>
                {canSeeGaps && getViolations(i).length > 0 && (
                  <div style={s.violationDot} title={getViolations(i).join(', ')} />
                )}
              </div>
            ))}

            {/* Early row */}
            <div style={s.shiftLabel}>
              <div style={s.shiftName}>Early</div>
              <div style={s.shiftTime}>07:00–14:30</div>
            </div>
            {rota.early.map((staffList, dayIdx) => {
              const isUnderstaffed = canSeeGaps && staffList.length < 3
              return (
                <div key={dayIdx} style={{
                  ...s.cell,
                  background: isUnderstaffed ? 'rgba(232,92,61,0.06)' : 'transparent'
                }}>
                  {staffList.map(entry => {
                    const staff = staffMap[entry.id]
                    if (!staff) return null
                    return (
                      <div key={entry.id} style={s.chipEarly}>
                        <span style={s.chipName}>{staff.name.split(' ')[0]}</span>
                        <span style={s.chipRole}>{staff.roleCode}</span>
                      </div>
                    )
                  })}
                  {isUnderstaffed && (
                    <div style={s.gapTag}>GAP</div>
                  )}
                  {canEdit && (
                    <div style={s.addBtn}>+ Add</div>
                  )}
                </div>
              )
            })}

            {/* Late row */}
            <div style={s.shiftLabel}>
              <div style={s.shiftName}>Late</div>
              <div style={s.shiftTime}>14:00–23:00</div>
            </div>
            {rota.late.map((staffList, dayIdx) => {
              const isUnderstaffed = canSeeGaps && staffList.length < 3
              const sleepCount = staffList.filter(e => e.sleepIn).length
              const sleepWarn = canSeeGaps && sleepCount < 2
              return (
                <div key={dayIdx} style={{
                  ...s.cell,
                  background: isUnderstaffed ? 'rgba(232,92,61,0.06)' : 'transparent'
                }}>
                  {staffList.map(entry => {
                    const staff = staffMap[entry.id]
                    if (!staff) return null
                    return (
                      <div key={entry.id} style={s.chipLate}>
                        <span style={s.chipName}>{staff.name.split(' ')[0]}</span>
                        <span style={s.chipRole}>{staff.roleCode}</span>
                        {entry.sleepIn && <span style={s.sleepTag}>💤</span>}
                      </div>
                    )
                  })}
                  {sleepWarn && (
                    <div style={s.sleepWarn}>⚠ {sleepCount}/2 sleep-ins</div>
                  )}
                  {isUnderstaffed && (
                    <div style={s.gapTag}>GAP</div>
                  )}
                  {canEdit && (
                    <div style={s.addBtn}>+ Add</div>
                  )}
                </div>
              )
            })}

            {/* On-call row */}
            <div style={{...s.shiftLabel, background:'rgba(58,138,196,0.06)'}}>
              <div style={{...s.shiftName, color:'#3a8ac4'}}>On-call</div>
              <div style={s.shiftTime}>parallel</div>
            </div>
            {rota.onCall.map((list, dayIdx) => (
              <div key={dayIdx} style={{...s.cell, background:'rgba(58,138,196,0.04)'}}>
                {list.map(id => {
                  const staff = staffMap[id]
                  if (!staff) return null
                  return (
                    <div key={id} style={s.chipOncall}>
                      {staff.name.split(' ')[0]}
                    </div>
                  )
                })}
              </div>
            ))}

          </div>
        </div>

      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#0f1117', color: '#e8eaf0', fontFamily: 'DM Sans, sans-serif' },
  body: { padding: '24px', maxWidth: '1100px', margin: '0 auto' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' },
  breadcrumb: { fontSize: '12px', color: '#6c8fff', cursor: 'pointer', marginBottom: '8px' },
  title: { fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 600, margin: 0 },
  subtitle: { fontSize: '13px', color: '#9499b0', marginTop: '4px' },
  headerActions: { display: 'flex', gap: '8px' },
  primaryBtn: { background: '#6c8fff', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' },
  secondaryBtn: { background: 'transparent', color: '#9499b0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' },
  compStrip: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' },
  chip: { fontSize: '12px', fontWeight: 500, padding: '5px 10px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '5px' },
  chipOk:   { background: 'rgba(46,204,138,0.12)',  color: '#2ecc8a' },
  chipWarn: { background: 'rgba(232,92,61,0.12)',   color: '#e85c3d' },
  chipInfo: { background: 'rgba(108,143,255,0.12)', color: '#6c8fff' },
  legend: { display: 'flex', gap: '16px', marginBottom: '16px' },
  legendItem: { fontSize: '12px' },
  gridWrap: { overflowX: 'auto' },
  grid: {
    display: 'grid',
    gridTemplateColumns: '120px repeat(7, 1fr)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px',
    overflow: 'hidden',
    minWidth: '780px',
    background: '#161820',
  },
  colLabel: { background: '#1d1f2b', borderBottom: '1px solid rgba(255,255,255,0.07)', borderRight: '1px solid rgba(255,255,255,0.07)' },
  dayHeader: {
    padding: '10px 10px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    textAlign: 'center',
    position: 'relative',
  },
  dayName: { fontSize: '11px', fontWeight: 500, letterSpacing: '0.4px', textTransform: 'uppercase' },
  dayDate: { fontSize: '16px', fontWeight: 600, fontFamily: 'Syne, sans-serif', marginTop: '2px' },
  violationDot: { width: '6px', height: '6px', borderRadius: '50%', background: '#e85c3d', position: 'absolute', top: '8px', right: '8px' },
  shiftLabel: {
    padding: '12px 10px',
    background: '#1d1f2b',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
  },
  shiftName: { fontSize: '12px', fontWeight: 600, color: '#e8eaf0', fontFamily: 'Syne, sans-serif' },
  shiftTime: { fontSize: '10px', color: '#5d6180', fontFamily: 'DM Mono, monospace', marginTop: '3px' },
  cell: {
    padding: '8px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    minHeight: '90px',
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  chipEarly: { background: 'rgba(42,127,98,0.18)', border: '1px solid rgba(42,127,98,0.35)', color: '#2a7f62', borderRadius: '6px', padding: '4px 7px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' },
  chipLate:  { background: 'rgba(122,79,168,0.18)', border: '1px solid rgba(122,79,168,0.35)', color: '#7a4fa8', borderRadius: '6px', padding: '4px 7px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' },
  chipOncall: { background: 'rgba(58,138,196,0.12)', color: '#3a8ac4', borderRadius: '5px', padding: '3px 7px', fontSize: '11px' },
  chipName: { flex: 1 },
  chipRole: { fontSize: '9px', opacity: 0.7, fontFamily: 'DM Mono, monospace' },
  sleepTag: { fontSize: '10px' },
  sleepWarn: { fontSize: '10px', color: '#c4883a', marginTop: '2px' },
  gapTag: { fontSize: '10px', fontWeight: 600, color: '#e85c3d', background: 'rgba(232,92,61,0.12)', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' },
  addBtn: { fontSize: '11px', color: '#5d6180', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', textAlign: 'center', marginTop: 'auto' },
}

export default Rota