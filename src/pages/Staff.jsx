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
} from '../utils/timeOffStorage'
import { removeStaffFromShift } from '../utils/rotaMutations'
import LeaveCalendar from '../components/shared/LeaveCalendar'
import { fetchHomes } from '../utils/homesData'
import styles from './Staff.module.css'

const ROLE_LABELS = {
  manager: 'Manager',
  deputy: 'Deputy Manager',
  senior: 'Senior Carer',
  rcw: 'RCW',
  relief: 'Relief',
}

const STATUS_COLORS = {
  active: { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  pending: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  off: { bg: 'var(--accent-bg)', color: 'var(--accent)' },
}

const TYPE_LABELS = {
  annual_leave: 'Annual',
  sick: 'Sick',
  training: 'Training',
  other: 'Other',
}

const TYPE_STYLES = {
  annual_leave: {
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    border: '1px solid var(--accent-border)',
  },
  sick: {
    background: 'var(--color-danger-bg)',
    color: 'var(--color-danger)',
    border: '1px solid var(--color-danger-border)',
  },
  training: {
    background: 'var(--color-success-bg)',
    color: 'var(--color-success)',
    border: '1px solid var(--color-success-border)',
  },
  other: {
    background: 'var(--bg-active)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-default)',
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
    homeName,
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
  const [isTabsPinned, setIsTabsPinned] = useState(() => {
    try {
      return localStorage.getItem('rotapp_staff_tabs_pinned') === 'true'
    } catch {
      return false
    }
  })

  const toggleTabsPin = () => {
    const newValue = !isTabsPinned
    setIsTabsPinned(newValue)
    localStorage.setItem('rotapp_staff_tabs_pinned', String(newValue))
  }

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
          .eq('org_id', user?.org_id)
          .neq('status', 'declined')
          .order('name', { ascending: true })

        // OL/admin with no home set — fetch all org staff
        // OL stepped into a home (user.home set) — scope to that home + relief
        // Manager/deputy/senior — scope to their home + relief
        if (user?.home) {
          query = query.or(`home.eq.${user.home},role.eq.relief`)
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
  }, [staffRefresh, user?.home, user?.org_id, isOLorAdmin])

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

  const uniqueHomes = homes

  // ── Derived context data ──
  const pendingCancels = getPendingRequests(cancelRequests)
  const allCancels = getAllRequests(cancelRequests)

  // ── Cancel request handlers ──
  const handleApproveRequest = async (request) => {
    try {
      await updateRequest(request.id, {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        reviewedBy: user?.name,
        managerNotes: managerNotes || null,
      })
      await removeStaffFromShift(
        request.staff_id,
        request.shift_date,
        user.home,
        user.org_id,
        { fromLeave: false }
      )
      refreshCancels()
      refreshMonthRota()
      setSelectedRequest(null)
      setManagerNotes('')
    } catch (err) {
      console.error('Approve cancellation failed:', err)
    }
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

  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.body}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Staff</h1>

            <p className={styles.subtitle}>
              {isOLorAdmin && !user?.home
                ? `All homes · ${allStaff.length} staff members`
                : `${homeName || '—'} · ${visibleStaff.filter((s) => s.status !== 'declined' && !EXCLUDED_ROLES.includes(s.role)).length} staff members`}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.inviteBtn}
              onClick={() => setShowInviteModal(true)}
            >
              <FontAwesomeIcon icon='envelope' /> Onboard staff
            </button>
          </div>
        </div>

        {/* OL home filter */}
        {isOLorAdmin && (
          <div className={styles.homeFilterRow}>
            <button
              className={`${styles.homeFilterBtn}${homeFilter === 'all' ? ` ${styles.homeFilterBtnActive}` : ''}`}
              onClick={() => setHomeFilter('all')}
            >
              All homes
            </button>
            {uniqueHomes.map((home) => (
              <button
                key={home.id}
                className={`${styles.homeFilterBtn}${homeFilter === home.id ? ` ${styles.homeFilterBtnActive}` : ''}`}
                onClick={() => setHomeFilter(home.id)}
              >
                {home.name}
              </button>
            ))}
          </div>
        )}

        {staffLoading && <div className={styles.empty}>Loading staff…</div>}
        {staffError && <div className={styles.errorBanner}>{staffError}</div>}

        {/* Tabs */}
        {!staffLoading && (
          <div
            className={`${styles.tabsBar}${isTabsPinned ? ` ${styles.tabsBarPinned}` : ''}`}
          >
            <div
              className={styles.tabs}
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
                  label: `Cancellations${pendingCancels.length > 0 ? ` (${pendingCancels.length})` : ''}`,
                  hasBadge: pendingCancels.length > 0,
                  badgeCount: pendingCancels.length,
                },
              ].map((t) => (
                <button
                  key={t.key}
                  className={`${styles.tabBtn}${tab === t.key ? ` ${styles.tabBtnActive}` : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                  {t.hasBadge && (
                    <span className={styles.tabBadge}>{t.badgeCount}</span>
                  )}
                </button>
              ))}
            </div>
            <button
              className={`${styles.tabsPinBtn}${isTabsPinned ? ` ${styles.tabsPinBtnActive}` : ''}`}
              onClick={toggleTabsPin}
              title={
                isTabsPinned ? 'Unpin tabs' : 'Pin tabs (stays while scrolling)'
              }
            >
              <FontAwesomeIcon icon='thumbtack' />
            </button>
          </div>
        )}

        {/* Staff list */}
        {!staffLoading && tab !== 'leave' && tab !== 'requests' && (
          <div className={styles.list}>
            {displayed.length === 0 && (
              <div className={styles.empty}>No staff in this category</div>
            )}
            {displayed.map((member) => (
              <div
                key={member.id}
                className={`${styles.staffRow} ${member.status === 'pending' ? styles.staffRowPending : styles.staffRowDefault}`}
                onClick={() => setSelectedStaff(member)}
              >
                <div
                  className={styles.avatar}
                  style={{
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
                <div className={styles.staffInfo}>
                  <div className={styles.staffName}>{member.name || '—'}</div>
                  <div className={styles.staffMeta}>
                    {ROLE_LABELS[member.role] || member.role}
                    {member.driver && ' · Driver'}
                    {member.home === null && ' · Relief pool'}
                    {isOLorAdmin &&
                      member.home &&
                      ` · ${member.home.charAt(0).toUpperCase() + member.home.slice(1)}`}
                  </div>
                </div>
                <div className={styles.staffTags}>
                  {member.gender && (
                    <span className={styles.tag}>
                      {member.gender === 'F'
                        ? 'Female'
                        : member.gender === 'M'
                          ? 'Male'
                          : 'Other'}
                    </span>
                  )}
                  <span
                    className={styles.tag}
                    style={{
                      background:
                        STATUS_COLORS[member.status]?.bg || 'var(--bg-active)',
                      color:
                        STATUS_COLORS[member.status]?.color ||
                        'var(--text-secondary)',
                    }}
                  >
                    {member.status}
                  </span>
                </div>
                {member.status === 'pending' && (
                  <div
                    className={styles.pendingActions}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className={styles.approveBtn}
                      onClick={() => handleApprove(member)}
                    >
                      Approve
                    </button>
                    <button
                      className={styles.declineBtn}
                      onClick={() => handleDecline(member)}
                    >
                      Decline
                    </button>
                  </div>
                )}
                <div className={styles.chevron}>›</div>
              </div>
            ))}
          </div>
        )}

        {/* Leave tab */}
        {tab === 'leave' && (
          <div className={styles.leaveWrap}>
            <div className={styles.leaveNote}>
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
                  <div key={st.id} className={styles.leaveRow}>
                    <div className={styles.leaveStaffInfo}>
                      <div className={styles.staffName}>{st.name}</div>
                      <div className={styles.staffRole}>
                        {ROLE_LABELS[st.role] || st.role}
                      </div>
                    </div>
                    <div className={styles.leaveDates}>
                      {approved.length === 0 && pending.length === 0 ? (
                        <span className={styles.noLeave}>
                          No absences recorded
                        </span>
                      ) : (
                        <>
                          {approved.map((entry) => (
                            <span
                              key={entry.id}
                              className={styles.leaveTag}
                              style={{
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
                              <span className={styles.leaveTagLabel}>
                                {TYPE_LABELS[entry.type]}
                              </span>
                              <span className={styles.leaveTagDate}>
                                {entry.date}
                              </span>
                              <button
                                className={styles.removeLeave}
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
                              className={styles.leaveTag}
                              style={{
                                background: 'var(--color-warning-bg)',
                                color: 'var(--color-warning)',
                                border: '1px solid var(--color-warning-border)',
                                cursor: 'pointer',
                              }}
                              onClick={() =>
                                setSelectedLeaveEntry({
                                  ...entry,
                                  staffName: st.name,
                                })
                              }
                            >
                              <span className={styles.leaveTagLabel}>
                                {TYPE_LABELS[entry.type]} · pending
                              </span>
                              <span className={styles.leaveTagDate}>
                                {entry.date}
                              </span>
                              <button
                                className={styles.approveLeaveBtn}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await approveTimeOff(entry.id, user?.name)
                                  await removeStaffFromShift(
                                    entry.staff_id,
                                    entry.date,
                                    user.home,
                                    user.org_id,
                                    { fromLeave: true }
                                  )
                                  refreshTimeOff()
                                  refreshMonthRota()
                                }}
                              >
                                <FontAwesomeIcon icon='check' />
                              </button>
                              <button
                                className={styles.removeLeave}
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
                      className={styles.addLeaveBtn}
                      onClick={() => setLeaveStaff(st)}
                    >
                      <FontAwesomeIcon icon='plus' /> Add leave
                    </button>
                  </div>
                )
              })}
          </div>
        )}

        {/* Cancellations tab */}
        {tab === 'requests' && (
          <div className={styles.requestsWrap}>
            {pendingCancels.length === 0 && allCancels.length === 0 ? (
              <div className={styles.empty}>No cancellation requests</div>
            ) : (
              <>
                {pendingCancels.length > 0 && (
                  <>
                    <div className={styles.sectionLabel}>Pending Requests</div>
                    {pendingCancels.map((request) => (
                      <div key={request.id} className={styles.requestCard}>
                        <div className={styles.requestHeader}>
                          <div className={styles.requestStaff}>
                            {request.staff_name}
                          </div>
                          <div className={styles.requestHeaderRight}>
                            {request.ping_count > 0 && (
                              <span className={styles.pingBadge}>
                                <FontAwesomeIcon icon='bell' /> Pinged{' '}
                                {request.ping_count}x
                                {request.last_pinged_at &&
                                  ` · ${new Date(request.last_pinged_at).toLocaleDateString()}`}
                              </span>
                            )}
                            <div className={styles.requestStatus}>pending</div>
                          </div>
                        </div>
                        <div className={styles.requestDetails}>
                          <div>
                            <span
                              className={styles.clickableDate}
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
                            <span style={{ color: 'var(--text-muted)' }}>
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
                          {request.notes && (
                            <div className={styles.requestNote}>
                              <span className={styles.requestNoteLabel}>
                                Note:
                              </span>
                              {request.notes}
                            </div>
                          )}
                          <div className={styles.requestTime}>
                            Requested:{' '}
                            {new Date(request.requested_at).toLocaleString()}
                          </div>
                        </div>
                        <div className={styles.requestActions}>
                          <button
                            className={styles.approveRequestBtn}
                            onClick={() => setSelectedRequest(request)}
                          >
                            <FontAwesomeIcon icon='check' /> Approve
                          </button>
                          <button
                            className={styles.rejectRequestBtn}
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
                    <div
                      className={styles.sectionLabel}
                      style={{ marginTop: '24px' }}
                    >
                      History
                    </div>
                    {allCancels
                      .filter((r) => r.status !== 'pending')
                      .sort(
                        (a, b) =>
                          new Date(b.requested_at) - new Date(a.requested_at)
                      )
                      .map((request) => (
                        <div
                          key={request.id}
                          className={styles.requestCardHistory}
                        >
                          <div className={styles.requestHeader}>
                            <div className={styles.requestStaff}>
                              {request.staff_name}
                            </div>
                            <div
                              className={styles.requestStatus}
                              style={{
                                background:
                                  request.status === 'approved'
                                    ? 'var(--color-success-bg)'
                                    : request.status === 'rejected'
                                      ? 'var(--color-danger-bg)'
                                      : request.status === 'superseded'
                                        ? 'var(--bg-active)'
                                        : 'var(--accent-bg)',
                                color:
                                  request.status === 'approved'
                                    ? 'var(--color-success)'
                                    : request.status === 'rejected'
                                      ? 'var(--color-danger)'
                                      : request.status === 'superseded'
                                        ? 'var(--text-secondary)'
                                        : 'var(--accent)',
                              }}
                            >
                              {request.status}
                            </div>
                          </div>
                          <div className={styles.requestDetails}>
                            <div>
                              <span
                                className={styles.clickableDate}
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
                              <span style={{ color: 'var(--text-muted)' }}>
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
                            {request.notes && (
                              <div className={styles.requestNote}>
                                <span className={styles.requestNoteLabel}>
                                  Note:
                                </span>
                                {request.notes}
                              </div>
                            )}
                            {request.rejection_reason && (
                              <div
                                style={{
                                  color: 'var(--color-danger)',
                                  fontSize: '12px',
                                }}
                              >
                                Rejection reason: {request.rejection_reason}
                              </div>
                            )}
                            {request.manager_notes && (
                              <div
                                style={{
                                  color: 'var(--accent)',
                                  fontSize: '12px',
                                }}
                              >
                                Manager notes: {request.manager_notes}
                              </div>
                            )}
                            <div className={styles.requestTime}>
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
        <div className={styles.overlay} onClick={() => setSelectedStaff(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Staff Profile</div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedStaff(null)}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.profileTop}>
                <div
                  className={styles.profileAvatar}
                  style={{
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
                  <div className={styles.profileName}>{selectedStaff.name}</div>
                  <div className={styles.profileRole}>
                    {ROLE_LABELS[selectedStaff.role] || selectedStaff.role}
                  </div>
                </div>
              </div>
              <div className={styles.divider} />
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
                { label: 'Org', val: selectedStaff.org_id || '—' },
              ].map((row) => (
                <div key={row.label} className={styles.detailRow}>
                  <span className={styles.detailLabel}>{row.label}</span>
                  <span className={styles.detailVal}>{row.val}</span>
                </div>
              ))}
            </div>
            {selectedStaff.status === 'pending' && (
              <div className={styles.modalFooter}>
                <p className={styles.modalNote}>
                  Approving will grant this staff member access immediately.
                </p>
                <div className={styles.modalActions}>
                  <button
                    className={styles.declineBtn}
                    onClick={() => handleDecline(selectedStaff)}
                  >
                    Decline
                  </button>
                  <button
                    className={styles.approveBtn}
                    onClick={() => handleApprove(selectedStaff)}
                  >
                    Approve
                  </button>
                </div>
              </div>
            )}
            {selectedStaff.status === 'active' && (
              <div className={styles.modalFooter}>
                <button className={styles.moveBtn}>
                  Move to another home →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add leave modal */}
      {leaveStaff && (
        <div
          className={styles.overlay}
          onClick={() => {
            setLeaveStaff(null)
            setLeaveSelectedDates([])
            setLeaveNotes('')
            setLeaveModalType('annual_leave')
          }}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: '460px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                Add Leave — {leaveStaff.name}
              </div>
              <button
                className={styles.closeBtn}
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
            <div className={styles.modalBody}>
              <LeaveCalendar
                staffId={leaveStaff.id}
                selectedDates={leaveSelectedDates}
                onSelectionChange={setLeaveSelectedDates}
              />
              <div className={styles.field}>
                <label className={styles.detailLabel}>Leave type</label>
                <select
                  className={styles.input}
                  value={leaveModalType}
                  onChange={(e) => setLeaveModalType(e.target.value)}
                >
                  <option value='annual_leave'>Annual leave</option>
                  <option value='sick'>Sick</option>
                  <option value='training'>Training</option>
                  <option value='other'>Other</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.detailLabel}>Note (optional)</label>
                <input
                  className={styles.input}
                  type='text'
                  placeholder='e.g. holiday, hospital appointment'
                  value={leaveNotes}
                  onChange={(e) => setLeaveNotes(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.modalFooterRow}>
              <button
                className={styles.cancelModalBtn}
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
                className={styles.approveModalBtn}
                style={{
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
                  refreshMonthRota()
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
        <div
          className={styles.overlay}
          onClick={() => setSelectedLeaveEntry(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Leave Details</div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedLeaveEntry(null)}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div className={styles.modalBody}>
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
                <div key={row.label} className={styles.detailRow}>
                  <span className={styles.detailLabel}>{row.label}</span>
                  <span className={styles.detailVal}>{row.val}</span>
                </div>
              ))}
              {selectedLeaveEntry.status === 'pending' && (
                <div
                  className={styles.modalActions}
                  style={{ marginTop: '20px' }}
                >
                  <button
                    className={styles.declineBtn}
                    onClick={async () => {
                      await removeTimeOff(selectedLeaveEntry.id)
                      refreshTimeOff()
                      setSelectedLeaveEntry(null)
                    }}
                  >
                    Decline
                  </button>
                  <button
                    className={styles.approveBtn}
                    onClick={async () => {
                      await approveTimeOff(selectedLeaveEntry.id, user?.name)
                      await removeStaffFromShift(
                        selectedLeaveEntry.staff_id,
                        selectedLeaveEntry.date,
                        user.home,
                        user.org_id,
                        { fromLeave: true }
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
        <div
          className={styles.overlay}
          onClick={() => setSelectedRequest(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Approve Cancellation</div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedRequest(null)}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Staff</span>
                <span className={styles.detailVal}>
                  {selectedRequest.staff_name}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Shift</span>
                <span className={styles.detailVal}>
                  {selectedRequest.shift_date} · {selectedRequest.shift_type}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Reason</span>
                <span className={styles.detailVal}>
                  {selectedRequest.reason === 'Other'
                    ? selectedRequest.custom_reason
                    : selectedRequest.reason}
                </span>
              </div>
              {selectedRequest.notes && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Staff note</span>
                  <span className={styles.detailValMuted}>
                    {selectedRequest.notes}
                  </span>
                </div>
              )}
              <div className={styles.field}>
                <label className={styles.detailLabel}>
                  Notes to staff (optional)
                </label>
                <textarea
                  className={styles.textarea}
                  placeholder='Add any notes for the staff member...'
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  rows='3'
                />
              </div>
              <div className={styles.warningNote}>
                <FontAwesomeIcon icon='triangle-exclamation' /> Approving will
                remove this shift from the rota and create a gap.
              </div>
            </div>
            <div className={styles.modalFooter}>
              <div className={styles.modalButtonGroup}>
                <button
                  className={styles.cancelModalBtn}
                  onClick={() => setSelectedRequest(null)}
                >
                  Cancel
                </button>
                <button
                  className={styles.approveModalBtn}
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
          className={styles.overlay}
          onClick={() => {
            setShowRejectModal(false)
            setSelectedRequest(null)
            setRejectionReason('')
            setManagerNotes('')
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Reject Cancellation</div>
              <button
                className={styles.closeBtn}
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
            <div className={styles.modalBody}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Staff</span>
                <span className={styles.detailVal}>
                  {selectedRequest.staff_name}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Shift</span>
                <span className={styles.detailVal}>
                  {selectedRequest.shift_date} · {selectedRequest.shift_type}
                </span>
              </div>
              <div className={styles.field}>
                <label className={styles.detailLabel}>
                  Rejection reason (optional)
                </label>
                <textarea
                  className={styles.textarea}
                  placeholder='Why is this cancellation being rejected?'
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows='2'
                />
              </div>
              <div className={styles.field}>
                <label className={styles.detailLabel}>
                  Notes to staff (optional)
                </label>
                <textarea
                  className={styles.textarea}
                  placeholder='Add any additional notes...'
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  rows='2'
                />
              </div>
              <div className={styles.warningNote}>
                <FontAwesomeIcon icon='triangle-exclamation' /> Rejecting means
                the shift remains in the rota.
              </div>
            </div>
            <div className={styles.modalFooter}>
              <div className={styles.modalButtonGroup}>
                <button
                  className={styles.cancelModalBtn}
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
                  className={styles.rejectModalBtn}
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

export default Staff
