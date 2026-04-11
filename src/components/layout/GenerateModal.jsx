import { useState, useEffect } from 'react'
import { generateMonthRota } from '../../utils/rotaGenerator'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { dateKey } from '../../utils/dateUtils'
import styles from './GenerateModal.module.css'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function GenerateModal({
  onClose,
  onApplyMonth,
  scopeYear,
  scopeMonth,
  monthLabel,
  staffMap,
  timeOff,
}) {
  const [step, setStep] = useState(1)
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

    const result = generateMonthRota(scopeYear, scopeMonth, staffMap, timeOff)
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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.title}>
              {step === 1
                ? `Generating ${monthLabel}…`
                : `Review ${monthLabel}`}
            </div>
            <div className={styles.subtitle}>
              {step === 1
                ? 'Building a compliant rota from staff data'
                : 'Check violations before applying to the rota'}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <FontAwesomeIcon icon='xmark' />
          </button>
        </div>

        {/* Step indicators */}
        <div className={styles.steps}>
          {['Generate', 'Review'].map((label, i) => (
            <div key={label} className={styles.stepItem}>
              <div
                className={styles.stepNum}
                style={{
                  background:
                    i + 1 < step
                      ? 'var(--accent)'
                      : i + 1 === step
                        ? 'var(--accent-bg)'
                        : 'transparent',
                  color: i + 1 <= step ? 'var(--accent)' : 'var(--text-muted)',
                  border:
                    i + 1 <= step
                      ? '1.5px solid var(--accent)'
                      : '1.5px solid var(--border-default)',
                }}
              >
                {i + 1 < step ? <FontAwesomeIcon icon='check' /> : i + 1}
              </div>
              <span
                style={{
                  fontSize: '12px',
                  color:
                    i + 1 === step
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                }}
              >
                {label}
              </span>
              {i < 1 && <div className={styles.stepLine} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Generating */}
        {step === 1 && (
          <div className={styles.body}>
            <div className={styles.generatingWrap}>
              {generating ? (
                <div className={styles.spinner} />
              ) : (
                <div className={styles.doneIcon}>
                  <FontAwesomeIcon icon='check' />
                </div>
              )}
              <div className={styles.genStatus}>
                {generating
                  ? `Building all weeks for ${monthLabel}…`
                  : 'Generation complete'}
              </div>
              <div className={styles.logBox}>
                {logLines.map((line, i) => (
                  <div
                    key={i}
                    className={styles.logLine}
                    style={{
                      color:
                        line.type === 'ok'
                          ? 'var(--color-success)'
                          : line.type === 'warn'
                            ? 'var(--color-danger)'
                            : line.type === 'soft'
                              ? 'var(--color-warning)'
                              : line.type === 'info'
                                ? 'var(--accent)'
                                : 'var(--text-secondary)',
                    }}
                  >
                    {line.msg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Review */}
        {step === 2 && monthResult && (
          <>
            <div className={styles.body}>
              <div className={styles.reviewStats}>
                <div className={styles.reviewStat}>
                  <div className={styles.reviewStatVal}>
                    {monthResult.weeks.length}
                  </div>
                  <div className={styles.reviewStatLabel}>Weeks</div>
                </div>
                <div className={styles.reviewStat}>
                  <div className={styles.reviewStatVal}>
                    {Object.values(monthResult.weekRotas).reduce(
                      (a, r) => a + r.early.reduce((b, d) => b + d.length, 0),
                      0
                    )}
                  </div>
                  <div className={styles.reviewStatLabel}>Early slots</div>
                </div>
                <div className={styles.reviewStat}>
                  <div className={styles.reviewStatVal}>
                    {Object.values(monthResult.weekRotas).reduce(
                      (a, r) => a + r.late.reduce((b, d) => b + d.length, 0),
                      0
                    )}
                  </div>
                  <div className={styles.reviewStatLabel}>Late slots</div>
                </div>
                <div className={styles.reviewStat}>
                  <div
                    className={styles.reviewStatVal}
                    style={{
                      color:
                        hardViolations.length > 0
                          ? 'var(--color-danger)'
                          : 'var(--color-success)',
                    }}
                  >
                    {hardViolations.length}
                  </div>
                  <div className={styles.reviewStatLabel}>Hard violations</div>
                </div>
                <div className={styles.reviewStat}>
                  <div
                    className={styles.reviewStatVal}
                    style={{
                      color:
                        softViolations.length > 0
                          ? 'var(--color-warning)'
                          : 'var(--color-success)',
                    }}
                  >
                    {softViolations.length}
                  </div>
                  <div className={styles.reviewStatLabel}>Soft flags</div>
                </div>
              </div>

              {allMonthViolations.length === 0 ? (
                <div className={styles.allGood}>
                  <FontAwesomeIcon icon='check' /> Fully compliant across all{' '}
                  {monthResult.weeks.length} weeks — no violations
                </div>
              ) : (
                <div className={styles.violationsList}>
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
                      <div key={key} className={styles.weekAccordion}>
                        <div
                          className={styles.weekAccordionHeader}
                          style={{
                            borderColor:
                              wHard.length > 0
                                ? 'var(--color-danger-border)'
                                : wSoft.length > 0
                                  ? 'var(--color-warning-border)'
                                  : 'var(--color-success-border)',
                            background:
                              wHard.length > 0
                                ? 'var(--color-danger-bg)'
                                : wSoft.length > 0
                                  ? 'var(--color-warning-bg)'
                                  : 'var(--color-success-bg)',
                          }}
                          onClick={() =>
                            setExpandedWeek(isExpanded ? null : key)
                          }
                        >
                          <span className={styles.weekAccordionTitle}>
                            {weekLabel}
                          </span>
                          <div className={styles.weekAccordionBadges}>
                            {wHard.length > 0 && (
                              <span className={styles.badgeHard}>
                                {wHard.length} hard
                              </span>
                            )}
                            {wSoft.length > 0 && (
                              <span className={styles.badgeSoft}>
                                {wSoft.length} soft
                              </span>
                            )}
                            {wv.length === 0 && (
                              <span className={styles.badgeOk}>
                                <FontAwesomeIcon icon='check' /> compliant
                              </span>
                            )}
                          </div>
                          <FontAwesomeIcon
                            icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                            style={{
                              color: 'var(--text-muted)',
                              fontSize: '11px',
                            }}
                          />
                        </div>
                        {isExpanded && wv.length > 0 && (
                          <div className={styles.weekAccordionBody}>
                            <WeekViolationBlock violations={wv} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {hardViolations.length > 0 && (
                <div className={styles.overrideRow}>
                  <input
                    type='checkbox'
                    id='override'
                    checked={overrideChecked}
                    onChange={(e) => setOverride(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor='override' className={styles.overrideLabel}>
                    I understand the violations and want to apply this rota
                    anyway. This override will be logged.
                  </label>
                </div>
              )}
            </div>

            <div className={styles.footer}>
              <button
                className={styles.secondaryBtn}
                onClick={handleRegenerate}
              >
                <FontAwesomeIcon icon='arrow-right-arrow-left' /> Regenerate
              </button>
              <div className={styles.footerActions}>
                <button className={styles.secondaryBtn} onClick={onClose}>
                  Cancel
                </button>
                <button
                  className={styles.primaryBtn}
                  style={{
                    opacity: canApply ? 1 : 0.4,
                    cursor: canApply ? 'pointer' : 'not-allowed',
                    background:
                      hardViolations.length > 0 && overrideChecked
                        ? 'var(--color-danger)'
                        : 'var(--accent)',
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

function WeekViolationBlock({ violations }) {
  const hard = violations.filter((v) => v.type === 'hard')
  const soft = violations.filter((v) => v.type === 'soft')
  return (
    <div>
      {hard.length > 0 && (
        <>
          <div className={styles.violationGroupLabel}>Hard violations</div>
          {hard.map((v, i) => (
            <div key={i} className={styles.violationCard}>
              <span className={styles.violationIcon}>
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
            className={styles.violationGroupLabelSoft}
            style={{ marginTop: hard.length > 0 ? '12px' : '0' }}
          >
            Soft rule flags
          </div>
          {soft.map((v, i) => (
            <div
              key={i}
              className={`${styles.violationCard} ${styles.softCard}`}
            >
              <span className={styles.violationIcon}>
                <FontAwesomeIcon icon='triangle-exclamation' />
              </span>
              <span>{v.message}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default GenerateModal
