import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import { mockShifts, staffIdMap } from '../data/mockCalendar'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  addRequest,
  updateRequest,
  getShiftRequest,
  loadRequests,
  getRecentRequestWarning,
  pingRequest,
  getPingInfo,
} from '../utils/cancelRequests'

const WEEK = [
  { date: '2025-03-31', day: 'Mon', label: '31 Mar' },
  { date: '2025-04-01', day: 'Tue', label: '1 Apr' },
  { date: '2025-04-02', day: 'Wed', label: '2 Apr' },
  { date: '2025-04-03', day: 'Thu', label: '3 Apr' },
  { date: '2025-04-04', day: 'Fri', label: '4 Apr' },
  { date: '2025-04-05', day: 'Sat', label: '5 Apr' },
  { date: '2025-04-06', day: 'Sun', label: '6 Apr' },
]

function Calendar() {
  const { user } = useAuth()
  const [selectedShift, setSelectedShift] = useState(null)
  const [cancelledShifts, setCancelledShifts] = useState([])
  const [cancelReason, setCancelReason] = useState('')
  const [customReasonText, setCustomReasonText] = useState('')
  const [showReasonForm, setShowReasonForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const staffId = staffIdMap[user?.email]
  const myShifts = staffId ? mockShifts[staffId] || [] : []

  // Helper to check if shift has pending request
  const getShiftRequestStatus = (shift) => {
    if (!shift || !staffId) return null
    const requests = loadRequests()
    const request = requests.find(
      (r) =>
        r.staffId === staffId &&
        r.shiftDate === shift.date &&
        r.shiftType === shift.type
    )
    return request
  }

  const getShiftForDay = (date) =>
    myShifts.find((s) => s.date === date && !cancelledShifts.includes(s.date))

  const handleCancel = (shift) => {
    setCancelledShifts((prev) => [...prev, shift.date])
    setSelectedShift(null)
    setCancelConfirm(false)
  }

  // Handle withdraw request
  const handleWithdraw = (requestId) => {
    updateRequest(requestId, {
      status: 'withdrawn',
      withdrawnAt: new Date().toISOString(),
    })
    setSelectedShift(null)
    setCancelReason('')
    setCustomReasonText('')
    setShowReasonForm(false)
  }

  // Handle submit request
  const handleSubmitRequest = () => {
    if (!cancelReason) return
    if (cancelReason === 'Other' && !customReasonText.trim()) return

    setSubmitting(true)

    addRequest({
      staffId: staffId,
      staffName: user?.name,
      shiftDate: selectedShift.date,
      shiftType: selectedShift.type,
      reason: cancelReason,
      customReason: cancelReason === 'Other' ? customReasonText : '',
    })

    setTimeout(() => {
      setSelectedShift(null)
      setCancelReason('')
      setCustomReasonText('')
      setSubmitting(false)
      // Force a re-render of the calendar by refreshing the component
      // The parent component will reload when modal closes
    }, 500)
  }

  const workedDays = myShifts.filter(
    (s) => !cancelledShifts.includes(s.date)
  ).length
  const hoursThisWeek = workedDays * 7.5

  return (
    <div style={s.page}>
      <Navbar />

      <div style={s.body}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.title}>My Schedule</h1>
            <p style={s.subtitle}>w/c 31 Mar 2025</p>
          </div>
          <div style={s.statsRow}>
            <div style={s.stat}>
              <div style={s.statVal}>{workedDays}</div>
              <div style={s.statLabel}>Shifts</div>
            </div>
            <div style={s.stat}>
              <div style={s.statVal}>{hoursThisWeek}h</div>
              <div style={s.statLabel}>Hours</div>
            </div>
          </div>
        </div>

        {/* Week grid */}
        <div style={s.weekGrid}>
          {WEEK.map(({ date, day, label }) => {
            const shift = getShiftForDay(date)
            const isToday = date === '2025-04-01'
            const isCancelled =
              cancelledShifts.includes(date) &&
              myShifts.find((s) => s.date === date)

            // Check if shift has pending request
            const shiftRequest = shift ? getShiftRequestStatus(shift) : null
            const isPending = shiftRequest?.status === 'pending'
            const isApproved = shiftRequest?.status === 'approved'
            const isRejected = shiftRequest?.status === 'rejected'
            const isWithdrawn = shiftRequest?.status === 'withdrawn'

            return (
              <div
                key={date}
                style={{
                  ...s.dayCard,
                  border: isToday
                    ? '1px solid rgba(108,143,255,0.4)'
                    : '1px solid rgba(255,255,255,0.07)',
                  cursor: shift ? 'pointer' : 'default',
                }}
                onClick={() => shift && setSelectedShift(shift)}
              >
                <div style={s.dayTop}>
                  <span
                    style={{
                      ...s.dayName,
                      color: isToday ? '#6c8fff' : '#9499b0',
                    }}
                  >
                    {day}
                  </span>
                  <span
                    style={{
                      ...s.dayDate,
                      color: isToday ? '#6c8fff' : '#e8eaf0',
                    }}
                  >
                    {label}
                  </span>
                </div>

                {isCancelled ? (
                  <div style={s.cancelledTag}>Cancelled</div>
                ) : isApproved ? (
                  <div style={s.approvedTag}>Cancellation approved</div>
                ) : shift ? (
                  // Show normal shift card for all other cases (including rejected, withdrawn, no request)
                  <div
                    style={{
                      ...s.shiftCard,
                      background: isPending
                        ? 'rgba(196,136,58,0.15)'
                        : shift.type === 'early'
                          ? 'rgba(42,127,98,0.15)'
                          : 'rgba(122,79,168,0.15)',
                      border: isPending
                        ? '1px solid rgba(196,136,58,0.35)'
                        : shift.type === 'early'
                          ? '1px solid rgba(42,127,98,0.35)'
                          : '1px solid rgba(122,79,168,0.35)',
                    }}
                  >
                    <div
                      style={{
                        ...s.shiftType,
                        color: isPending
                          ? '#c4883a'
                          : shift.type === 'early'
                            ? '#2a7f62'
                            : '#7a4fa8',
                      }}
                    >
                      {shift.type === 'early' ? 'Early' : 'Late'}
                      {shift.sleepIn && ' · 💤 Sleep-in'}
                      {isPending && ' · ⏳ Pending'}
                    </div>
                    <div style={s.shiftTime}>{shift.time}</div>
                    <div style={s.shiftHome}>{shift.home}</div>
                  </div>
                ) : (
                  <div style={s.offDay}>Day off</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Shift detail modal */}
        {selectedShift && (
          <div
            style={s.overlay}
            onClick={() => {
              setSelectedShift(null)
              setShowReasonForm(false)
              setCancelReason('')
              setCustomReasonText('')
            }}
          >
            <div style={s.modal} onClick={(e) => e.stopPropagation()}>
              <div style={s.modalHeader}>
                <div style={s.modalTitle}>Shift Details</div>
                <button
                  style={s.closeBtn}
                  onClick={() => {
                    setSelectedShift(null)
                    setShowReasonForm(false)
                    setCancelReason('')
                    setCustomReasonText('')
                  }}
                >
                  <FontAwesomeIcon icon='xmark' />
                </button>
              </div>

              <div style={s.modalBody}>
                <div style={s.detailRow}>
                  <span style={s.detailLabel}>Day</span>
                  <span style={s.detailVal}>
                    {selectedShift.day}, {selectedShift.date}
                  </span>
                </div>
                <div style={s.detailRow}>
                  <span style={s.detailLabel}>Shift</span>
                  <span
                    style={{
                      ...s.detailVal,
                      color:
                        selectedShift.type === 'early' ? '#2a7f62' : '#7a4fa8',
                      textTransform: 'capitalize',
                    }}
                  >
                    {selectedShift.type}
                  </span>
                </div>
                <div style={s.detailRow}>
                  <span style={s.detailLabel}>Time</span>
                  <span style={s.detailVal}>{selectedShift.time}</span>
                </div>
                <div style={s.detailRow}>
                  <span style={s.detailLabel}>Home</span>
                  <span style={s.detailVal}>{selectedShift.home}</span>
                </div>
                {selectedShift.sleepIn && (
                  <div style={s.detailRow}>
                    <span style={s.detailLabel}>Sleep-in</span>
                    <span style={{ ...s.detailVal, color: '#c4883a' }}>
                      💤 Yes
                    </span>
                  </div>
                )}
                <div style={s.detailRow}>
                  <span style={s.detailLabel}>Status</span>
                  {(() => {
                    const request = getShiftRequestStatus(selectedShift)
                    if (request?.status === 'pending') {
                      return (
                        <span style={{ ...s.detailVal, color: '#c4883a' }}>
                          ⏳ Cancellation requested
                        </span>
                      )
                    }
                    if (request?.status === 'approved') {
                      return (
                        <span style={{ ...s.detailVal, color: '#e85c3d' }}>
                          ✗ Cancelled (approved)
                        </span>
                      )
                    }
                    if (request?.status === 'rejected') {
                      return (
                        <span style={{ ...s.detailVal, color: '#9499b0' }}>
                          Cancellation rejected
                        </span>
                      )
                    }
                    if (request?.status === 'withdrawn') {
                      return (
                        <span style={{ ...s.detailVal, color: '#2ecc8a' }}>
                          ✓ Confirmed (request withdrawn)
                        </span>
                      )
                    }
                    return (
                      <span style={{ ...s.detailVal, color: '#2ecc8a' }}>
                        ✓ Confirmed
                      </span>
                    )
                  })()}
                </div>

                {/* Show rejection reason if present */}
                {(() => {
                  const request = getShiftRequestStatus(selectedShift)
                  if (
                    request?.status === 'rejected' &&
                    request.rejectionReason
                  ) {
                    return (
                      <div style={s.detailRow}>
                        <span style={s.detailLabel}>Rejection reason</span>
                        <span
                          style={{
                            ...s.detailVal,
                            color: '#e85c3d',
                            fontSize: '12px',
                          }}
                        >
                          {request.rejectionReason}
                        </span>
                      </div>
                    )
                  }
                  return null
                })()}
              </div>

              {/* Show different buttons based on request status */}
              {(() => {
                const request = getShiftRequestStatus(selectedShift)
                const { count, shouldWarn, message } = getRecentRequestWarning(
                  staffId,
                  selectedShift.date,
                  selectedShift.type
                )

                // If pending request exists, show withdraw button (and allow new request option)
                if (request?.status === 'pending') {
                  const pingInfo = getPingInfo(request)

                  return (
                    <>
                      <div style={s.pendingWarning}>
                        <FontAwesomeIcon icon='clock' /> Cancellation request
                        pending manager approval
                      </div>

                      {pingInfo.lastPingedAt && (
                        <div style={s.lastPingInfo}>
                          <FontAwesomeIcon icon='paper-plane' /> Last pinged:{' '}
                          {new Date(pingInfo.lastPingedAt).toLocaleString()}
                        </div>
                      )}

                      <div style={s.buttonGroup}>
                        <button
                          style={s.withdrawBtn}
                          onClick={() => handleWithdraw(request.id)}
                        >
                          Withdraw request
                        </button>

                        {pingInfo.canPing ? (
                          <button
                            style={s.pingBtn}
                            onClick={() => {
                              const updated = pingRequest(request.id, staffId)
                              if (updated) {
                                // Refresh the request status
                                const refreshed =
                                  getShiftRequestStatus(selectedShift)
                                setSelectedShift({ ...selectedShift }) // Force re-render
                                // Show temporary feedback
                                alert(
                                  `Ping sent! Manager has been notified. (${pingInfo.remainingPings - 1} pings remaining)`
                                )
                              }
                            }}
                          >
                            <FontAwesomeIcon icon='bell' /> Ping Manager (
                            {pingInfo.remainingPings} left)
                          </button>
                        ) : (
                          <button
                            style={s.pingBtnDisabled}
                            disabled
                            title={pingInfo.message}
                          >
                            <FontAwesomeIcon icon='bell-slash' /> Ping limit
                            reached
                          </button>
                        )}
                      </div>

                      {pingInfo.message && !pingInfo.canPing && (
                        <div style={s.pingLimitWarning}>
                          <FontAwesomeIcon icon='triangle-exclamation' /> Max
                          pings reached (3/3)
                        </div>
                      )}
                    </>
                  )
                }

                // ALWAYS show cancel button for approved, rejected, withdrawn, or no request
                // Only hide if shift is already cancelled (approved) - that shift is gone
                if (request?.status === 'approved') {
                  return (
                    <div style={s.approvedNote}>
                      <FontAwesomeIcon icon='check-circle' /> This shift has
                      been cancelled and removed from the rota.
                    </div>
                  )
                }

                // Show cancel button for all other cases (rejected, withdrawn, or no request)
                if (!showReasonForm) {
                  return (
                    <>
                      {shouldWarn && (
                        <div style={s.warningNote}>
                          <FontAwesomeIcon icon='triangle-exclamation' />{' '}
                          {message}
                        </div>
                      )}
                      <button
                        style={s.cancelShiftBtn}
                        onClick={() => setShowReasonForm(true)}
                      >
                        Request cancellation
                      </button>
                    </>
                  )
                }

                // Show reason form
                return (
                  <div style={s.reasonForm}>
                    {shouldWarn && (
                      <div style={s.warningNoteInline}>
                        <FontAwesomeIcon icon='triangle-exclamation' />{' '}
                        {message}
                      </div>
                    )}
                    <div style={s.reasonLabel}>Reason for cancellation:</div>
                    <select
                      style={s.reasonSelect}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    >
                      <option value=''>Select a reason...</option>
                      <option value='Sick'>🤒 Sick</option>
                      <option value='Family emergency'>
                        🏠 Family emergency
                      </option>
                      <option value='Transport issue'>
                        🚗 Transport issue
                      </option>
                      <option value='Other'>📝 Other (please specify)</option>
                    </select>

                    {cancelReason === 'Other' && (
                      <textarea
                        style={s.reasonTextarea}
                        placeholder='Please specify your reason...'
                        value={customReasonText}
                        onChange={(e) => setCustomReasonText(e.target.value)}
                        rows='3'
                      />
                    )}

                    <div style={s.reasonActions}>
                      <button
                        style={s.cancelReasonBtn}
                        onClick={() => {
                          setShowReasonForm(false)
                          setCancelReason('')
                          setCustomReasonText('')
                        }}
                      >
                        Back
                      </button>
                      <button
                        style={{
                          ...s.submitReasonBtn,
                          opacity:
                            !cancelReason ||
                            (cancelReason === 'Other' &&
                              !customReasonText.trim())
                              ? 0.5
                              : 1,
                          cursor:
                            !cancelReason ||
                            (cancelReason === 'Other' &&
                              !customReasonText.trim())
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                        disabled={
                          !cancelReason ||
                          (cancelReason === 'Other' && !customReasonText.trim())
                        }
                        onClick={handleSubmitRequest}
                      >
                        {submitting ? 'Submitting...' : 'Submit request'}
                      </button>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>
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
  body: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  title: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '22px',
    fontWeight: 600,
    margin: 0,
  },
  subtitle: { fontSize: '13px', color: '#9499b0', marginTop: '4px' },
  statsRow: { display: 'flex', gap: '16px' },
  stat: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    padding: '12px 20px',
    textAlign: 'center',
  },
  statVal: {
    fontSize: '22px',
    fontWeight: 600,
    fontFamily: 'Syne, sans-serif',
    color: '#e8eaf0',
  },
  statLabel: { fontSize: '11px', color: '#9499b0', marginTop: '2px' },
  weekGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '10px',
  },
  dayCard: {
    background: '#161820',
    borderRadius: '12px',
    padding: '14px',
    minHeight: '120px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    transition: 'border-color 0.15s',
  },
  dayTop: { display: 'flex', flexDirection: 'column', gap: '2px' },
  dayName: {
    fontSize: '11px',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  dayDate: {
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'Syne, sans-serif',
  },
  shiftCard: { borderRadius: '8px', padding: '8px', flex: 1 },
  shiftType: { fontSize: '12px', fontWeight: 600 },
  shiftTime: {
    fontSize: '11px',
    color: '#9499b0',
    marginTop: '3px',
    fontFamily: 'DM Mono, monospace',
  },
  shiftHome: { fontSize: '11px', color: '#5d6180', marginTop: '4px' },
  offDay: { fontSize: '12px', color: '#5d6180', marginTop: 'auto' },
  cancelledTag: {
    fontSize: '11px',
    color: '#e85c3d',
    background: 'rgba(232,92,61,0.1)',
    borderRadius: '6px',
    padding: '4px 8px',
    width: 'fit-content',
  },
  approvedTag: {
    fontSize: '11px',
    color: '#e85c3d',
    background: 'rgba(232,92,61,0.1)',
    borderRadius: '6px',
    padding: '4px 8px',
    width: 'fit-content',
  },
  rejectedTag: {
    fontSize: '11px',
    color: '#9499b0',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '6px',
    padding: '4px 8px',
    width: 'fit-content',
  },
  withdrawnTag: {
    fontSize: '11px',
    color: '#2ecc8a',
    background: 'rgba(46,204,138,0.1)',
    borderRadius: '6px',
    padding: '4px 8px',
    width: 'fit-content',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '20px',
  },
  modal: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '400px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  modalTitle: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '16px',
    fontWeight: 600,
  },
  closeBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#9499b0',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  modalBody: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    overflowY: 'auto',
    flex: 1,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: { fontSize: '13px', color: '#9499b0' },
  detailVal: { fontSize: '13px', fontWeight: 500, color: '#e8eaf0' },

  pendingWarning: {
    padding: '12px 24px',
    background: 'rgba(196,136,58,0.1)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    color: '#c4883a',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  reasonForm: {
    padding: '16px 24px 20px 24px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  reasonLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#9499b0',
  },
  reasonSelect: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#e8eaf0',
    fontFamily: 'DM Sans, sans-serif',
    width: '100%',
    boxSizing: 'border-box',
  },
  reasonTextarea: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#e8eaf0',
    fontFamily: 'DM Sans, sans-serif',
    width: '100%',
    resize: 'vertical',
    minHeight: '70px',
    maxHeight: '120px',
    boxSizing: 'border-box',
  },
  reasonActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },

  dividerLight: {
    height: '1px',
    background: 'rgba(255,255,255,0.05)',
    margin: '12px 0',
  },
  cancelShiftBtnSecondary: {
    width: '100%',
    background: 'rgba(108,143,255,0.08)',
    border: '1px solid rgba(108,143,255,0.25)',
    color: '#6c8fff',
    padding: '12px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  approvedNote: {
    padding: '16px 24px',
    background: 'rgba(46,204,138,0.08)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    color: '#2ecc8a',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  warningNoteInline: {
    padding: '10px',
    background: 'rgba(196,136,58,0.08)',
    border: '1px solid rgba(196,136,58,0.2)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#c4883a',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    padding: '12px 24px 16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },

  lastPingInfo: {
    padding: '8px 24px',
    fontSize: '12px',
    color: '#9499b0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  pingLimitWarning: {
    padding: '12px 24px',
    background: 'rgba(232,92,61,0.08)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    fontSize: '12px',
    color: '#e85c3d',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  withdrawBtn: {
    flex: 1,
    background: 'rgba(232,92,61,0.1)',
    border: '1px solid rgba(232,92,61,0.25)',
    borderRadius: '8px',
    color: '#e85c3d',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  pingBtn: {
    flex: 1,
    background: 'rgba(108,143,255,0.12)',
    border: '1px solid rgba(108,143,255,0.3)',
    borderRadius: '8px',
    color: '#6c8fff',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  pingBtnDisabled: {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#5d6180',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'not-allowed',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  cancelShiftBtn: {
    width: '100%',
    background: 'rgba(232,92,61,0.1)',
    border: '1px solid rgba(232,92,61,0.25)',
    borderRadius: '8px',
    color: '#e85c3d',
    padding: '10px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '8px',
  },
  submitReasonBtn: {
    flex: 1,
    background: '#6c8fff',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  cancelReasonBtn: {
    flex: 1,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#9499b0',
    padding: '8px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
}

export default Calendar
