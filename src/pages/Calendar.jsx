import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import { mockShifts, staffIdMap } from '../data/mockCalendar'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

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
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelledShifts, setCancelledShifts] = useState([])

  const staffId = staffIdMap[user?.email]
  const myShifts = staffId ? mockShifts[staffId] || [] : []

  const getShiftForDay = (date) =>
    myShifts.find((s) => s.date === date && !cancelledShifts.includes(s.date))

  const handleCancel = (shift) => {
    setCancelledShifts((prev) => [...prev, shift.date])
    setSelectedShift(null)
    setCancelConfirm(false)
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
                ) : shift ? (
                  <div
                    style={{
                      ...s.shiftCard,
                      background:
                        shift.type === 'early'
                          ? 'rgba(42,127,98,0.15)'
                          : 'rgba(122,79,168,0.15)',
                      border:
                        shift.type === 'early'
                          ? '1px solid rgba(42,127,98,0.35)'
                          : '1px solid rgba(122,79,168,0.35)',
                    }}
                  >
                    <div
                      style={{
                        ...s.shiftType,
                        color: shift.type === 'early' ? '#2a7f62' : '#7a4fa8',
                      }}
                    >
                      {shift.type === 'early' ? 'Early' : 'Late'}
                      {shift.sleepIn && ' · 💤 Sleep-in'}
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
              setCancelConfirm(false)
            }}
          >
            <div style={s.modal} onClick={(e) => e.stopPropagation()}>
              <div style={s.modalHeader}>
                <div style={s.modalTitle}>Shift Details</div>
                <button
                  style={s.closeBtn}
                  onClick={() => {
                    setSelectedShift(null)
                    setCancelConfirm(false)
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
                  <span style={{ ...s.detailVal, color: '#2ecc8a' }}>
                    ✓ Confirmed
                  </span>
                </div>
              </div>

              {!cancelConfirm ? (
                <button
                  style={s.cancelShiftBtn}
                  onClick={() => setCancelConfirm(true)}
                >
                  Cancel this shift
                </button>
              ) : (
                <div style={s.confirmBox}>
                  <p style={s.confirmText}>
                    Are you sure? Your manager will be notified and this shift
                    will need to be filled.
                  </p>
                  <div style={s.confirmActions}>
                    <button
                      style={s.confirmNo}
                      onClick={() => setCancelConfirm(false)}
                    >
                      Keep shift
                    </button>
                    <button
                      style={s.confirmYes}
                      onClick={() => handleCancel(selectedShift)}
                    >
                      Yes, cancel it
                    </button>
                  </div>
                </div>
              )}
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
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: { fontSize: '13px', color: '#9499b0' },
  detailVal: { fontSize: '13px', fontWeight: 500, color: '#e8eaf0' },
  cancelShiftBtn: {
    width: '100%',
    background: 'rgba(232,92,61,0.1)',
    border: '1px solid rgba(232,92,61,0.25)',
    color: '#e85c3d',
    padding: '12px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  confirmBox: {
    padding: '16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  confirmText: {
    fontSize: '13px',
    color: '#9499b0',
    marginBottom: '12px',
    lineHeight: 1.5,
  },
  confirmActions: { display: 'flex', gap: '8px' },
  confirmNo: {
    flex: 1,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#9499b0',
    padding: '9px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  confirmYes: {
    flex: 1,
    background: 'rgba(232,92,61,0.15)',
    border: '1px solid rgba(232,92,61,0.3)',
    borderRadius: '8px',
    color: '#e85c3d',
    padding: '9px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
}

export default Calendar
