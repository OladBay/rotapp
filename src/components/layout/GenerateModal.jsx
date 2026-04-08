import { useState, useEffect } from 'react'
import { generateMonthRota, checkViolations } from '../../utils/rotaGenerator'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { dateKey } from '../../utils/dateUtils'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function GenerateModal({
  onClose,
  onApplyMonth,
  scopeYear,
  scopeMonth,
  monthLabel,
  leaveData,
  staffMap,
}) {
  const [step, setStep] = useState(1) // 1 = generating, 2 = review
  const [monthResult, setMonthResult] = useState(null)
  const [overrideChecked, setOverride] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [logLines, setLogLines] = useState([])
  const [expandedWeek, setExpandedWeek] = useState(null)

  const addLog = (msg, type = '') =>
    setLogLines((prev) => [...prev, { msg, type }])

  const runGeneration = async () => {
    setGenerating(true)
    setLogLines([])

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

    addLog(`Starting rota generation for ${monthLabel}…`, 'info')
    await sleep(350)
    addLog(`${Object.keys(staffMap).length} staff loaded`, '')
    await sleep(250)
    addLog('Applying hard constraints…', 'info')
    addLog('  Min 3 staff per shift (excl. managers and deputies)', '')
    addLog('  Exactly 2 sleep-ins per night', '')
    await sleep(350)
    addLog('Applying soft rules…', 'info')
    addLog('  1 female staff per shift where possible', '')
    addLog('  1 driver per shift where possible', '')
    addLog('  1 permanent staff per shift and on sleep-in', '')
    await sleep(350)

    const result = generateMonthRota(scopeYear, scopeMonth, staffMap, leaveData)
    setMonthResult(result)

    const allViolations = Object.values(result.weekViolations).flat()
    const hard = allViolations.filter((v) => v.type === 'hard')
    const soft = allViolations.filter((v) => v.type === 'soft')

    addLog(`Generated ${result.weeks.length} weeks for ${monthLabel}`, 'info')
    await sleep(300)

    if (hard.length === 0) {
      addLog('✓ All hard constraints satisfied', 'ok')
    } else {
      addLog(`✗ ${hard.length} hard violation(s) found`, 'warn')
    }

    if (soft.length === 0) {
      addLog('✓ All soft rules met', 'ok')
    } else {
      addLog(`⚠ ${soft.length} soft flag(s) found`, 'soft')
    }

    await sleep(300)
    addLog('Ready for review', 'ok')

    setGenerating(false)
    await sleep(400)
    setStep(2)
  }

  // Derived violation totals
  const allMonthViolations = monthResult
    ? Object.values(monthResult.weekViolations).flat()
    : []
  const hardViolations = allMonthViolations.filter((v) => v.type === 'hard')
  const softViolations = allMonthViolations.filter((v) => v.type === 'soft')
  const canApply = hardViolations.length === 0 || overrideChecked

  const handleApply = () => {
    onApplyMonth(monthResult)
    onClose()
  }

  const handleRegenerate = () => {
    setStep(1)
    setMonthResult(null)
    setOverride(false)
    setExpandedWeek(null)
  }
  useEffect(() => {
    runGeneration()
  }, [])
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <div style={s.title}>
              {step === 1
                ? `Generating ${monthLabel}…`
                : `Review ${monthLabel}`}
            </div>
            <div style={s.subtitle}>
              {step === 1
                ? 'Building a compliant rota from staff data'
                : 'Check violations before applying to the rota'}
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>
            <FontAwesomeIcon icon='xmark' />
          </button>
        </div>

        {/* Step indicators */}
        <div style={s.steps}>
          {['Generate', 'Review'].map((label, i) => (
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
                {i + 1 < step ? <FontAwesomeIcon icon='check' /> : i + 1}
              </div>
              <span
                style={{
                  fontSize: '12px',
                  color: i + 1 === step ? '#e8eaf0' : '#5d6180',
                }}
              >
                {label}
              </span>
              {i < 1 && <div style={s.stepLine} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: GENERATING ── */}
        {step === 1 && (
          <div style={s.body}>
            <div style={s.generatingWrap}>
              {generating && <div style={s.spinner} />}
              {!generating && (
                <div style={s.doneIcon}>
                  <FontAwesomeIcon icon='check' />
                </div>
              )}
              <div style={s.genStatus}>
                {generating
                  ? `Building all weeks for ${monthLabel}…`
                  : 'Generation complete'}
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

        {/* ── STEP 2: REVIEW ── */}
        {step === 2 && monthResult && (
          <>
            <div style={s.body}>
              {/* Stats */}
              <div style={s.reviewStats}>
                <div style={s.reviewStat}>
                  <div style={s.reviewStatVal}>{monthResult.weeks.length}</div>
                  <div style={s.reviewStatLabel}>Weeks</div>
                </div>
                <div style={s.reviewStat}>
                  <div style={s.reviewStatVal}>
                    {Object.values(monthResult.weekRotas).reduce(
                      (a, r) => a + r.early.reduce((b, d) => b + d.length, 0),
                      0
                    )}
                  </div>
                  <div style={s.reviewStatLabel}>Early slots</div>
                </div>
                <div style={s.reviewStat}>
                  <div style={s.reviewStatVal}>
                    {Object.values(monthResult.weekRotas).reduce(
                      (a, r) => a + r.late.reduce((b, d) => b + d.length, 0),
                      0
                    )}
                  </div>
                  <div style={s.reviewStatLabel}>Late slots</div>
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
                  <div style={s.reviewStatLabel}>Soft flags</div>
                </div>
              </div>

              {/* All clear or violations */}
              {allMonthViolations.length === 0 ? (
                <div style={s.allGood}>
                  <FontAwesomeIcon icon='check' /> Fully compliant across all{' '}
                  {monthResult.weeks.length} weeks — no violations
                </div>
              ) : (
                <div style={s.violationsList}>
                  {monthResult.weeks.map((monday, wi) => {
                    const key = dateKey(monday)
                    const wv = monthResult.weekViolations[key] || []
                    const wHard = wv.filter((v) => v.type === 'hard')
                    const wSoft = wv.filter((v) => v.type === 'soft')
                    const isExpanded = expandedWeek === key
                    const weekLabel = `Week ${wi + 1} — ${monday.toLocaleDateString(
                      'en-GB',
                      { day: 'numeric', month: 'short' }
                    )}`

                    return (
                      <div key={key} style={s.weekAccordion}>
                        <div
                          style={{
                            ...s.weekAccordionHeader,
                            borderColor:
                              wHard.length > 0
                                ? 'rgba(232,92,61,0.25)'
                                : wSoft.length > 0
                                  ? 'rgba(196,136,58,0.25)'
                                  : 'rgba(46,204,138,0.2)',
                            background:
                              wHard.length > 0
                                ? 'rgba(232,92,61,0.06)'
                                : wSoft.length > 0
                                  ? 'rgba(196,136,58,0.06)'
                                  : 'rgba(46,204,138,0.05)',
                          }}
                          onClick={() =>
                            setExpandedWeek(isExpanded ? null : key)
                          }
                        >
                          <span style={s.weekAccordionTitle}>{weekLabel}</span>
                          <div style={s.weekAccordionBadges}>
                            {wHard.length > 0 && (
                              <span style={s.badgeHard}>
                                {wHard.length} hard
                              </span>
                            )}
                            {wSoft.length > 0 && (
                              <span style={s.badgeSoft}>
                                {wSoft.length} soft
                              </span>
                            )}
                            {wv.length === 0 && (
                              <span style={s.badgeOk}>
                                <FontAwesomeIcon icon='check' /> compliant
                              </span>
                            )}
                          </div>
                          <FontAwesomeIcon
                            icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                            style={{ color: '#5d6180', fontSize: '11px' }}
                          />
                        </div>
                        {isExpanded && wv.length > 0 && (
                          <div style={s.weekAccordionBody}>
                            <WeekViolationBlock violations={wv} s={s} />
                          </div>
                        )}
                      </div>
                    )
                  })}
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
            </div>

            {/* Footer */}
            <div style={s.footer}>
              <button style={s.secondaryBtn} onClick={handleRegenerate}>
                <FontAwesomeIcon icon='arrow-right-arrow-left' /> Regenerate
              </button>
              <div style={s.footerActions}>
                <button style={s.secondaryBtn} onClick={onClose}>
                  Cancel
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
                  onClick={handleApply}
                >
                  <FontAwesomeIcon icon='check' />
                  {hardViolations.length > 0 && overrideChecked
                    ? ' Apply with override'
                    : ` Apply ${monthLabel}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function WeekViolationBlock({ violations, s }) {
  const hard = violations.filter((v) => v.type === 'hard')
  const soft = violations.filter((v) => v.type === 'soft')
  return (
    <div>
      {hard.length > 0 && (
        <>
          <div style={s.violationGroupLabel}>Hard violations</div>
          {hard.map((v, i) => (
            <div key={i} style={s.violationCard}>
              <span style={s.violationIcon}>
                <FontAwesomeIcon icon='triangle-exclamation' />
              </span>
              <span>{v.message}</span>
            </div>
          ))}
        </>
      )}
      {soft.length > 0 && (
        <>
          <div
            style={{
              ...s.violationGroupLabel,
              color: '#c4883a',
              marginTop: hard.length > 0 ? '12px' : '0',
            }}
          >
            Soft rule flags
          </div>
          {soft.map((v, i) => (
            <div key={i} style={{ ...s.violationCard, ...s.softCard }}>
              <span style={{ ...s.violationIcon, color: '#c4883a' }}>
                <FontAwesomeIcon icon='triangle-exclamation' />
              </span>
              <span style={{ color: '#c4883a' }}>{v.message}</span>
            </div>
          ))}
        </>
      )}
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
    maxWidth: '760px',
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
  headerLeft: { flex: 1 },
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
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    padding: '20px 28px 0',
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
  body: {
    padding: '24px 28px',
    overflowY: 'auto',
    flex: 1,
  },
  generatingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 0',
    gap: '16px',
  },
  spinner: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.08)',
    borderTopColor: '#6c8fff',
    animation: 'spin 0.8s linear infinite',
  },
  doneIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'rgba(46,204,138,0.12)',
    border: '1px solid rgba(46,204,138,0.3)',
    color: '#2ecc8a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },
  genStatus: {
    fontSize: '15px',
    color: '#e8eaf0',
    fontWeight: 500,
    fontFamily: 'Syne, sans-serif',
  },
  logBox: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    padding: '14px 16px',
    width: '100%',
    maxHeight: '220px',
    overflowY: 'auto',
    fontFamily: 'DM Mono, monospace',
    fontSize: '11px',
  },
  logLine: { marginBottom: '4px', lineHeight: 1.6 },
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
    padding: '14px 12px',
  },
  reviewStatVal: {
    fontSize: '24px',
    fontWeight: 600,
    fontFamily: 'Syne, sans-serif',
    color: '#e8eaf0',
  },
  reviewStatLabel: {
    fontSize: '11px',
    color: '#9499b0',
    marginTop: '4px',
  },
  allGood: {
    background: 'rgba(46,204,138,0.08)',
    border: '1px solid rgba(46,204,138,0.2)',
    borderRadius: '10px',
    padding: '14px 16px',
    fontSize: '13px',
    color: '#2ecc8a',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  violationsList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  violationGroupLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#e85c3d',
    marginBottom: '6px',
    fontWeight: 500,
  },
  violationCard: {
    background: 'rgba(232,92,61,0.08)',
    border: '1px solid rgba(232,92,61,0.2)',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '12.5px',
    color: '#e85c3d',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  softCard: {
    background: 'rgba(196,136,58,0.08)',
    border: '1px solid rgba(196,136,58,0.2)',
  },
  violationIcon: { fontSize: '12px', flexShrink: 0 },
  weekAccordion: {
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '4px',
  },
  weekAccordionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    cursor: 'pointer',
    border: '1px solid',
    borderRadius: '8px',
    userSelect: 'none',
  },
  weekAccordionTitle: {
    fontSize: '12.5px',
    fontWeight: 500,
    color: '#e8eaf0',
    flex: 1,
  },
  weekAccordionBadges: { display: 'flex', gap: '6px' },
  weekAccordionBody: {
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.02)',
    borderLeft: '1px solid rgba(255,255,255,0.07)',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '0 0 8px 8px',
    marginTop: '-4px',
  },
  badgeHard: {
    fontSize: '10px',
    fontWeight: 500,
    color: '#e85c3d',
    background: 'rgba(232,92,61,0.12)',
    padding: '2px 7px',
    borderRadius: '4px',
  },
  badgeSoft: {
    fontSize: '10px',
    fontWeight: 500,
    color: '#c4883a',
    background: 'rgba(196,136,58,0.12)',
    padding: '2px 7px',
    borderRadius: '4px',
  },
  badgeOk: {
    fontSize: '10px',
    fontWeight: 500,
    color: '#2ecc8a',
    background: 'rgba(46,204,138,0.1)',
    padding: '2px 7px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  overrideRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'rgba(232,92,61,0.06)',
    border: '1px solid rgba(232,92,61,0.2)',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '16px',
  },
  overrideLabel: {
    fontSize: '12.5px',
    color: '#9499b0',
    cursor: 'pointer',
    lineHeight: 1.5,
  },
  footer: {
    padding: '16px 28px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#1d1f2b',
  },
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
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
}

export default GenerateModal
