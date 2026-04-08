import { useState, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { generateMonthRota } from '../../utils/rotaGenerator'
import { getWeeksForRange } from '../../utils/dateUtils'
import { dateKey } from '../../utils/dateUtils'

const THIS_YEAR = new Date().getFullYear()
const THIS_MONTH = new Date().getMonth()

// Build the list of selectable months: current month up to 24 months ahead
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
  // Default from = current month, to = 3 months ahead
  const [fromIdx, setFromIdx] = useState(0)
  const [toIdx, setToIdx] = useState(3)
  const [infoOpen, setInfoOpen] = useState(false)
  const [phase, setPhase] = useState('select') // 'select' | 'done'
  const [result, setResult] = useState(null) // { generated, skipped }

  const fromOption = MONTH_OPTIONS[fromIdx]
  const toOption = MONTH_OPTIONS[Math.max(fromIdx, toIdx)]

  // Compute preview: weeks per month in range, flagging existing ones
  const preview = useMemo(() => {
    if (!fromOption || !toOption) return []

    const allWeeks = getWeeksForRange(
      fromOption.year,
      fromOption.month,
      toOption.year,
      toOption.month
    )

    // Group by month label
    const monthMap = new Map()
    allWeeks.forEach(({ monday, monthLabel }) => {
      const key = monthLabel
      if (!monthMap.has(key)) {
        monthMap.set(key, { monthLabel, total: 0, existing: 0 })
      }
      const entry = monthMap.get(key)
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
      // generateMonthRota returns all weeks for that month — we only want this one
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
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.title}>Batch generate rota</div>
            <div style={s.subtitle}>Meadowview House</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>
            <FontAwesomeIcon icon='xmark' />
          </button>
        </div>

        {phase === 'select' && (
          <>
            {/* Month range selectors */}
            <div style={s.rangeRow}>
              <div style={s.rangeField}>
                <div style={s.fieldLabel}>From</div>
                <select
                  style={s.select}
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
              <div style={s.rangeField}>
                <div style={s.fieldLabel}>To</div>
                <select
                  style={s.select}
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

            {/* Collapsible instruction box */}
            <div style={s.infoWrap}>
              <div style={s.infoToggle} onClick={() => setInfoOpen((v) => !v)}>
                <div style={s.infoToggleLeft}>
                  <FontAwesomeIcon
                    icon='circle-info'
                    style={{ color: '#c4883a', fontSize: '14px' }}
                  />
                  <span style={s.infoToggleLabel}>
                    How does batch generation work?
                  </span>
                </div>
                <FontAwesomeIcon
                  icon={infoOpen ? 'chevron-up' : 'chevron-down'}
                  style={{ color: '#c4883a', fontSize: '11px' }}
                />
              </div>
              {infoOpen && (
                <div style={s.infoBody}>
                  <p style={s.infoText}>
                    Rotas are always generated as full Mon–Sun weeks.{' '}
                    <span style={s.infoHighlight}>
                      A week belongs to whichever month its Monday falls in
                    </span>{' '}
                    — so if a Monday lands in April, that entire week (including
                    any days that spill into May) is owned by April. When May is
                    generated, that overlapping week is automatically skipped.
                  </p>
                  <p style={{ ...s.infoText, marginTop: '10px' }}>
                    <span style={s.infoHighlight}>
                      Any week that already has a published rota is also skipped
                    </span>{' '}
                    — your existing shifts will never be overwritten.
                  </p>
                </div>
              )}
            </div>

            {/* Preview panel */}
            <div style={s.previewBox}>
              <div style={s.previewLabel}>Preview</div>
              <div style={s.previewList}>
                {preview.map((row, i) => {
                  const toGen = row.total - row.existing
                  const hasExisting = row.existing > 0
                  return (
                    <div key={i} style={s.previewRow}>
                      <span style={s.previewMonth}>{row.monthLabel}</span>
                      <span
                        style={{
                          ...s.previewBadge,
                          color: hasExisting ? '#c4883a' : '#2ecc8a',
                          background: hasExisting
                            ? 'rgba(196,136,58,0.1)'
                            : 'rgba(46,204,138,0.1)',
                          border: hasExisting
                            ? '1px solid rgba(196,136,58,0.25)'
                            : '1px solid rgba(46,204,138,0.25)',
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
              <div style={s.previewTotal}>
                <span style={s.previewTotalLabel}>Total weeks to generate</span>
                <span style={s.previewTotalVal}>{toGenerate} weeks</span>
              </div>
            </div>

            {/* Actions */}
            <div style={s.actions}>
              <button style={s.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button
                style={{
                  ...s.generateBtn,
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
          <div style={s.doneWrap}>
            <div style={s.doneIcon}>
              <FontAwesomeIcon icon='circle-check' />
            </div>
            <div style={s.doneTitle}>Rota generated</div>
            <div style={s.doneSummary}>
              <div style={s.doneStat}>
                <span style={s.doneStatVal}>{result.generated}</span>
                <span style={s.doneStatLabel}>
                  week{result.generated !== 1 ? 's' : ''} generated
                </span>
              </div>
              {result.skipped > 0 && (
                <div style={s.doneStat}>
                  <span style={{ ...s.doneStatVal, color: '#c4883a' }}>
                    {result.skipped}
                  </span>
                  <span style={s.doneStatLabel}>
                    week{result.skipped !== 1 ? 's' : ''} skipped
                    <br />
                    <span style={s.doneSkipNote}>already had a rota</span>
                  </span>
                </div>
              )}
            </div>
            <div style={s.doneHint}>
              Review the generated weeks in the month view. You can edit any
              cell before publishing.
            </div>
            <button style={s.doneCloseBtn} onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
    padding: '20px',
  },
  modal: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    width: '100%',
    maxWidth: '480px',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  title: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '18px',
    fontWeight: 600,
    color: '#e8eaf0',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '12px',
    color: '#9499b0',
  },
  closeBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: '#9499b0',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'DM Sans, sans-serif',
  },
  rangeRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '16px',
  },
  rangeField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fieldLabel: {
    fontSize: '11px',
    color: '#9499b0',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  select: {
    width: '100%',
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    color: '#e8eaf0',
    padding: '10px 12px',
    fontSize: '13px',
    fontFamily: 'DM Sans, sans-serif',
    cursor: 'pointer',
    appearance: 'none',
  },
  infoWrap: {
    marginBottom: '16px',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  infoToggle: {
    background: '#1a1c28',
    border: '1px solid rgba(196,136,58,0.3)',
    borderRadius: '12px',
    padding: '11px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    gap: '10px',
  },
  infoToggleLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  infoToggleLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#c4883a',
  },
  infoBody: {
    background: '#1a1c28',
    borderLeft: '1px solid rgba(196,136,58,0.3)',
    borderRight: '1px solid rgba(196,136,58,0.3)',
    borderBottom: '1px solid rgba(196,136,58,0.3)',
    borderRadius: '0 0 12px 12px',
    padding: '14px 16px',
  },
  infoText: {
    fontSize: '12px',
    color: '#9499b0',
    lineHeight: 1.7,
    margin: 0,
  },
  infoHighlight: {
    color: '#c8cad8',
  },
  previewBox: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '24px',
  },
  previewLabel: {
    fontSize: '11px',
    color: '#9499b0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 500,
    marginBottom: '10px',
  },
  previewList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  previewRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewMonth: {
    fontSize: '12px',
    color: '#e8eaf0',
  },
  previewBadge: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  previewTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  previewTotalLabel: {
    fontSize: '12px',
    color: '#9499b0',
  },
  previewTotalVal: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#e8eaf0',
    fontFamily: 'Syne, sans-serif',
  },
  actions: {
    display: 'flex',
    gap: '10px',
  },
  cancelBtn: {
    flex: 1,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#9499b0',
    padding: '11px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  generateBtn: {
    flex: 2,
    background: '#6c8fff',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    padding: '11px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
  },
  doneWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px',
    paddingTop: '8px',
  },
  doneIcon: {
    fontSize: '40px',
    color: '#2ecc8a',
    background: 'rgba(46,204,138,0.1)',
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '20px',
    fontWeight: 600,
    color: '#e8eaf0',
  },
  doneSummary: {
    display: 'flex',
    gap: '32px',
    justifyContent: 'center',
    marginTop: '4px',
  },
  doneStat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  doneStatVal: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '28px',
    fontWeight: 600,
    color: '#2ecc8a',
  },
  doneStatLabel: {
    fontSize: '12px',
    color: '#9499b0',
    lineHeight: 1.5,
  },
  doneSkipNote: {
    fontSize: '11px',
    color: '#5d6180',
  },
  doneHint: {
    fontSize: '12px',
    color: '#9499b0',
    lineHeight: 1.6,
    maxWidth: '340px',
    marginTop: '4px',
  },
  doneCloseBtn: {
    background: '#6c8fff',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    padding: '11px 40px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    marginTop: '8px',
  },
}

export default BatchGenerateModal
