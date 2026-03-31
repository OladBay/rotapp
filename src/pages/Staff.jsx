import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/layout/Navbar'
import { mockUsers } from '../data/mockUsers'
import { mockLeave } from '../data/mockLeave'
import { mockStaff } from '../data/mockRota'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

const ROLE_LABELS = {
  manager: 'Manager',
  deputy: 'Deputy Manager',
  senior: 'Senior Carer',
  rcw: 'RCW',
  relief: 'Relief',
}

const STATUS_COLORS = {
  active: { bg: 'rgba(46,204,138,0.12)', color: '#2ecc8a' },
  pending: { bg: 'rgba(196,136,58,0.12)', color: '#c4883a' },
  off: { bg: 'rgba(108,143,255,0.12)', color: '#6c8fff' },
}

function Staff() {
  const { user } = useAuth()
  const [tab, setTab] = useState('all')
  const [leaveData, setLeaveData] = useState(mockLeave)
  const [leaveStaff, setLeaveStaff] = useState(null)
  const [leaveInput, setLeaveInput] = useState('')
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [approvedIds, setApprovedIds] = useState([])
  const [declinedIds, setDeclinedIds] = useState([])

  const homeStaff = mockUsers
    .filter(
      (u) =>
        u.home === user?.home &&
        !['manager', 'deputy', 'superadmin', 'operationallead'].includes(
          u.role
        ) &&
        !declinedIds.includes(u.id)
    )
    .map((u) => (approvedIds.includes(u.id) ? { ...u, status: 'active' } : u))

  const reliefPool = mockUsers.filter((u) => u.role === 'relief')

  const pending = homeStaff.filter((u) => u.status === 'pending')
  const active = homeStaff.filter((u) => u.status === 'active')
  const off = homeStaff.filter((u) => u.status === 'off')

  const displayed =
    tab === 'all'
      ? homeStaff
      : tab === 'active'
        ? active
        : tab === 'off'
          ? off
          : tab === 'pending'
            ? pending
            : reliefPool

  const handleApprove = (id) => {
    setApprovedIds((prev) => [...prev, id])
    setSelectedStaff(null)
  }

  const handleDecline = (id) => {
    setDeclinedIds((prev) => [...prev, id])
    setSelectedStaff(null)
  }

  return (
    <div style={s.page}>
      <Navbar />

      <div style={s.body}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Staff</h1>
            <p style={s.subtitle}>
              Meadowview House · {homeStaff.length} staff members
            </p>
          </div>
          <div style={s.headerActions}>
            {pending.length > 0 && (
              <div style={s.pendingBadge}>
                {pending.length} pending approval
              </div>
            )}
            <button style={s.primaryBtn}>+ Invite staff</button>
          </div>
        </div>

        {/* Summary stats */}
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statVal}>{homeStaff.length}</div>
            <div style={s.statLabel}>Total staff</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statVal, color: '#2ecc8a' }}>
              {active.length}
            </div>
            <div style={s.statLabel}>Active today</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statVal, color: '#6c8fff' }}>{off.length}</div>
            <div style={s.statLabel}>Off today</div>
          </div>
          <div style={s.statCard}>
            <div
              style={{
                ...s.statVal,
                color: pending.length > 0 ? '#c4883a' : '#e8eaf0',
              }}
            >
              {pending.length}
            </div>
            <div style={s.statLabel}>Pending</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statVal}>{reliefPool.length}</div>
            <div style={s.statLabel}>Relief pool</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          {[
            { key: 'all', label: `All (${homeStaff.length})` },
            { key: 'active', label: `Active (${active.length})` },
            { key: 'off', label: `Off (${off.length})` },
            { key: 'pending', label: `Pending (${pending.length})` },
            { key: 'relief', label: `Relief pool (${reliefPool.length})` },
            { key: 'leave', label: 'Leave & Absence' },
          ].map((t) => (
            <button
              key={t.key}
              style={{
                ...s.tabBtn,
                color: tab === t.key ? '#6c8fff' : '#9499b0',
                borderBottom:
                  tab === t.key ? '2px solid #6c8fff' : '2px solid transparent',
              }}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Staff list */}
        <div style={s.list}>
          {displayed.length === 0 && (
            <div style={s.empty}>No staff in this category</div>
          )}
          {displayed.map((member) => (
            <div
              key={member.id}
              style={{
                ...s.staffRow,
                background:
                  member.status === 'pending'
                    ? 'rgba(196,136,58,0.04)'
                    : '#161820',
                border:
                  member.status === 'pending'
                    ? '1px solid rgba(196,136,58,0.2)'
                    : '1px solid rgba(255,255,255,0.07)',
              }}
              onClick={() => setSelectedStaff(member)}
            >
              {/* Avatar */}
              <div
                style={{
                  ...s.avatar,
                  background:
                    member.gender === 'F'
                      ? 'rgba(122,79,168,0.2)'
                      : 'rgba(108,143,255,0.15)',
                  color: member.gender === 'F' ? '#7a4fa8' : '#6c8fff',
                }}
              >
                {member.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </div>

              {/* Info */}
              <div style={s.staffInfo}>
                <div style={s.staffName}>{member.name}</div>
                <div style={s.staffMeta}>
                  {ROLE_LABELS[member.role] || member.role}
                  {member.driver && ' · 🚗 Driver'}
                  {member.home === null && ' · Relief pool'}
                </div>
              </div>

              {/* Tags */}
              <div style={s.staffTags}>
                {member.gender && (
                  <span style={s.tag}>
                    {member.gender === 'F' ? 'Female' : 'Male'}
                  </span>
                )}
                <span
                  style={{
                    ...s.tag,
                    background: STATUS_COLORS[member.status]?.bg,
                    color: STATUS_COLORS[member.status]?.color,
                  }}
                >
                  {member.status}
                </span>
              </div>

              {/* Pending actions */}
              {member.status === 'pending' && (
                <div
                  style={s.pendingActions}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    style={s.approveBtn}
                    onClick={() => handleApprove(member.id)}
                  >
                    Approve
                  </button>
                  <button
                    style={s.declineBtn}
                    onClick={() => handleDecline(member.id)}
                  >
                    Decline
                  </button>
                </div>
              )}

              <div style={s.chevron}>›</div>
            </div>
          ))}
        </div>
        {/* Leave tab */}
        {tab === 'leave' && (
          <div style={s.leaveWrap}>
            <div style={s.leaveNote}>
              Mark staff as off for specific dates. These dates will
              automatically appear as unavailable in the rota generator.
            </div>

            {mockStaff
              .filter((st) => st.role !== 'relief')
              .map((staff) => {
                const dates = leaveData[staff.id] || []
                return (
                  <div key={staff.id} style={s.leaveRow}>
                    <div style={s.leaveStaffInfo}>
                      <div style={s.staffName}>{staff.name}</div>
                      <div style={s.staffRole}>{staff.roleCode}</div>
                    </div>

                    <div style={s.leaveDates}>
                      {dates.length === 0 ? (
                        <span style={s.noLeave}>No absences recorded</span>
                      ) : (
                        dates.map((d) => (
                          <span key={d} style={s.leaveTag}>
                            {d}
                            <button
                              style={s.removeLeave}
                              onClick={() => {
                                setLeaveData((prev) => ({
                                  ...prev,
                                  [staff.id]: (prev[staff.id] || []).filter(
                                    (x) => x !== d
                                  ),
                                }))
                              }}
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    <button
                      style={s.addLeaveBtn}
                      onClick={() => setLeaveStaff(staff)}
                    >
                      + Add dates
                    </button>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Staff profile modal */}
      {selectedStaff && (
        <div style={s.overlay} onClick={() => setSelectedStaff(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>Staff Profile</div>
              <button style={s.closeBtn} onClick={() => setSelectedStaff(null)}>
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>

            <div style={s.modalBody}>
              {/* Avatar + name */}
              <div style={s.profileTop}>
                <div
                  style={{
                    ...s.profileAvatar,
                    background:
                      selectedStaff.gender === 'F'
                        ? 'rgba(122,79,168,0.2)'
                        : 'rgba(108,143,255,0.15)',
                    color: selectedStaff.gender === 'F' ? '#7a4fa8' : '#6c8fff',
                  }}
                >
                  {selectedStaff.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <div style={s.profileName}>{selectedStaff.name}</div>
                  <div style={s.profileRole}>
                    {ROLE_LABELS[selectedStaff.role]}
                  </div>
                </div>
              </div>

              <div style={s.divider} />

              {/* Details */}
              {[
                { label: 'Email', val: selectedStaff.email },
                {
                  label: 'Gender',
                  val:
                    selectedStaff.gender === 'F'
                      ? 'Female'
                      : selectedStaff.gender === 'M'
                        ? 'Male'
                        : '—',
                },
                {
                  label: 'Driver',
                  val: selectedStaff.driver ? '✓ Yes' : '✗ No',
                },
                { label: 'Home', val: selectedStaff.home || 'Relief pool' },
                { label: 'Status', val: selectedStaff.status },
              ].map((row) => (
                <div key={row.label} style={s.detailRow}>
                  <span style={s.detailLabel}>{row.label}</span>
                  <span style={s.detailVal}>{row.val}</span>
                </div>
              ))}
            </div>

            {/* Pending actions inside modal */}
            {selectedStaff.status === 'pending' && (
              <div style={s.modalFooter}>
                <p style={s.modalNote}>
                  Approving will grant this staff member access and send them a
                  confirmation email.
                </p>
                <div style={s.modalActions}>
                  <button
                    style={s.declineBtn}
                    onClick={() => handleDecline(selectedStaff.id)}
                  >
                    Decline
                  </button>
                  <button
                    style={s.approveBtn}
                    onClick={() => handleApprove(selectedStaff.id)}
                  >
                    Approve & notify
                  </button>
                </div>
              </div>
            )}

            {/* Move staff action */}
            {selectedStaff.status === 'active' && (
              <div style={s.modalFooter}>
                <button style={s.moveBtn}>Move to another home →</button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Add leave modal */}
      {leaveStaff && (
        <div style={s.overlay} onClick={() => setLeaveStaff(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>Add Absence — {leaveStaff.name}</div>
              <button style={s.closeBtn} onClick={() => setLeaveStaff(null)}>
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div style={s.modalBody}>
              <p
                style={{
                  fontSize: '13px',
                  color: '#9499b0',
                  marginBottom: '16px',
                }}
              >
                Select dates this staff member is off. These will auto-fill as
                unavailable in the rota generator.
              </p>
              <div style={s.field}>
                <label style={s.detailLabel}>Date (YYYY-MM-DD)</label>
                <input
                  style={{ ...s.input, marginTop: '6px' }}
                  type='date'
                  value={leaveInput}
                  onChange={(e) => setLeaveInput(e.target.value)}
                />
              </div>
              {(leaveData[leaveStaff.id] || []).length > 0 && (
                <div style={{ marginTop: '14px' }}>
                  <div style={s.detailLabel}>Recorded absences</div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      marginTop: '8px',
                    }}
                  >
                    {(leaveData[leaveStaff.id] || []).map((d) => (
                      <span key={d} style={s.leaveTag}>
                        {d}
                        <button
                          style={s.removeLeave}
                          onClick={() => {
                            setLeaveData((prev) => ({
                              ...prev,
                              [leaveStaff.id]: (
                                prev[leaveStaff.id] || []
                              ).filter((x) => x !== d),
                            }))
                          }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end',
              }}
            >
              <button
                style={s.secondaryBtn}
                onClick={() => setLeaveStaff(null)}
              >
                Done
              </button>
              <button
                style={s.primaryBtn}
                onClick={() => {
                  if (!leaveInput) return
                  setLeaveData((prev) => ({
                    ...prev,
                    [leaveStaff.id]: [
                      ...new Set([...(prev[leaveStaff.id] || []), leaveInput]),
                    ],
                  }))
                  setLeaveInput('')
                }}
              >
                Add date
              </button>
            </div>
          </div>
        </div>
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
  body: { padding: '24px', maxWidth: '900px', margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  title: {
    fontFamily: 'Syne, sans-serif',
    fontSize: '22px',
    fontWeight: 600,
    margin: 0,
  },
  subtitle: { fontSize: '13px', color: '#9499b0', marginTop: '4px' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '10px' },
  pendingBadge: {
    background: 'rgba(196,136,58,0.15)',
    color: '#c4883a',
    border: '1px solid rgba(196,136,58,0.3)',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
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
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '10px',
    marginBottom: '20px',
  },
  statCard: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '14px',
  },
  statVal: {
    fontSize: '22px',
    fontWeight: 600,
    fontFamily: 'Syne, sans-serif',
    color: '#e8eaf0',
  },
  statLabel: { fontSize: '11px', color: '#9499b0', marginTop: '3px' },
  tabs: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    marginBottom: '16px',
  },
  tabBtn: {
    padding: '10px 14px',
    fontSize: '13px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    marginBottom: '-1px',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  empty: {
    textAlign: 'center',
    color: '#5d6180',
    padding: '40px',
    fontSize: '13px',
  },
  staffRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderRadius: '12px',
    padding: '14px 16px',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  avatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 600,
    flexShrink: 0,
    fontFamily: 'Syne, sans-serif',
  },
  staffInfo: { flex: 1, minWidth: 0 },
  staffName: { fontSize: '14px', fontWeight: 500, color: '#e8eaf0' },
  staffMeta: { fontSize: '12px', color: '#9499b0', marginTop: '2px' },
  staffTags: { display: 'flex', gap: '6px', flexShrink: 0 },
  tag: {
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '5px',
    background: 'rgba(255,255,255,0.06)',
    color: '#9499b0',
    fontWeight: 500,
  },
  pendingActions: { display: 'flex', gap: '6px', flexShrink: 0 },
  approveBtn: {
    background: 'rgba(46,204,138,0.12)',
    color: '#2ecc8a',
    border: '1px solid rgba(46,204,138,0.25)',
    borderRadius: '7px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  declineBtn: {
    background: 'rgba(232,92,61,0.1)',
    color: '#e85c3d',
    border: '1px solid rgba(232,92,61,0.25)',
    borderRadius: '7px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  chevron: { color: '#5d6180', fontSize: '18px', flexShrink: 0 },
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
    gap: '14px',
  },
  profileTop: { display: 'flex', alignItems: 'center', gap: '14px' },
  profileAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'Syne, sans-serif',
    flexShrink: 0,
  },
  profileName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e8eaf0',
    fontFamily: 'Syne, sans-serif',
  },
  profileRole: { fontSize: '13px', color: '#9499b0', marginTop: '2px' },
  divider: { height: '1px', background: 'rgba(255,255,255,0.07)' },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: { fontSize: '13px', color: '#9499b0' },
  detailVal: { fontSize: '13px', fontWeight: 500, color: '#e8eaf0' },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
  },
  modalNote: {
    fontSize: '12.5px',
    color: '#9499b0',
    marginBottom: '12px',
    lineHeight: 1.6,
  },
  modalActions: { display: 'flex', gap: '8px' },
  moveBtn: {
    width: '100%',
    background: 'transparent',
    color: '#6c8fff',
    border: '1px solid rgba(108,143,255,0.25)',
    borderRadius: '8px',
    padding: '10px',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  leaveWrap: { display: 'flex', flexDirection: 'column', gap: '10px' },
  leaveNote: {
    fontSize: '12.5px',
    color: '#9499b0',
    background: 'rgba(108,143,255,0.06)',
    border: '1px solid rgba(108,143,255,0.15)',
    borderRadius: '8px',
    padding: '10px 14px',
    marginBottom: '8px',
  },
  leaveRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '14px 16px',
  },
  leaveStaffInfo: { minWidth: '120px' },
  leaveDates: { flex: 1, display: 'flex', flexWrap: 'wrap', gap: '6px' },
  noLeave: { fontSize: '12px', color: '#5d6180' },
  leaveTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(232,92,61,0.1)',
    border: '1px solid rgba(232,92,61,0.25)',
    color: '#e85c3d',
    borderRadius: '6px',
    padding: '3px 8px',
    fontSize: '12px',
  },
  removeLeave: {
    background: 'transparent',
    border: 'none',
    color: '#e85c3d',
    cursor: 'pointer',
    fontSize: '11px',
    padding: '0',
    lineHeight: 1,
  },
  addLeaveBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '7px',
    color: '#9499b0',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    whiteSpace: 'nowrap',
  },
  input: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '11px 14px',
    fontSize: '14px',
    color: '#e8eaf0',
    outline: 'none',
    fontFamily: 'DM Sans, sans-serif',
    width: '100%',
  },
  field: { display: 'flex', flexDirection: 'column' },
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
}

export default Staff
