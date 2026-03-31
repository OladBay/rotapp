import { useState } from 'react'
import { mockStaff } from '../../data/mockRota'
import { generateRota, checkViolations } from '../../utils/rotaGenerator'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DATES = ['31 Mar', '1 Apr', '2 Apr', '3 Apr', '4 Apr', '5 Apr', '6 Apr']

const AVAIL_OPTIONS = [
  { value: 'B', label: 'Both' },
  { value: 'E', label: 'Early' },
  { value: 'L', label: 'Late' },
  { value: 'X', label: 'Off' },
]

const AVAIL_COLORS = {
  B: {
    bg: 'rgba(108,143,255,0.12)',
    color: '#6c8fff',
    border: 'rgba(108,143,255,0.3)',
  },
  E: {
    bg: 'rgba(42,127,98,0.15)',
    color: '#2a7f62',
    border: 'rgba(42,127,98,0.35)',
  },
  L: {
    bg: 'rgba(122,79,168,0.15)',
    color: '#7a4fa8',
    border: 'rgba(122,79,168,0.35)',
  },
  X: {
    bg: 'rgba(255,255,255,0.04)',
    color: '#5d6180',
    border: 'rgba(255,255,255,0.08)',
  },
}

function GenerateModal({ onClose, onApply }) {
  const [step, setStep] = useState(1)
  const [availability, setAvailability] = useState(() => {
    const init = {}
    mockStaff.forEach((s) => {
      init[s.id] = {}
      DAYS.forEach((_, i) => {
        init[s.id][i] = 'B'
      })
    })
    return init
  })
  const [generatedRota, setGeneratedRota] = useState(null)
  const [violations, setViolations] = useState([])
  const [overrideChecked, setOverride] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [logLines, setLogLines] = useState([])
  const [showInstructions, setShowInstructions] = useState(false)
  const [hiddenDays, setHiddenDays] = useState([])

  const staffMap = Object.fromEntries(mockStaff.map((s) => [s.id, s]))

  const addLog = (msg, type = '') =>
    setLogLines((prev) => [...prev, { msg, type }])

  const updateAvail = (staffId, dayIdx, value) => {
    setAvailability((prev) => ({
      ...prev,
      [staffId]: { ...prev[staffId], [dayIdx]: value },
    }))
  }

  const setAllAvail = (value) => {
    const updated = {}
    mockStaff.forEach((s) => {
      updated[s.id] = {}
      DAYS.forEach((_, i) => {
        updated[s.id][i] = value
      })
    })
    setAvailability(updated)
  }

  const runGeneration = async () => {
    setGenerating(true)
    setLogLines([])
    setStep(2)

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

    addLog('Parsing availability matrix…', 'info')
    await sleep(500)

    addLog(`${mockStaff.length} staff · 7 days · 2 shifts`, '')
    await sleep(400)

    addLog('Applying hard constraints…', 'info')
    addLog('  Min 3 staff/shift (excl. managers)', '')
    addLog('  2 sleep-ins per night required', '')
    await sleep(500)

    addLog('Applying soft rules…', 'info')
    addLog('  1 female per shift', '')
    addLog('  1 driver per shift', '')
    addLog('  1 permanent staff per shift + sleep-in', '')
    await sleep(500)

    addLog('Generating rota…', 'info')
    await sleep(600)

    const rota = generateRota(availability)
    const vs = checkViolations(rota, staffMap)

    setGeneratedRota(rota)
    setViolations(vs)

    const hard = vs.filter((v) => v.type === 'hard')
    const soft = vs.filter((v) => v.type === 'soft')

    if (hard.length === 0) addLog('✓ All hard constraints satisfied', 'ok')
    else hard.forEach((v) => addLog(`✗ ${v.message}`, 'warn'))

    if (soft.length === 0) addLog('✓ All soft rules met', 'ok')
    else soft.forEach((v) => addLog(`⚠ ${v.message}`, 'soft'))

    addLog('Rota ready for review', 'ok')
    setGenerating(false)

    await sleep(600)
    setStep(3)
  }

  const hardViolations = violations.filter((v) => v.type === 'hard')
  const softViolations = violations.filter((v) => v.type === 'soft')
  const canApply = hardViolations.length === 0 || overrideChecked

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <div style={s.titleRow}>
              <div style={s.title}>
                {step === 1
                  ? 'Staff Availability'
                  : step === 2
                    ? 'Generating Rota…'
                    : 'Review & Confirm'}
              </div>
              {step === 1 && (
                <button
                  style={s.infoBtn}
                  onClick={() => setShowInstructions(!showInstructions)}
                  title='How this works'
                >
                  <FontAwesomeIcon icon='circle-info' />
                </button>
              )}
            </div>
            <div style={s.subtitle}>
              {step === 1
                ? 'Set availability for each staff member this week'
                : step === 2
                  ? 'Building a compliant rota from availability data'
                  : 'Check violations before applying to the rota'}
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>
            <FontAwesomeIcon icon='xmark' />
          </button>
        </div>

        {/* Step indicators */}
        <div style={s.steps}>
          {['Availability', 'Generate', 'Review'].map((label, i) => (
            <div key={label} style={s.stepItem}>
              <div
                style={{
                  ...s.stepNum,
                  background:
                    i + 1 < step
                      ? '#6c8fff'
                      : i + 1 === step
                        ? 'rgba(108,143,255,0.15)'
                        : 'transparent',
                  color: i + 1 <= step ? '#6c8fff' : '#5d6180',
                  border:
                    i + 1 === step
                      ? '1.5px solid #6c8fff'
                      : i + 1 < step
                        ? '1.5px solid #6c8fff'
                        : '1.5px solid rgba(255,255,255,0.1)',
                }}
              >
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <span
                style={{
                  fontSize: '12px',
                  color: i + 1 === step ? '#e8eaf0' : '#5d6180',
                }}
              >
                {label}
              </span>
              {i < 2 && <div style={s.stepLine} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: AVAILABILITY ── */}
        {step === 1 && (
          <>
            <div style={s.body}>
              <div style={s.availHeader}>
                <div style={s.availNote}>
                  E = Early only · L = Late only · B = Both · X = Off
                </div>
                <div
                  style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                >
                  <div style={s.bulkBtns}>
                    {AVAIL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        style={{
                          ...s.bulkBtn,
                          background: AVAIL_COLORS[opt.value].bg,
                          color: AVAIL_COLORS[opt.value].color,
                          border: `1px solid ${AVAIL_COLORS[opt.value].border}`,
                        }}
                        onClick={() => setAllAvail(opt.value)}
                      >
                        All {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {showInstructions && (
                <div style={s.instructionsBox}>
                  <div style={s.instrTitle}>How the rota generator works</div>
                  <div style={s.instrGrid}>
                    <div style={s.instrItem}>
                      <span
                        style={{
                          ...s.instrBadge,
                          background: 'rgba(108,143,255,0.15)',
                          color: '#6c8fff',
                        }}
                      >
                        Both
                      </span>
                      <span style={s.instrText}>
                        Staff can work either shift — generator decides based on
                        coverage needs
                      </span>
                    </div>
                    <div style={s.instrItem}>
                      <span
                        style={{
                          ...s.instrBadge,
                          background: 'rgba(42,127,98,0.15)',
                          color: '#2a7f62',
                        }}
                      >
                        Early
                      </span>
                      <span style={s.instrText}>
                        Staff is only available for the early shift
                        (07:00–14:30)
                      </span>
                    </div>
                    <div style={s.instrItem}>
                      <span
                        style={{
                          ...s.instrBadge,
                          background: 'rgba(122,79,168,0.15)',
                          color: '#7a4fa8',
                        }}
                      >
                        Late
                      </span>
                      <span style={s.instrText}>
                        Staff is only available for the late shift (14:00–23:00)
                      </span>
                    </div>
                    <div style={s.instrItem}>
                      <span
                        style={{
                          ...s.instrBadge,
                          background: 'rgba(255,255,255,0.06)',
                          color: '#5d6180',
                        }}
                      >
                        Off
                      </span>
                      <span style={s.instrText}>
                        Staff is unavailable — on leave, sick, or rest day
                      </span>
                    </div>
                  </div>
                  <div style={s.instrRules}>
                    <div style={s.instrRuleTitle}>
                      What the generator checks
                    </div>
                    <div style={s.instrRule}>
                      <span style={s.hardDot} /> Min 3 staff per shift (managers
                      and deputies don't count)
                    </div>
                    <div style={s.instrRule}>
                      <span style={s.hardDot} /> Exactly 2 sleep-in tags per
                      night
                    </div>
                    <div style={s.instrRule}>
                      <span style={s.softDot} /> At least 1 female staff per
                      shift where possible
                    </div>
                    <div style={s.instrRule}>
                      <span style={s.softDot} /> At least 1 driver per shift
                      where possible
                    </div>
                    <div style={s.instrRule}>
                      <span style={s.softDot} /> At least 1 permanent staff per
                      shift and on sleep-in
                    </div>
                    <div style={s.instrNote}>
                      Staff marked off on the Leave tab will automatically
                      appear as Off here.
                    </div>
                  </div>
                </div>
              )}

              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Staff</th>
                      {DAYS.map((d, i) => (
                        <th key={d} style={s.th}>
                          <div style={s.dayHeadWrap}>
                            <input
                              type='checkbox'
                              checked={!hiddenDays.includes(i)}
                              onChange={() =>
                                setHiddenDays((prev) =>
                                  prev.includes(i)
                                    ? prev.filter((x) => x !== i)
                                    : [...prev, i]
                                )
                              }
                              style={{
                                cursor: 'pointer',
                                accentColor: '#6c8fff',
                              }}
                              title={
                                hiddenDays.includes(i) ? 'Show day' : 'Hide day'
                              }
                            />
                            <span
                              style={{
                                color: hiddenDays.includes(i)
                                  ? '#5d6180'
                                  : '#9499b0',
                                textDecoration: hiddenDays.includes(i)
                                  ? 'line-through'
                                  : 'none',
                              }}
                            >
                              {d}
                            </span>
                            <span
                              style={{
                                fontWeight: 400,
                                color: hiddenDays.includes(i)
                                  ? '#3d3f50'
                                  : '#5d6180',
                                fontSize: '10px',
                                textDecoration: hiddenDays.includes(i)
                                  ? 'line-through'
                                  : 'none',
                              }}
                            >
                              {DATES[i]}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mockStaff.map((staff) => (
                      <tr key={staff.id}>
                        <td style={s.td}>
                          <div style={s.staffName}>
                            {staff.name.split(' ')[0]}
                          </div>
                          <div style={s.staffRole}>{staff.roleCode}</div>
                        </td>
                        {DAYS.map((_, dayIdx) => {
                          if (hiddenDays.includes(dayIdx)) return null
                          const val = availability[staff.id]?.[dayIdx] || 'B'
                          const col = AVAIL_COLORS[val]
                          return (
                            <td key={dayIdx} style={s.td}>
                              <select
                                value={val}
                                onChange={(e) =>
                                  updateAvail(staff.id, dayIdx, e.target.value)
                                }
                                style={{
                                  ...s.select,
                                  background: col.bg,
                                  color: col.color,
                                  border: `1px solid ${col.border}`,
                                }}
                              >
                                {AVAIL_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={s.footer}>
              <div style={s.footerNote}>
                💡 Managers and deputies are excluded from the 3-staff minimum
              </div>
              <div style={s.footerActions}>
                <button style={s.secondaryBtn} onClick={onClose}>
                  Cancel
                </button>
                <button style={s.primaryBtn} onClick={runGeneration}>
                  Generate ⚡
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: GENERATING ── */}
        {step === 2 && (
          <div style={s.body}>
            <div style={s.generatingWrap}>
              {generating && <div style={s.spinner} />}
              <div style={s.genStatus}>
                {generating ? 'Building your rota…' : 'Rota generated'}
              </div>
              <div style={s.logBox}>
                {logLines.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      ...s.logLine,
                      color:
                        line.type === 'ok'
                          ? '#2ecc8a'
                          : line.type === 'warn'
                            ? '#e85c3d'
                            : line.type === 'soft'
                              ? '#c4883a'
                              : line.type === 'info'
                                ? '#6c8fff'
                                : '#9499b0',
                    }}
                  >
                    {line.msg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: REVIEW ── */}
        {step === 3 && generatedRota && (
          <>
            <div style={s.body}>
              {/* Stats */}
              <div style={s.reviewStats}>
                <div style={s.reviewStat}>
                  <div style={s.reviewStatVal}>
                    {generatedRota.early.reduce((a, d) => a + d.length, 0)}
                  </div>
                  <div style={s.reviewStatLabel}>Early slots</div>
                </div>
                <div style={s.reviewStat}>
                  <div style={s.reviewStatVal}>
                    {generatedRota.late.reduce((a, d) => a + d.length, 0)}
                  </div>
                  <div style={s.reviewStatLabel}>Late slots</div>
                </div>
                <div style={s.reviewStat}>
                  <div style={s.reviewStatVal}>
                    {generatedRota.late.reduce(
                      (a, d) => a + d.filter((e) => e.sleepIn).length,
                      0
                    )}
                  </div>
                  <div style={s.reviewStatLabel}>Sleep-ins</div>
                </div>
                <div style={s.reviewStat}>
                  <div
                    style={{
                      ...s.reviewStatVal,
                      color: hardViolations.length > 0 ? '#e85c3d' : '#2ecc8a',
                    }}
                  >
                    {hardViolations.length}
                  </div>
                  <div style={s.reviewStatLabel}>Hard violations</div>
                </div>
                <div style={s.reviewStat}>
                  <div
                    style={{
                      ...s.reviewStatVal,
                      color: softViolations.length > 0 ? '#c4883a' : '#2ecc8a',
                    }}
                  >
                    {softViolations.length}
                  </div>
                  <div style={s.reviewStatLabel}>Soft rule flags</div>
                </div>
              </div>

              {/* Violations */}
              {violations.length === 0 ? (
                <div style={s.allGood}>
                  ✓ Fully compliant — all hard and soft rules satisfied
                </div>
              ) : (
                <div style={s.violationsList}>
                  {hardViolations.length > 0 && (
                    <>
                      <div style={s.violationGroupLabel}>Hard violations</div>
                      {hardViolations.map((v, i) => (
                        <div key={i} style={s.violationCard}>
                          <span style={s.violationIcon}>✗</span>
                          <span>{v.message}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {softViolations.length > 0 && (
                    <>
                      <div
                        style={{
                          ...s.violationGroupLabel,
                          color: '#c4883a',
                          marginTop: '12px',
                        }}
                      >
                        Soft rule flags
                      </div>
                      {softViolations.map((v, i) => (
                        <div
                          key={i}
                          style={{ ...s.violationCard, ...s.softCard }}
                        >
                          <span
                            style={{ ...s.violationIcon, color: '#c4883a' }}
                          >
                            ⚠
                          </span>
                          <span style={{ color: '#c4883a' }}>{v.message}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Override checkbox */}
              {hardViolations.length > 0 && (
                <div style={s.overrideRow}>
                  <input
                    type='checkbox'
                    id='override'
                    checked={overrideChecked}
                    onChange={(e) => setOverride(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor='override' style={s.overrideLabel}>
                    I understand the violations and want to apply this rota
                    anyway. This override will be logged.
                  </label>
                </div>
              )}

              {/* Mini preview */}
              <div style={s.previewLabel}>Rota Preview</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.previewTable}>
                  <thead>
                    <tr>
                      <th style={s.pth}>Shift</th>
                      {DAYS.map((d) => (
                        <th key={d} style={s.pth}>
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['early', 'late'].map((shift) => (
                      <tr key={shift}>
                        <td
                          style={{
                            ...s.ptd,
                            textTransform: 'capitalize',
                            fontWeight: 500,
                          }}
                        >
                          {shift}
                        </td>
                        {(generatedRota[shift] || []).map((dayList, i) => (
                          <td
                            key={i}
                            style={{
                              ...s.ptd,
                              background:
                                dayList.length < 3
                                  ? 'rgba(232,92,61,0.08)'
                                  : 'transparent',
                            }}
                          >
                            {dayList.map((e) => {
                              const st = staffMap[e.id]
                              return (
                                <div key={e.id} style={s.previewName}>
                                  {st?.name.split(' ')[0]}
                                  {e.sleepIn && ' 💤'}
                                </div>
                              )
                            })}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={s.footer}>
              <button
                style={s.secondaryBtn}
                onClick={() => {
                  setStep(1)
                  setGeneratedRota(null)
                  setViolations([])
                }}
              >
                ← Start over
              </button>
              <div style={s.footerActions}>
                <button
                  style={s.secondaryBtn}
                  onClick={() => {
                    setStep(2)
                    runGeneration()
                  }}
                >
                  Regenerate
                </button>
                <button
                  style={{
                    ...s.primaryBtn,
                    opacity: canApply ? 1 : 0.4,
                    cursor: canApply ? 'pointer' : 'not-allowed',
                    background:
                      hardViolations.length > 0 && overrideChecked
                        ? '#e85c3d'
                        : '#6c8fff',
                  }}
                  disabled={!canApply}
                  onClick={() => {
                    onApply(generatedRota)
                    onClose()
                  }}
                >
                  {hardViolations.length > 0 && overrideChecked
                    ? 'Apply with override'
                    : 'Apply to rota'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '20px',
  },
  modal: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '18px',
    width: '100%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '24px 28px 0',
  },
  title: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '20px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  subtitle: { fontSize: '13px', color: '#9499b0', marginTop: '4px' },
  closeBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#9499b0',
    width: '30px',
    height: '30px',
    cursor: 'pointer',
    fontSize: '16px',
    flexShrink: 0,
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    padding: '20px 28px 0',
    gap: '0',
  },
  stepItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  stepNum: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 500,
    flexShrink: 0,
  },
  stepLine: {
    width: '40px',
    height: '1px',
    background: 'rgba(255,255,255,0.1)',
    margin: '0 8px',
  },
  body: { padding: '20px 28px', overflowY: 'auto', flex: 1 },
  footer: {
    padding: '16px 28px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#1d1f2b',
  },
  footerNote: { fontSize: '12px', color: '#5d6180' },
  footerActions: { display: 'flex', gap: '8px' },
  primaryBtn: {
    background: '#6c8fff',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '9px 18px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
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
  availHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  availNote: { fontSize: '12px', color: '#5d6180' },
  bulkBtns: { display: 'flex', gap: '6px' },
  bulkBtn: {
    borderRadius: '6px',
    padding: '5px 10px',
    fontSize: '11.5px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: '700px' },
  th: {
    padding: '8px 10px',
    textAlign: 'left',
    fontWeight: 500,
    color: '#9499b0',
    fontSize: '11px',
    letterSpacing: '0.3px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: '#1d1f2b',
  },
  td: {
    padding: '6px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle',
  },
  staffName: { fontSize: '12.5px', fontWeight: 500, color: '#e8eaf0' },
  staffRole: {
    fontSize: '10px',
    color: '#5d6180',
    fontFamily: 'DM Mono, monospace',
  },
  select: {
    borderRadius: '6px',
    padding: '4px 6px',
    fontSize: '11.5px',
    fontFamily: 'DM Sans, sans-serif',
    cursor: 'pointer',
    width: '72px',
    outline: 'none',
  },
  generatingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '32px 0',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.1)',
    borderTopColor: '#6c8fff',
    animation: 'spin 0.8s linear infinite',
  },
  genStatus: { fontSize: '15px', color: '#e8eaf0', fontWeight: 500 },
  logBox: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    padding: '14px 16px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '200px',
    overflowY: 'auto',
    fontFamily: 'DM Mono, monospace',
    fontSize: '11px',
  },
  logLine: { marginBottom: '4px', lineHeight: 1.5 },
  reviewStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '10px',
    marginBottom: '20px',
  },
  reviewStat: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    padding: '12px',
  },
  reviewStatVal: {
    fontSize: '22px',
    fontWeight: 600,
    fontFamily: 'Syne, sans-serif',
    color: '#e8eaf0',
  },
  reviewStatLabel: { fontSize: '11px', color: '#9499b0', marginTop: '3px' },
  allGood: {
    background: 'rgba(46,204,138,0.08)',
    border: '1px solid rgba(46,204,138,0.2)',
    borderRadius: '10px',
    padding: '12px 16px',
    fontSize: '13px',
    color: '#2ecc8a',
    marginBottom: '16px',
  },
  violationsList: { marginBottom: '16px' },
  violationGroupLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#e85c3d',
    marginBottom: '8px',
    fontWeight: 500,
  },
  violationCard: {
    background: 'rgba(232,92,61,0.08)',
    border: '1px solid rgba(232,92,61,0.2)',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '12.5px',
    color: '#e85c3d',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  softCard: {
    background: 'rgba(196,136,58,0.08)',
    border: '1px solid rgba(196,136,58,0.2)',
  },
  violationIcon: { fontSize: '13px', flexShrink: 0 },
  overrideRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'rgba(232,92,61,0.06)',
    border: '1px solid rgba(232,92,61,0.2)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px',
  },
  overrideLabel: {
    fontSize: '12.5px',
    color: '#9499b0',
    cursor: 'pointer',
    lineHeight: 1.5,
  },
  previewLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#5d6180',
    marginBottom: '10px',
    fontWeight: 500,
  },
  previewTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
    minWidth: '600px',
  },
  pth: {
    padding: '6px 8px',
    textAlign: 'left',
    background: '#1d1f2b',
    color: '#9499b0',
    fontWeight: 500,
    border: '1px solid rgba(255,255,255,0.07)',
  },
  ptd: {
    padding: '6px 8px',
    border: '1px solid rgba(255,255,255,0.07)',
    verticalAlign: 'top',
  },
  previewName: { color: '#e8eaf0', marginBottom: '2px' },
  infoBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6c8fff',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 0 0 8px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
  },
  headerLeft: { flex: 1 },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  instructionsBox: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '16px',
  },
  instrTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e8eaf0',
    marginBottom: '12px',
    fontFamily: 'Syne, sans-serif',
  },
  instrGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '14px',
  },
  instrItem: { display: 'flex', alignItems: 'flex-start', gap: '8px' },
  instrBadge: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '3px 8px',
    borderRadius: '5px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  instrText: { fontSize: '12px', color: '#9499b0', lineHeight: 1.5 },
  instrRules: {
    borderTop: '1px solid rgba(255,255,255,0.07)',
    paddingTop: '12px',
  },
  instrRuleTitle: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#5d6180',
    marginBottom: '8px',
    fontWeight: 500,
  },
  instrRule: {
    fontSize: '12px',
    color: '#9499b0',
    marginBottom: '5px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  hardDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#e85c3d',
    display: 'inline-block',
    flexShrink: 0,
  },
  softDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#c4883a',
    display: 'inline-block',
    flexShrink: 0,
  },
  instrNote: {
    fontSize: '11.5px',
    color: '#6c8fff',
    background: 'rgba(108,143,255,0.08)',
    borderRadius: '6px',
    padding: '8px 10px',
    marginTop: '10px',
  },
  dayHeadWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '3px',
    fontSize: '11px',
  },
}

export default GenerateModal
