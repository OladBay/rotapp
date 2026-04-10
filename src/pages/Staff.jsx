import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRota } from '../context/RotaContext'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { supabase } from '../lib/supabase'
import InviteModal from '../components/shared/InviteModal'
import {
  getPendingRequests,
  getAllRequests,
  updateRequest,
  getPendingCancelCount,
} from '../utils/cancelRequests'
import {
  getTimeOffForStaff,
  addTimeOff,
  approveTimeOff,
  removeTimeOff,
  generateTimeOffId,
  getPendingTimeOffCount,
  removeStaffFromRotaOnLeave,
} from '../utils/timeOffStorage'
import LeaveCalendar from '../components/shared/LeaveCalendar'
import { fetchHomes } from '../utils/homesData'

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

const TYPE_LABELS = {
  annual_leave: 'Annual',
  sick: 'Sick',
  training: 'Training',
  other: 'Other',
}

const TYPE_STYLES = {
  annual_leave: {
    background: 'rgba(108,143,255,0.12)',
    color: '#6c8fff',
    border: '1px solid rgba(108,143,255,0.25)',
  },
  sick: {
    background: 'rgba(232,92,61,0.12)',
    color: '#e85c3d',
    border: '1px solid rgba(232,92,61,0.25)',
  },
  training: {
    background: 'rgba(46,204,138,0.12)',
    color: '#2ecc8a',
    border: '1px solid rgba(46,204,138,0.25)',
  },
  other: {
    background: 'rgba(148,153,176,0.12)',
    color: '#9499b0',
    border: '1px solid rgba(148,153,176,0.25)',
  },
}

const EXCLUDED_ROLES = ['superadmin', 'operationallead', 'relief']

