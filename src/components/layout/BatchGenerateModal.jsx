import { useState, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { generateMonthRota } from '../../utils/rotaGenerator'
import { getWeeksForRange, dateKey } from '../../utils/dateUtils'
import styles from './BatchGenerateModal.module.css'

const THIS_YEAR = new Date().getFullYear()
const THIS_MONTH = new Date().getMonth()

function buildMonthOptions() {
  const options = []
  for (let i = 0; i < 24; i++) {
    const m = (THIS_MONTH + i) % 12
    const y = THIS_YEAR + Math.floor((THIS_MONTH + i) / 12)
    const label = new Date(y, m, 1).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    })
    options.push({ year: y, month: m, label })
  }
  return options
}

const MONTH_OPTIONS = buildMonthOptions()

function BatchGenerateModal({
  onClose,
  onApplyBatch,
  monthRota,
  staffMap,
  timeOff,
}) {
  const [fromIdx, setFromIdx] = useState(0)
  const [toIdx, setToIdx] = useState(3)
  const [infoOpen, setInfoOpen] = useState(false)
  const [phase, setPhase] = useState('select')
  const [result, setResult] = useState(null)

  const fromOption = MONTH_OPTIONS[fromIdx]
  const toOption = MONTH_OPTIONS[Math.max(fromIdx, toIdx)]

  const preview = useMemo(() => {
    if (!fromOption || !toOption) return []
    const allWeeks = getWeeksForRange(
      fromOption.year,
      fromOption.month,
      toOption.year,
      toOption.month
    )
    const monthMap = new Map()
    allWeeks.forEach(({ monday, monthLabel }) => {
      if (!monthMap.has(monthLabel)) {
        monthMap.set(monthLabel, { monthLabel, total: 0, existing: 0 })
      }
      const entry = monthMap.get(monthLabel)
      entry.total++
      if (monthRota[dateKey(monday)]) entry.existing++
    })
    return Array.from(monthMap.values())
  }, [fromIdx, toIdx, monthRota, fromOption, toOption])

  const totalWeeks = preview.reduce((a, m) => a + m.total, 0)
  const totalExisting = preview.reduce((a, m) => a + m.existing, 0)
  const toGenerate = totalWeeks - totalExisting

  const handleGenerate = () => {
    const allWeeks = getWeeksForRange(
      fromOption.year,
      fromOption.month,
      toOption.year,
      toOption.month
    )
    const newWeekRotas = {}
    let generatedCount = 0
    let skippedCount = 0

    allWeeks.forEach(({ monday }) => {
      const key = dateKey(monday)
      if (monthRota[key]) {
        skippedCount++
        return
      }
      const { weekRotas } = generateMonthRota(
        monday.getFullYear(),
        monday.getMonth(),
        staffMap,
        timeOff
      )
      if (weekRotas[key]) {
        newWeekRotas[key] = weekRotas[key]
        generatedCount++
      }
    })

    onApplyBatch(newWeekRotas)
    setResult({ generated: generatedCount, skipped: skippedCount })
    setPhase('done')
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Batch generate rota</div>
            <div className={styles.subtitle}>Meadowview House</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <FontAwesomeIcon icon='xmark' />
          </button>
        </div>

        {phase === 'select' && (
          <>
            {/* Month range selectors */}
            <div className={styles.rangeRow}>
              <div className={styles.rangeField}>
                <div className={styles.fieldLabel}>From</div>
                <select
                  className={styles.select}
                  value={fromIdx}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setFromIdx(val)
                    if (toIdx < val) setToIdx(val)
                  }}
                >
                  {MONTH_OPTIONS.map((opt, i) => (
                    <option key={i} value={i}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.rangeField}>
                <div className={styles.fieldLabel}>To</div>
                <select
                  className={styles.select}
                  value={Math.max(fromIdx, toIdx)}
                  onChange={(e) => setToIdx(Number(e.target.value))}
                >
                  {MONTH_OPTIONS.map((opt, i) => (
                    <option key={i} value={i} disabled={i < fromIdx}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Collapsible info box */}
            <div className={styles.infoWrap}>
              <div
                className={styles.infoToggle}
                onClick={() => setInfoOpen((v) => !v)}
              >
                <div className={styles.infoToggleLeft}>
                  <FontAwesomeIcon icon='circle-info' />
                  <span className={styles.infoToggleLabel}>
                    How does batch generation work?
                  </span>
                </div>
                <FontAwesomeIcon
                  icon={infoOpen ? 'chevron-up' : 'chevron-down'}
                  style={{ color: 'var(--color-warning)', fontSize: '11px' }}
                />
              </div>
              {infoOpen && (
                <div className={styles.infoBody}>
                  <p className={styles.infoText}>
                    Rotas are always generated as full Mon–Sun weeks.{' '}
                    <span className={styles.infoHighlight}>
                      A week belongs to whichever month its Monday falls in
                    </span>{' '}
                    — so if a Monday lands in April, that entire week (including
                    any days that spill into May) is owned by April. When May is
                    generated, that overlapping week is automatically skipped.
                  </p>
                  <p className={styles.infoText} style={{ marginTop: '10px' }}>
                    <span className={styles.infoHighlight}>
                      Any week that already has a published rota is also skipped
                    </span>{' '}
                    — your existing shifts will never be overwritten.
                  </p>
                </div>
              )}
            </div>

            {/* Preview panel */}
            <div className={styles.previewBox}>
              <div className={styles.previewLabel}>Preview</div>
              <div className={styles.previewList}>
                {preview.map((row, i) => {
                  const toGen = row.total - row.existing
                  const hasExisting = row.existing > 0
                  return (
                    <div key={i} className={styles.previewRow}>
                      <span className={styles.previewMonth}>
                        {row.monthLabel}
                      </span>
                      <span
                        className={styles.previewBadge}
                        style={{
                          color: hasExisting
                            ? 'var(--color-warning)'
                            : 'var(--color-success)',
                          background: hasExisting
                            ? 'var(--color-warning-bg)'
                            : 'var(--color-success-bg)',
                          border: hasExisting
                            ? '1px solid var(--color-warning-border)'
                            : '1px solid var(--color-success-border)',
                        }}
                      >
                        {hasExisting
                          ? `${toGen} week${toGen !== 1 ? 's' : ''} · ${row.existing} already exist${row.existing !== 1 ? 's' : ''}`
                          : `${row.total} week${row.total !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className={styles.previewTotal}>
                <span className={styles.previewTotalLabel}>
                  Total weeks to generate
                </span>
                <span className={styles.previewTotalVal}>
                  {toGenerate} weeks
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button
                className={styles.generateBtn}
                style={{
                  opacity: toGenerate === 0 ? 0.5 : 1,
                  cursor: toGenerate === 0 ? 'not-allowed' : 'pointer',
                }}
                onClick={toGenerate > 0 ? handleGenerate : undefined}
              >
                <FontAwesomeIcon icon='bolt' />
                {` Generate ${toGenerate} week${toGenerate !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}

        {phase === 'done' && result && (
          <div className={styles.doneWrap}>
            <div className={styles.doneIcon}>
              <FontAwesomeIcon icon='circle-check' />
            </div>
            <div className={styles.doneTitle}>Rota generated</div>
            <div className={styles.doneSummary}>
              <div className={styles.doneStat}>
                <span className={styles.doneStatVal}>{result.generated}</span>
                <span className={styles.doneStatLabel}>
                  week{result.generated !== 1 ? 's' : ''} generated
                </span>
              </div>
              {result.skipped > 0 && (
                <div className={styles.doneStat}>
                  <span
                    className={styles.doneStatVal}
                    style={{ color: 'var(--color-warning)' }}
                  >
                    {result.skipped}
                  </span>
                  <span className={styles.doneStatLabel}>
                    week{result.skipped !== 1 ? 's' : ''} skipped
                    <br />
                    <span className={styles.doneSkipNote}>
                      already had a rota
                    </span>
                  </span>
                </div>
              )}
            </div>
            <div className={styles.doneHint}>
              Review the generated weeks in the month view. You can edit any
              cell before publishing.
            </div>
            <button className={styles.doneCloseBtn} onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default BatchGenerateModal