function Staff() {
  const { user } = useAuth()
  const {
    timeOff,
    refreshTimeOff,
    cancelRequests,
    refreshCancels,
    refreshMonthRota,
  } = useRota()
  const navigate = useNavigate()

  const isOLorAdmin = ['operationallead', 'superadmin'].includes(
    user?.activeRole
  )

  // ── Staff state ──
  const [allStaff, setAllStaff] = useState([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [staffError, setStaffError] = useState('')
  const [staffRefresh, setStaffRefresh] = useState(0)
  const [homes, setHomes] = useState([])
  const [homeFilter, setHomeFilter] = useState('all')

  // ── UI state ──
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [tab, setTab] = useState('active')
  const [selectedStaff, setSelectedStaff] = useState(null)

  // ── Leave state ──
  const [leaveStaff, setLeaveStaff] = useState(null)
  const [leaveModalType, setLeaveModalType] = useState('annual_leave')
  const [leaveSelectedDates, setLeaveSelectedDates] = useState([])
  const [leaveNotes, setLeaveNotes] = useState('')
  const [selectedLeaveEntry, setSelectedLeaveEntry] = useState(null)

  // ── Cancel request state ──
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [managerNotes, setManagerNotes] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  // ── Swap state ──

  // ── Fetch homes ──
  useEffect(() => {
    if (!user) return
    fetchHomes(user.activeRole, user.home, user.org_id).then(setHomes)
  }, [user])

  // ── Fetch staff ──
  useEffect(() => {
    async function fetchStaff() {
      setStaffLoading(true)
      setStaffError('')
      try {
        let query = supabase
          .from('profiles')
          .select('*')
          .order('name', { ascending: true })
        if (!isOLorAdmin) {
          query = query.or(`home.eq.${user?.home},role.eq.relief`)
        }
        const { data, error } = await query
        if (error) throw error
        setAllStaff(data || [])
      } catch (err) {
        setStaffError('Failed to load staff. Please refresh.')
        console.error(err)
      } finally {
        setStaffLoading(false)
      }
    }
    fetchStaff()
  }, [staffRefresh, user?.home, isOLorAdmin])

  // ── Approve staff ──
  const handleApprove = async (staffMember) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'active' })
        .eq('id', staffMember.id)
      if (error) throw error
      await supabase.rpc('sync_auth_metadata', { user_id: staffMember.id })
      setStaffRefresh((n) => n + 1)
      setSelectedStaff(null)
    } catch (err) {
      console.error('Approve failed:', err)
    }
  }

  // ── Decline staff ──
  const handleDecline = async (staffMember) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'declined' })
        .eq('id', staffMember.id)
      if (error) throw error
      setStaffRefresh((n) => n + 1)
      setSelectedStaff(null)
    } catch (err) {
      console.error('Decline failed:', err)
    }
  }

  // ── Derived staff lists ──
  const visibleStaff =
    isOLorAdmin && homeFilter !== 'all'
      ? allStaff.filter((s) => s.home === homeFilter || s.role === 'relief')
      : allStaff

  const activeStaff = visibleStaff.filter(
    (s) => s.status === 'active' && !EXCLUDED_ROLES.includes(s.role)
  )
  const pendingStaff = visibleStaff.filter(
    (s) => s.status === 'pending' && !EXCLUDED_ROLES.includes(s.role)
  )
  const reliefStaff = allStaff.filter((s) => s.role === 'relief')

  const displayed =
    tab === 'active'
      ? activeStaff
      : tab === 'pending'
        ? pendingStaff
        : tab === 'relief'
          ? reliefStaff
          : visibleStaff

  const uniqueHomes = [...new Set(allStaff.map((s) => s.home).filter(Boolean))]

  // ── Derived context data ──

  const pendingCancels = getPendingRequests(cancelRequests)
  const allCancels = getAllRequests(cancelRequests)

  // ── Cancel request handlers ──
  const handleApproveRequest = async (request) => {
    await updateRequest(request.id, {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: user?.name,
      managerNotes: managerNotes || null,
    })
    refreshCancels()
    setSelectedRequest(null)
    setManagerNotes('')
  }

  const handleRejectRequest = async (request) => {
    await updateRequest(request.id, {
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      reviewedBy: user?.name,
      rejectionReason: rejectionReason || null,
      managerNotes: managerNotes || null,
    })
    refreshCancels()
    setSelectedRequest(null)
    setRejectionReason('')
    setManagerNotes('')
    setShowRejectModal(false)
  }

  // ── Swap handlers ──
  const handleApproveSwap = async (swap) => {
    try {
      await applySwapToRota(swap, user.org_id)
      await approveSwapRequest(swap.id, user?.name)
      refreshSwaps()
      refreshMonthRota()
      setSelectedSwap(null)
    } catch (err) {
      console.error('Approve swap failed:', err)
    }
  }

  const handleRejectSwap = async (swap) => {
    try {
      await rejectSwapRequest(swap.id, user?.name, swapRejectNote)
      refreshSwaps()
      setSelectedSwap(null)
      setSwapRejectNote('')
      setShowSwapRejectModal(false)
    } catch (err) {
      console.error('Reject swap failed:', err)
    }
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
              {isOLorAdmin
                ? `All homes · ${allStaff.length} staff members`
                : `${user?.home ? user.home.charAt(0).toUpperCase() + user.home.slice(1) : ''} · ${visibleStaff.filter((s) => s.status !== 'declined' && !EXCLUDED_ROLES.includes(s.role)).length} staff members`}
            </p>
          </div>
          <div style={s.headerActions}>
            <button
              style={s.inviteBtn}
              onClick={() => setShowInviteModal(true)}
            >
              <FontAwesomeIcon icon='envelope' /> Onboard staff
            </button>
          </div>
        </div>

        {/* OL home filter */}
        {isOLorAdmin && (
          <div style={s.homeFilterRow}>
            <button
              style={{
                ...s.homeFilterBtn,
                ...(homeFilter === 'all' ? s.homeFilterActive : {}),
              }}
              onClick={() => setHomeFilter('all')}
            >
              All homes
            </button>
            {uniqueHomes.map((h) => (
              <button
                key={h}
                style={{
                  ...s.homeFilterBtn,
                  ...(homeFilter === h ? s.homeFilterActive : {}),
                }}
                onClick={() => setHomeFilter(h)}
              >
                {h.charAt(0).toUpperCase() + h.slice(1)}
              </button>
            ))}
          </div>
        )}

        {staffLoading && <div style={s.empty}>Loading staff…</div>}
        {staffError && <div style={s.errorBanner}>{staffError}</div>}

        {/* Tabs */}
        {!staffLoading && (
          <div
            style={s.tabs}
            key={`tabs-${allStaff.length}-${pendingStaff.length}`}
          >
            {[
              { key: 'active', label: `Active (${activeStaff.length})` },
              {
                key: 'pending',
                label: `Pending (${pendingStaff.length})`,
                hasBadge: pendingStaff.length > 0,
                badgeCount: pendingStaff.length,
              },
              { key: 'relief', label: `Relief pool (${reliefStaff.length})` },
              {
                key: 'leave',
                label: 'Leave & Absence',
                hasBadge: getPendingTimeOffCount(timeOff) > 0,
                badgeCount: getPendingTimeOffCount(timeOff),
              },
              {
                key: 'requests',
                label: `Requests${pendingCancels.length > 0 ? ` (${pendingCancels.length})` : ''}`,
                hasBadge: pendingCancels.length > 0,
              },
            ].map((t) => (
              <button
                key={t.key}
                style={{
                  ...s.tabBtn,
                  color: tab === t.key ? '#6c8fff' : '#9499b0',
                  borderBottom:
                    tab === t.key
                      ? '2px solid #6c8fff'
                      : '2px solid transparent',
                }}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {t.hasBadge && <span style={s.tabBadge}>{t.badgeCount}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Staff list */}
        {!staffLoading &&
          tab !== 'leave' &&
          tab !== 'requests' &&
          tab !== 'swaps' && (
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
                        : 'var(--bg-card, #161820)',
                    border:
                      member.status === 'pending'
                        ? '1px solid rgba(196,136,58,0.2)'
                        : '1px solid rgba(255,255,255,0.07)',
                  }}
                  onClick={() => setSelectedStaff(member)}
                >
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
                      ? member.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                      : '?'}
                  </div>
                  <div style={s.staffInfo}>
                    <div style={s.staffName}>{member.name || '—'}</div>
                    <div style={s.staffMeta}>
                      {ROLE_LABELS[member.role] || member.role}
                      {member.driver && ' · Driver'}
                      {member.home === null && ' · Relief pool'}
                      {isOLorAdmin &&
                        member.home &&
                        ` · ${member.home.charAt(0).toUpperCase() + member.home.slice(1)}`}
                    </div>
                  </div>
                  <div style={s.staffTags}>
                    {member.gender && (
                      <span style={s.tag}>
                        {member.gender === 'F'
                          ? 'Female'
                          : member.gender === 'M'
                            ? 'Male'
                            : 'Other'}
                      </span>
                    )}
                    <span
                      style={{
                        ...s.tag,
                        background:
                          STATUS_COLORS[member.status]?.bg ||
                          'rgba(255,255,255,0.06)',
                        color: STATUS_COLORS[member.status]?.color || '#9499b0',
                      }}
                    >
                      {member.status}
                    </span>
                  </div>
                  {member.status === 'pending' && (
                    <div
                      style={s.pendingActions}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        style={s.approveBtn}
                        onClick={() => handleApprove(member)}
                      >
                        Approve
                      </button>
                      <button
                        style={s.declineBtn}
                        onClick={() => handleDecline(member)}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  <div style={s.chevron}>›</div>
                </div>
              ))}
            </div>
          )}

        {/* Leave tab */}
        {tab === 'leave' && (
          <div style={s.leaveWrap}>
            <div style={s.leaveNote}>
              Add and manage staff absences. Approved leave is automatically
              excluded from rota generation.
            </div>
            {allStaff
              .filter(
                (st) =>
                  !['relief', 'manager', 'deputy'].includes(st.role) &&
                  st.status === 'active'
              )
              .map((st) => {
                const entries = getTimeOffForStaff(timeOff, st.id)
                const approved = entries.filter((e) => e.status === 'approved')
                const pending = entries.filter((e) => e.status === 'pending')
                return (
                  <div key={st.id} style={s.leaveRow}>
                    <div style={s.leaveStaffInfo}>
                      <div style={s.staffName}>{st.name}</div>
                      <div style={s.staffRole}>
                        {ROLE_LABELS[st.role] || st.role}
                      </div>
                    </div>
                    <div style={s.leaveDates}>
                      {approved.length === 0 && pending.length === 0 ? (
                        <span style={s.noLeave}>No absences recorded</span>
                      ) : (
                        <>
                          {approved.map((entry) => (
                            <span
                              key={entry.id}
                              style={{
                                ...s.leaveTag,
                                ...TYPE_STYLES[entry.type],
                                cursor: 'pointer',
                              }}
                              onClick={() =>
                                setSelectedLeaveEntry({
                                  ...entry,
                                  staffName: st.name,
                                })
                              }
                            >
                              <span style={s.leaveTagLabel}>
                                {TYPE_LABELS[entry.type]}
                              </span>
                              <span style={s.leaveTagDate}>{entry.date}</span>
                              <button
                                style={s.removeLeave}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await removeTimeOff(entry.id)
                                  refreshTimeOff()
                                }}
                              >
                                <FontAwesomeIcon icon='xmark' />
                              </button>
                            </span>
                          ))}
                          {pending.map((entry) => (
                            <span
                              key={entry.id}
                              style={{
                                ...s.leaveTag,
                                background: 'rgba(196,136,58,0.12)',
                                color: '#c4883a',
                                border: '1px solid rgba(196,136,58,0.25)',
                                cursor: 'pointer',
                              }}
                              onClick={() =>
                                setSelectedLeaveEntry({
                                  ...entry,
                                  staffName: st.name,
                                })
                              }
                            >
                              <span style={s.leaveTagLabel}>
                                {TYPE_LABELS[entry.type]} · pending
                              </span>
                              <span style={s.leaveTagDate}>{entry.date}</span>
                              <button
                                style={s.approveLeaveBtn}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await approveTimeOff(entry.id, user?.name)
                                  await removeStaffFromRotaOnLeave(
                                    entry.staff_id,
                                    entry.date,
                                    user.home,
                                    user.org_id
                                  )
                                  refreshTimeOff()
                                  refreshMonthRota()
                                }}
                              >
                                <FontAwesomeIcon icon='check' />
                              </button>
                              <button
                                style={s.removeLeave}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await removeTimeOff(entry.id)
                                  refreshTimeOff()
                                }}
                              >
                                <FontAwesomeIcon icon='xmark' />
                              </button>
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                    <button
                      style={s.addLeaveBtn}
                      onClick={() => setLeaveStaff(st)}
                    >
                      <FontAwesomeIcon icon='plus' /> Add leave
                    </button>
                  </div>
                )
              })}
          </div>
        )}

        {/* Requests tab */}
        {tab === 'requests' && (
          <div style={s.requestsWrap}>
            {pendingCancels.length === 0 && allCancels.length === 0 ? (
              <div style={s.empty}>No cancellation requests</div>
            ) : (
              <>
                {pendingCancels.length > 0 && (
                  <>
                    <div style={s.sectionLabel}>Pending Requests</div>
                    {pendingCancels.map((request) => (
                      <div key={request.id} style={s.requestCard}>
                        <div style={s.requestHeader}>
                          <div style={s.requestStaff}>{request.staff_name}</div>
                          <div style={s.requestHeaderRight}>
                            {request.ping_count > 0 && (
                              <span style={s.pingBadge}>
                                <FontAwesomeIcon icon='bell' /> Pinged{' '}
                                {request.ping_count}x
                                {request.last_pinged_at &&
                                  ` · ${new Date(request.last_pinged_at).toLocaleDateString()}`}
                              </span>
                            )}
                            <div style={s.requestStatus}>pending</div>
                          </div>
                        </div>
                        <div style={s.requestDetails}>
                          <div>
                            <span
                              style={s.clickableDate}
                              onClick={() => {
                                navigate('/rota')
                                sessionStorage.setItem(
                                  'rota_jump_date',
                                  request.shift_date
                                )
                              }}
                            >
                              {request.shift_date}
                            </span>
                            <span style={{ color: '#5d6180' }}>
                              {' '}
                              · {request.shift_type} shift
                            </span>
                          </div>
                          <div>
                            Reason:{' '}
                            {request.reason === 'Other'
                              ? request.custom_reason
                              : request.reason}
                          </div>
                          <div style={s.requestTime}>
                            Requested:{' '}
                            {new Date(request.requested_at).toLocaleString()}
                          </div>
                        </div>
                        <div style={s.requestActions}>
                          <button
                            style={s.approveRequestBtn}
                            onClick={() => setSelectedRequest(request)}
                          >
                            <FontAwesomeIcon icon='check' /> Approve
                          </button>
                          <button
                            style={s.rejectRequestBtn}
                            onClick={() => {
                              setSelectedRequest(request)
                              setShowRejectModal(true)
                            }}
                          >
                            <FontAwesomeIcon icon='xmark' /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {allCancels.filter((r) => r.status !== 'pending').length >
                  0 && (
                  <>
                    <div style={{ ...s.sectionLabel, marginTop: '24px' }}>
                      History
                    </div>
                    {allCancels
                      .filter((r) => r.status !== 'pending')
                      .sort(
                        (a, b) =>
                          new Date(b.requested_at) - new Date(a.requested_at)
                      )
                      .map((request) => (
                        <div key={request.id} style={s.requestCardHistory}>
                          <div style={s.requestHeader}>
                            <div style={s.requestStaff}>
                              {request.staff_name}
                            </div>
                            <div
                              style={{
                                ...s.requestStatus,
                                background:
                                  request.status === 'approved'
                                    ? 'rgba(46,204,138,0.12)'
                                    : request.status === 'rejected'
                                      ? 'rgba(232,92,61,0.12)'
                                      : 'rgba(108,143,255,0.12)',
                                color:
                                  request.status === 'approved'
                                    ? '#2ecc8a'
                                    : request.status === 'rejected'
                                      ? '#e85c3d'
                                      : '#6c8fff',
                              }}
                            >
                              {request.status}
                            </div>
                          </div>
                          <div style={s.requestDetails}>
                            <div>
                              <span
                                style={s.clickableDate}
                                onClick={() => {
                                  navigate('/rota')
                                  sessionStorage.setItem(
                                    'rota_jump_date',
                                    request.shift_date
                                  )
                                }}
                              >
                                {request.shift_date}
                              </span>
                              <span style={{ color: '#5d6180' }}>
                                {' '}
                                · {request.shift_type} shift
                              </span>
                            </div>
                            <div>
                              Reason:{' '}
                              {request.reason === 'Other'
                                ? request.custom_reason
                                : request.reason}
                            </div>
                            {request.rejection_reason && (
                              <div
                                style={{
                                  color: '#e85c3d',
                                  fontSize: '12px',
                                }}
                              >
                                Rejection reason: {request.rejection_reason}
                              </div>
                            )}
                            {request.manager_notes && (
                              <div
                                style={{
                                  color: '#6c8fff',
                                  fontSize: '12px',
                                }}
                              >
                                Manager notes: {request.manager_notes}
                              </div>
                            )}
                            <div style={s.requestTime}>
                              Requested:{' '}
                              {new Date(request.requested_at).toLocaleString()}
                              {request.reviewed_at &&
                                ` · Reviewed: ${new Date(request.reviewed_at).toLocaleString()}`}
                            </div>
                          </div>
                        </div>
                      ))}
                  </>
                )}
              </>
            )}
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
                    ? selectedStaff.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                    : '?'}
                </div>
                <div>
                  <div style={s.profileName}>{selectedStaff.name}</div>
                  <div style={s.profileRole}>
                    {ROLE_LABELS[selectedStaff.role] || selectedStaff.role}
                  </div>
                </div>
              </div>
              <div style={s.divider} />
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
                {
                  label: 'Home',
                  val: selectedStaff.home || 'Relief pool',
                },
                { label: 'Status', val: selectedStaff.status },
                { label: 'Org', val: selectedStaff.org_id || '—' },
              ].map((row) => (
                <div key={row.label} style={s.detailRow}>
                  <span style={s.detailLabel}>{row.label}</span>
                  <span style={s.detailVal}>{row.val}</span>
                </div>
              ))}
            </div>
            {selectedStaff.status === 'pending' && (
              <div style={s.modalFooter}>
                <p style={s.modalNote}>
                  Approving will grant this staff member access immediately.
                </p>
                <div style={s.modalActions}>
                  <button
                    style={s.declineBtn}
                    onClick={() => handleDecline(selectedStaff)}
                  >
                    Decline
                  </button>
                  <button
                    style={s.approveBtn}
                    onClick={() => handleApprove(selectedStaff)}
                  >
                    Approve
                  </button>
                </div>
              </div>
            )}
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
        <div
          style={s.overlay}
          onClick={() => {
            setLeaveStaff(null)
            setLeaveSelectedDates([])
            setLeaveNotes('')
            setLeaveModalType('annual_leave')
          }}
        >
          <div
            style={{ ...s.modal, maxWidth: '460px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>Add Leave — {leaveStaff.name}</div>
              <button
                style={s.closeBtn}
                onClick={() => {
                  setLeaveStaff(null)
                  setLeaveSelectedDates([])
                  setLeaveNotes('')
                  setLeaveModalType('annual_leave')
                }}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div style={s.modalBody}>
              <LeaveCalendar
                staffId={leaveStaff.id}
                selectedDates={leaveSelectedDates}
                onSelectionChange={setLeaveSelectedDates}
              />
              <div style={s.field}>
                <label style={s.detailLabel}>Leave type</label>
                <select
                  style={{ ...s.input, marginTop: '6px' }}
                  value={leaveModalType}
                  onChange={(e) => setLeaveModalType(e.target.value)}
                >
                  <option value='annual_leave'>Annual leave</option>
                  <option value='sick'>Sick</option>
                  <option value='training'>Training</option>
                  <option value='other'>Other</option>
                </select>
              </div>
              <div style={s.field}>
                <label style={s.detailLabel}>Note (optional)</label>
                <input
                  style={{ ...s.input, marginTop: '6px' }}
                  type='text'
                  placeholder='e.g. holiday, hospital appointment'
                  value={leaveNotes}
                  onChange={(e) => setLeaveNotes(e.target.value)}
                />
              </div>
            </div>
            <div style={s.modalFooterRow}>
              <button
                style={s.secondaryBtn}
                onClick={() => {
                  setLeaveStaff(null)
                  setLeaveSelectedDates([])
                  setLeaveNotes('')
                  setLeaveModalType('annual_leave')
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  ...s.primaryBtn,
                  opacity: leaveSelectedDates.length > 0 ? 1 : 0.5,
                  cursor:
                    leaveSelectedDates.length > 0 ? 'pointer' : 'not-allowed',
                }}
                disabled={leaveSelectedDates.length === 0}
                onClick={async () => {
                  for (const dateStr of leaveSelectedDates) {
                    await addTimeOff(
                      {
                        id: generateTimeOffId(),
                        staffId: leaveStaff.id,
                        staffName: leaveStaff.name,
                        date: dateStr,
                        type: leaveModalType,
                        status: 'approved',
                        approvedBy: user?.name || 'Manager',
                        approvedAt: new Date().toISOString(),
                        notes: leaveNotes || null,
                      },
                      user.home,
                      user.org_id
                    )
                  }
                  refreshTimeOff()
                  setLeaveStaff(null)
                  setLeaveSelectedDates([])
                  setLeaveNotes('')
                  setLeaveModalType('annual_leave')
                }}
              >
                <FontAwesomeIcon icon='check' /> Confirm leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave detail modal */}
      {selectedLeaveEntry && (
        <div style={s.overlay} onClick={() => setSelectedLeaveEntry(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>Leave Details</div>
              <button
                style={s.closeBtn}
                onClick={() => setSelectedLeaveEntry(null)}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div style={s.modalBody}>
              {[
                { label: 'Staff', val: selectedLeaveEntry.staffName },
                {
                  label: 'Type',
                  val:
                    TYPE_LABELS[selectedLeaveEntry.type] ||
                    selectedLeaveEntry.type,
                },
                { label: 'Date', val: selectedLeaveEntry.date },
                { label: 'Status', val: selectedLeaveEntry.status },
                ...(selectedLeaveEntry.notes
                  ? [{ label: 'Note', val: selectedLeaveEntry.notes }]
                  : []),
                ...(selectedLeaveEntry.requested_at
                  ? [
                      {
                        label: 'Requested',
                        val: new Date(
                          selectedLeaveEntry.requested_at
                        ).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }),
                      },
                    ]
                  : []),
                ...(selectedLeaveEntry.approved_by
                  ? [
                      {
                        label: 'Approved by',
                        val: selectedLeaveEntry.approved_by,
                      },
                    ]
                  : []),
              ].map((row) => (
                <div key={row.label} style={s.detailRow}>
                  <span style={s.detailLabel}>{row.label}</span>
                  <span style={s.detailVal}>{row.val}</span>
                </div>
              ))}
              {selectedLeaveEntry.status === 'pending' && (
                <div style={{ ...s.modalActions, marginTop: '20px' }}>
                  <button
                    style={s.declineBtn}
                    onClick={async () => {
                      await removeTimeOff(selectedLeaveEntry.id)
                      refreshTimeOff()
                      setSelectedLeaveEntry(null)
                    }}
                  >
                    Decline
                  </button>
                  <button
                    style={s.approveBtn}
                    onClick={async () => {
                      await approveTimeOff(selectedLeaveEntry.id, user?.name)
                      await removeStaffFromRotaOnLeave(
                        selectedLeaveEntry.staff_id,
                        selectedLeaveEntry.date,
                        user.home,
                        user.org_id
                      )
                      refreshTimeOff()
                      refreshMonthRota()
                      setSelectedLeaveEntry(null)
                    }}
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approve cancel request modal */}
      {selectedRequest && !showRejectModal && (
        <div style={s.overlay} onClick={() => setSelectedRequest(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>Approve Cancellation</div>
              <button
                style={s.closeBtn}
                onClick={() => setSelectedRequest(null)}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div style={s.modalBody}>
              <div style={s.detailRow}>
                <span style={s.detailLabel}>Staff</span>
                <span style={s.detailVal}>{selectedRequest.staff_name}</span>
              </div>
              <div style={s.detailRow}>
                <span style={s.detailLabel}>Shift</span>
                <span style={s.detailVal}>
                  {selectedRequest.shift_date} · {selectedRequest.shift_type}
                </span>
              </div>
              <div style={s.detailRow}>
                <span style={s.detailLabel}>Reason</span>
                <span style={s.detailVal}>
                  {selectedRequest.reason === 'Other'
                    ? selectedRequest.custom_reason
                    : selectedRequest.reason}
                </span>
              </div>
              <div style={s.field}>
                <label style={s.detailLabel}>Notes to staff (optional)</label>
                <textarea
                  style={s.textarea}
                  placeholder='Add any notes for the staff member...'
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  rows='3'
                />
              </div>
              <div style={s.warningNote}>
                <FontAwesomeIcon icon='triangle-exclamation' /> Approving will
                remove this shift from the rota and create a gap.
              </div>
            </div>
            <div style={s.modalFooter}>
              <div style={s.modalButtonGroup}>
                <button
                  style={s.cancelModalBtn}
                  onClick={() => setSelectedRequest(null)}
                >
                  Cancel
                </button>
                <button
                  style={s.approveModalBtn}
                  onClick={() => handleApproveRequest(selectedRequest)}
                >
                  <FontAwesomeIcon icon='check' /> Approve & Remove Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject cancel request modal */}
      {showRejectModal && selectedRequest && (
        <div
          style={s.overlay}
          onClick={() => {
            setShowRejectModal(false)
            setSelectedRequest(null)
            setRejectionReason('')
            setManagerNotes('')
          }}
        >
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>Reject Cancellation</div>
              <button
                style={s.closeBtn}
                onClick={() => {
                  setShowRejectModal(false)
                  setSelectedRequest(null)
                  setRejectionReason('')
                  setManagerNotes('')
                }}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div style={s.modalBody}>
              <div style={s.detailRow}>
                <span style={s.detailLabel}>Staff</span>
                <span style={s.detailVal}>{selectedRequest.staff_name}</span>
              </div>
              <div style={s.detailRow}>
                <span style={s.detailLabel}>Shift</span>
                <span style={s.detailVal}>
                  {selectedRequest.shift_date} · {selectedRequest.shift_type}
                </span>
              </div>
              <div style={s.field}>
                <label style={s.detailLabel}>Rejection reason (optional)</label>
                <textarea
                  style={s.textarea}
                  placeholder='Why is this cancellation being rejected?'
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows='2'
                />
              </div>
              <div style={s.field}>
                <label style={s.detailLabel}>Notes to staff (optional)</label>
                <textarea
                  style={s.textarea}
                  placeholder='Add any additional notes...'
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  rows='2'
                />
              </div>
              <div style={s.warningNote}>
                <FontAwesomeIcon icon='triangle-exclamation' /> Rejecting means
                the shift remains in the rota.
              </div>
            </div>
            <div style={s.modalFooter}>
              <div style={s.modalButtonGroup}>
                <button
                  style={s.cancelModalBtn}
                  onClick={() => {
                    setShowRejectModal(false)
                    setSelectedRequest(null)
                    setRejectionReason('')
                    setManagerNotes('')
                  }}
                >
                  Cancel
                </button>
                <button
                  style={s.rejectModalBtn}
                  onClick={() => handleRejectRequest(selectedRequest)}
                >
                  <FontAwesomeIcon icon='xmark' /> Reject Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Onboard modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          defaultHomeId={user?.home}
          homes={homes}
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

  inviteBtn: {
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
  homeFilterRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  homeFilterBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    color: '#9499b0',
    padding: '5px 14px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  homeFilterActive: {
    background: 'rgba(108,143,255,0.12)',
    border: '1px solid rgba(108,143,255,0.3)',
    color: '#6c8fff',
  },

  errorBanner: {
    background: 'rgba(232,92,61,0.08)',
    border: '1px solid rgba(232,92,61,0.2)',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '13px',
    color: '#e85c3d',
    marginBottom: '16px',
  },
  tabs: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    marginBottom: '16px',
    flexWrap: 'wrap',
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
  tabBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '6px',
    background: '#e85c3d',
    color: '#fff',
    fontSize: '9px',
    fontWeight: 600,
    padding: '2px 5px',
    borderRadius: '10px',
    minWidth: '16px',
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
  staffRole: {
    fontSize: '11px',
    color: '#9499b0',
    fontFamily: 'DM Mono, monospace',
  },
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
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '20px',
    backdropFilter: 'blur(2px)',
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
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
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
    overflowY: 'auto',
    flex: 1,
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
    flexShrink: 0,
  },
  modalNote: {
    fontSize: '12.5px',
    color: '#9499b0',
    marginBottom: '12px',
    lineHeight: 1.6,
  },
  modalActions: { display: 'flex', gap: '8px' },
  modalFooterRow: {
    padding: '16px 24px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  modalButtonGroup: { display: 'flex', gap: '10px', width: '100%' },
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
  cancelModalBtn: {
    flex: 1,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color: '#9499b0',
    padding: '10px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
  },
  approveModalBtn: {
    flex: 1,
    background: '#2ecc8a',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    padding: '10px 12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  rejectModalBtn: {
    flex: 1,
    background: 'rgba(232,92,61,0.15)',
    border: '1px solid rgba(232,92,61,0.4)',
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
    flexWrap: 'wrap',
  },
  leaveStaffInfo: { minWidth: '120px' },
  leaveDates: { flex: 1, display: 'flex', flexWrap: 'wrap', gap: '6px' },
  noLeave: { fontSize: '12px', color: '#5d6180' },
  leaveTag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: '6px',
    padding: '3px 8px',
    fontSize: '12px',
  },
  leaveTagLabel: { fontWeight: 500, fontSize: '11px' },
  leaveTagDate: {
    fontSize: '11px',
    fontFamily: 'DM Mono, monospace',
    opacity: 0.8,
    marginLeft: '4px',
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
  approveLeaveBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#2ecc8a',
    padding: '0 2px',
    fontSize: '11px',
    marginLeft: '4px',
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
  textarea: {
    background: '#1d1f2b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '13px',
    color: '#e8eaf0',
    outline: 'none',
    fontFamily: 'DM Sans, sans-serif',
    width: '100%',
    resize: 'vertical',
    minHeight: '60px',
    maxHeight: '100px',
    boxSizing: 'border-box',
  },
  requestsWrap: { display: 'flex', flexDirection: 'column', gap: '16px' },
  sectionLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#5d6180',
    fontWeight: 500,
    marginBottom: '8px',
  },
  requestCard: {
    background: '#161820',
    border: '1px solid rgba(196,136,58,0.2)',
    borderRadius: '12px',
    padding: '16px',
  },
  requestCardHistory: {
    background: '#161820',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '16px',
  },
  requestHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  requestHeaderRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  requestStaff: { fontSize: '14px', fontWeight: 600, color: '#e8eaf0' },
  requestStatus: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: '5px',
    background: 'rgba(196,136,58,0.12)',
    color: '#c4883a',
    textTransform: 'uppercase',
  },
  requestDetails: {
    fontSize: '13px',
    color: '#9499b0',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '12px',
  },
  requestTime: { fontSize: '11px', color: '#5d6180', marginTop: '4px' },
  requestActions: { display: 'flex', gap: '8px' },
  approveRequestBtn: {
    flex: 1,
    background: 'rgba(46,204,138,0.12)',
    border: '1px solid rgba(46,204,138,0.25)',
    borderRadius: '8px',
    color: '#2ecc8a',
    padding: '8px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  rejectRequestBtn: {
    flex: 1,
    background: 'rgba(232,92,61,0.1)',
    border: '1px solid rgba(232,92,61,0.25)',
    borderRadius: '8px',
    color: '#e85c3d',
    padding: '8px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  warningNote: {
    marginTop: '8px',
    padding: '8px 10px',
    background: 'rgba(232,92,61,0.08)',
    border: '1px solid rgba(232,92,61,0.2)',
    borderRadius: '8px',
    fontSize: '11px',
    color: '#e85c3d',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  clickableDate: {
    color: '#6c8fff',
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationStyle: 'dotted',
    textUnderlineOffset: '2px',
  },
  pingBadge: {
    fontSize: '10px',
    padding: '3px 8px',
    borderRadius: '5px',
    background: 'rgba(39,45,65,0.12)',
    color: '#6c8fff',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  swapShiftRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '6px',
  },
  swapShiftPill: {
    fontSize: '12px',
    fontWeight: 500,
    padding: '4px 10px',
    borderRadius: '6px',
    fontFamily: 'DM Mono, monospace',
  },
  sameDayPill: {
    fontSize: '10px',
    color: '#6c8fff',
    background: 'rgba(108,143,255,0.12)',
    border: '1px solid rgba(108,143,255,0.25)',
    borderRadius: '4px',
    padding: '1px 5px',
    marginLeft: '4px',
    fontFamily: 'DM Sans, sans-serif',
  },
  swapWarnRow: {
    fontSize: '12px',
    color: '#c4883a',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '4px',
  },
}

export default Staff
