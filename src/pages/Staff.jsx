import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRota } from '../context/RotaContext'
import { useNavigate } from 'react-router-dom'
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
  createLeaveRequest,
  reviewLeaveRequest,
  getPendingRequestCount,
  getLeaveDaysForStaff,
} from '../utils/timeOffStorage'
import { removeStaffFromShift } from '../utils/rotaMutations'
import {
  createRequest,
  createAndExecute,
  acceptRequest,
  rejectRequest,
  cancelRequest,
} from '../utils/staffMoves'
import {
  notifyTransferIncoming,
  notifyTransferAccepted,
  notifyTransferRejected,
  notifyTransferCancelled,
  notifyTransferExecutedOL,
  notifyTransferOutgoing,
  markManyAsRead,
  markReferenceAsRead,
  getUnreadCountByTypes,
  fetchHomeManager,
  NOTIFICATION_TYPES,
  NOTIFICATION_READ_BEHAVIOUR,
} from '../utils/notifications'
import LeaveCalendar from '../components/shared/LeaveCalendar'
import { fetchHomes } from '../utils/homesData'
import { useTopBarInit } from '../hooks/useTopBarInit'
import styles from './Staff.module.css'

// ── Constants ──────────────────────────────────────────────────────
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
  annual_leave: 'Annual leave',
  sick: 'Sick',
  training: 'Training',
  other: 'Other',
}

const EXCLUDED_ROLES = ['superadmin', 'operationallead', 'relief']

const TRANSFERS_VIEW_TYPES = Object.entries(NOTIFICATION_READ_BEHAVIOUR)
  .filter(([, behaviour]) => behaviour === 'view')
  .map(([type]) => type)

// ── Staff page ─────────────────────────────────────────────────────
function Staff() {
  const { user } = useAuth()
  const {
    leaveRequests,
    leaveDays,
    refreshLeave,
    cancelRequests,
    refreshCancels,
    refreshMonthRota,
    homeName,
    homes: orgHomes,
    moveRecords,
    refreshMoveRecords,
    notifications,
    refreshNotifications,
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
  const [isTabsPinned, setIsTabsPinned] = useState(() => {
    try {
      return localStorage.getItem('rotapp_staff_tabs_pinned') === 'true'
    } catch {
      return false
    }
  })

  // ── Leave state ──
  const [leaveStaff, setLeaveStaff] = useState(null)
  const [leaveModalType, setLeaveModalType] = useState('annual_leave')
  const [leaveSelectedDates, setLeaveSelectedDates] = useState([])
  const [leaveNotes, setLeaveNotes] = useState('')
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState(null)

  // ── Cancel request state ──
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [managerNotes, setManagerNotes] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  // ── Move state ──
  const [moveStaff, setMoveStaff] = useState(null)
  const [selectedMoveRequest, setSelectedMoveRequest] = useState(null)
  const [showRejectMoveModal, setShowRejectMoveModal] = useState(false)
  const [moveRejectReason, setMoveRejectReason] = useState('')

  // ── Tabs pin ──
  const toggleTabsPin = () => {
    const newVal = !isTabsPinned
    setIsTabsPinned(newVal)
    localStorage.setItem('rotapp_staff_tabs_pinned', String(newVal))
  }

  // ── Mark transfer notifications as read on tab open ──
  useEffect(() => {
    if (tab !== 'transfers' || !user?.id) return
    const hasUnread = notifications.some(
      (n) => !n.read_at && TRANSFERS_VIEW_TYPES.includes(n.type)
    )
    if (!hasUnread) return
    markManyAsRead(user.id, TRANSFERS_VIEW_TYPES)
      .then(() => refreshNotifications())
      .catch((err) =>
        console.error(
          'Staff: failed to mark transfer notifications as read',
          err
        )
      )
  }, [tab])

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
          .neq('role', 'superadmin')
          .order('name', { ascending: true })
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

  // ── Staff approval ──
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

  // ── Move handlers ──
  const handleInitiateMove = async ({
    staffId,
    staffName,
    fromHomeId,
    toHomeId,
  }) => {
    const fromHomeName =
      orgHomes.find((h) => h.id === fromHomeId)?.name || fromHomeId
    const toHomeName = orgHomes.find((h) => h.id === toHomeId)?.name || toHomeId

    if (isOLorAdmin) {
      const requestId = await createAndExecute({
        orgId: user.org_id,
        staffId,
        staffName,
        fromHomeId,
        toHomeId,
        initiatedBy: user.id,
        initiatedByName: user.name,
      })
      const [fromHomeManager, toHomeManager] = await Promise.all([
        fetchHomeManager(fromHomeId),
        fetchHomeManager(toHomeId),
      ])
      const notifyPromises = []
      if (fromHomeManager) {
        notifyPromises.push(
          notifyTransferExecutedOL({
            orgId: user.org_id,
            recipientId: fromHomeManager.id,
            requestId,
            staffName,
            fromHomeName,
            toHomeName,
            executedById: user.id,
            executedByName: user.name,
          })
        )
      }
      if (toHomeManager && toHomeManager.id !== fromHomeManager?.id) {
        notifyPromises.push(
          notifyTransferExecutedOL({
            orgId: user.org_id,
            recipientId: toHomeManager.id,
            requestId,
            staffName,
            fromHomeName,
            toHomeName,
            executedById: user.id,
            executedByName: user.name,
          })
        )
      }
      await Promise.all(notifyPromises)
    } else {
      const requestId = await createRequest({
        orgId: user.org_id,
        staffId,
        staffName,
        fromHomeId,
        toHomeId,
        initiatedBy: user.id,
        initiatedByName: user.name,
      })
      await notifyTransferOutgoing({
        orgId: user.org_id,
        recipientId: user.id,
        requestId,
        staffName,
        toHomeName,
        initiatedById: user.id,
        initiatedByName: user.name,
      })
      const toHomeManager = await fetchHomeManager(toHomeId)
      if (toHomeManager) {
        await notifyTransferIncoming({
          orgId: user.org_id,
          recipientId: toHomeManager.id,
          requestId,
          staffName,
          fromHomeName,
          toHomeName,
          initiatedById: user.id,
          initiatedByName: user.name,
        })
      }
    }
    await refreshMoveRecords()
    await refreshNotifications()
    setStaffRefresh((n) => n + 1)
  }

  const handleAcceptMove = async (request) => {
    try {
      await acceptRequest({
        requestId: request.id,
        staffId: request.staff_id,
        toHomeId: request.to_home_id,
        reviewedBy: user.id,
        reviewedByName: user.name,
      })
      const toHomeName =
        orgHomes.find((h) => h.id === request.to_home_id)?.name ||
        request.to_home_id
      await notifyTransferAccepted({
        orgId: user.org_id,
        recipientId: request.initiated_by,
        requestId: request.id,
        staffName: request.staff_name,
        toHomeName,
        reviewedById: user.id,
        reviewedByName: user.name,
      })
      await markReferenceAsRead(user.id, request.id)
      await refreshMoveRecords()
      await refreshNotifications()
      setStaffRefresh((n) => n + 1)
      setSelectedMoveRequest(null)
    } catch (err) {
      console.error('Accept move failed:', err)
    }
  }

  const handleRejectMove = async (request) => {
    try {
      await rejectRequest({
        requestId: request.id,
        reviewedBy: user.id,
        reviewedByName: user.name,
        rejectionReason: moveRejectReason || null,
      })
      const toHomeName =
        orgHomes.find((h) => h.id === request.to_home_id)?.name ||
        request.to_home_id
      await notifyTransferRejected({
        orgId: user.org_id,
        recipientId: request.initiated_by,
        requestId: request.id,
        staffName: request.staff_name,
        toHomeName,
        reviewedById: user.id,
        reviewedByName: user.name,
      })
      await markReferenceAsRead(user.id, request.id)
      await refreshMoveRecords()
      await refreshNotifications()
      setSelectedMoveRequest(null)
      setShowRejectMoveModal(false)
      setMoveRejectReason('')
    } catch (err) {
      console.error('Reject move failed:', err)
    }
  }

  const handleCancelMove = async (requestId) => {
    try {
      const request = moveRecords.find((r) => r.id === requestId)
      await cancelRequest({ requestId })
      if (request) {
        const fromHomeName =
          orgHomes.find((h) => h.id === request.from_home_id)?.name ||
          request.from_home_id
        const toHomeManager = await fetchHomeManager(request.to_home_id)
        if (toHomeManager) {
          await notifyTransferCancelled({
            orgId: user.org_id,
            recipientId: toHomeManager.id,
            requestId: request.id,
            staffName: request.staff_name,
            fromHomeName,
            cancelledById: user.id,
            cancelledByName: user.name,
          })
        }
        await markReferenceAsRead(user.id, requestId)
      }
      await refreshMoveRecords()
      await refreshNotifications()
    } catch (err) {
      console.error('Cancel move failed:', err)
    }
  }

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

  // ── Derived lists ──
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

  // ── Derived cancel data ──
  const pendingCancels = getPendingRequests(cancelRequests)
  const allCancels = getAllRequests(cancelRequests)

  // ── Derived move data ──
  const incomingMoveRequests = moveRecords.filter(
    (r) => r.to_home_id === user?.home && r.status === 'pending'
  )
  const outgoingMoveRequests = moveRecords.filter(
    (r) => r.from_home_id === user?.home && r.status === 'pending'
  )
  const moveHistory = moveRecords.filter(
    (r) =>
      (r.from_home_id === user?.home || r.to_home_id === user?.home) &&
      ['completed', 'rejected', 'cancelled'].includes(r.status)
  )

  // ── Derived notification data ──
  const transferIncomingUnread = getUnreadCountByTypes(notifications, [
    NOTIFICATION_TYPES.TRANSFER_INCOMING,
  ])
  const transferViewUnread = getUnreadCountByTypes(
    notifications,
    TRANSFERS_VIEW_TYPES
  )
  const pendingIncomingCount = isOLorAdmin
    ? moveRecords.filter((r) => r.status === 'pending').length
    : transferIncomingUnread
  const transfersTabHasBadge = pendingIncomingCount > 0
  const transfersTabHasAlert = !transfersTabHasBadge && transferViewUnread > 0

  // ── Leave modal helpers ──
  const closeLeaveModal = () => {
    setLeaveStaff(null)
    setLeaveSelectedDates([])
    setLeaveNotes('')
    setLeaveModalType('annual_leave')
  }

  // Get leaveDays for a specific staff member — used by LeaveCalendar
  const getLeaveDaysForMember = (staffId) =>
    getLeaveDaysForStaff(leaveDays, staffId)

  const staffCount =
    isOLorAdmin && !user?.home
      ? allStaff.length
      : visibleStaff.filter(
          (s) => s.status !== 'declined' && !EXCLUDED_ROLES.includes(s.role)
        ).length

  useTopBarInit(
    'Manage Staff',
    isOLorAdmin && !user?.home
      ? `All homes · Manage your team, leave and approvals`
      : `${homeName || '—'} · Manage your team, leave and approvals`,
    <button
      className={styles.inviteBtn}
      onClick={() => setShowInviteModal(true)}
    >
      <FontAwesomeIcon icon='user-plus' /> Onboard staff
    </button>
  )

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        {/* ── OL home filter ── */}
        {isOLorAdmin && (
          <div className={styles.homeFilterRow}>
            <button
              className={`${styles.homeFilterBtn}${homeFilter === 'all' ? ` ${styles.homeFilterBtnActive}` : ''}`}
              onClick={() => setHomeFilter('all')}
            >
              All homes
            </button>
            {homes.map((home) => (
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

        {/* ── Tabs ── */}
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
                  hasBadge: getPendingRequestCount(leaveRequests) > 0,
                  badgeCount: getPendingRequestCount(leaveRequests),
                },
                {
                  key: 'requests',
                  label: `Cancellations${pendingCancels.length > 0 ? ` (${pendingCancels.length})` : ''}`,
                  hasBadge: pendingCancels.length > 0,
                  badgeCount: pendingCancels.length,
                },
                {
                  key: 'transfers',
                  label: 'Transfers',
                  hasBadge: transfersTabHasBadge,
                  badgeCount: pendingIncomingCount,
                  hasAlert: transfersTabHasAlert,
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
                  {t.hasAlert && (
                    <span className={styles.tabAlert}>
                      <FontAwesomeIcon icon='triangle-exclamation' />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              className={`${styles.tabsPinBtn}${isTabsPinned ? ` ${styles.tabsPinBtnActive}` : ''}`}
              onClick={toggleTabsPin}
              title={isTabsPinned ? 'Unpin tabs' : 'Pin tabs'}
            >
              <FontAwesomeIcon icon='thumbtack' />
            </button>
          </div>
        )}

        {/* ── Staff list ── */}
        {!staffLoading &&
          tab !== 'leave' &&
          tab !== 'requests' &&
          tab !== 'transfers' && (
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
                        ` · ${orgHomes.find((h) => h.id === member.home)?.name || member.home}`}
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
                          STATUS_COLORS[member.status]?.bg ||
                          'var(--bg-active)',
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

        {/* ── Leave & Absence tab ── */}
        {tab === 'leave' && (
          <div className={styles.leaveWrap}>
            {/* Actions box */}
            <div className={styles.leaveActionsBox}>
              <PendingLeaveSection
                leaveRequests={leaveRequests}
                leaveDays={leaveDays}
                allStaff={allStaff}
                user={user}
                styles={styles}
                refreshLeave={refreshLeave}
                refreshMonthRota={refreshMonthRota}
              />
              <div className={styles.leaveActionsDivider} />
              <button
                className={styles.addLeaveBtn}
                onClick={() => setLeaveStaff('picker')}
              >
                <FontAwesomeIcon icon='plus' /> Add leave for a staff member
              </button>
            </div>

            {/* Leave history */}
            <LeaveHistory
              leaveRequests={leaveRequests}
              leaveDays={leaveDays}
              allStaff={allStaff}
              styles={styles}
              onRowClick={(request) => setSelectedLeaveRequest(request)}
            />
          </div>
        )}

        {/* ── Cancellations tab ── */}
        {tab === 'requests' && (
          <div className={styles.requestsWrap}>
            {pendingCancels.length === 0 && allCancels.length === 0 ? (
              <div className={styles.empty}>No cancellation requests</div>
            ) : (
              <>
                {pendingCancels.length > 0 && (
                  <>
                    <div className={styles.sectionLabel}>Pending requests</div>
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

        {/* ── Transfers tab ── */}
        {tab === 'transfers' && (
          <div className={styles.requestsWrap}>
            {isOLorAdmin ? (
              <>
                {moveRecords.filter((r) => r.status === 'pending').length ===
                  0 &&
                moveRecords.filter((r) =>
                  ['completed', 'rejected', 'cancelled'].includes(r.status)
                ).length === 0 ? (
                  <div className={styles.empty}>No transfer requests</div>
                ) : (
                  <>
                    {moveRecords.filter((r) => r.status === 'pending').length >
                      0 && (
                      <>
                        <div className={styles.sectionLabel}>
                          Pending transfers
                        </div>
                        {moveRecords
                          .filter((r) => r.status === 'pending')
                          .map((request) => (
                            <MoveRequestCard
                              key={request.id}
                              request={request}
                              homes={orgHomes}
                              currentUserHomeId={user?.home}
                              isOLorAdmin={isOLorAdmin}
                              onAccept={() => handleAcceptMove(request)}
                              onReject={() => {
                                setSelectedMoveRequest(request)
                                setShowRejectMoveModal(true)
                              }}
                              onCancel={() => handleCancelMove(request.id)}
                              styles={styles}
                            />
                          ))}
                      </>
                    )}
                    {moveRecords.filter((r) =>
                      ['completed', 'rejected', 'cancelled'].includes(r.status)
                    ).length > 0 && (
                      <>
                        <div
                          className={styles.sectionLabel}
                          style={{ marginTop: '24px' }}
                        >
                          History
                        </div>
                        {moveRecords
                          .filter((r) =>
                            ['completed', 'rejected', 'cancelled'].includes(
                              r.status
                            )
                          )
                          .map((request) => (
                            <MoveRequestCard
                              key={request.id}
                              request={request}
                              homes={orgHomes}
                              currentUserHomeId={user?.home}
                              isOLorAdmin={isOLorAdmin}
                              styles={styles}
                            />
                          ))}
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {incomingMoveRequests.length === 0 &&
                outgoingMoveRequests.length === 0 &&
                moveHistory.length === 0 ? (
                  <div className={styles.empty}>No transfer requests</div>
                ) : (
                  <>
                    {incomingMoveRequests.length > 0 && (
                      <>
                        <div className={styles.sectionLabel}>
                          Incoming requests
                        </div>
                        {incomingMoveRequests.map((request) => (
                          <MoveRequestCard
                            key={request.id}
                            request={request}
                            homes={orgHomes}
                            currentUserHomeId={user?.home}
                            isOLorAdmin={false}
                            onAccept={() => handleAcceptMove(request)}
                            onReject={() => {
                              setSelectedMoveRequest(request)
                              setShowRejectMoveModal(true)
                            }}
                            styles={styles}
                          />
                        ))}
                      </>
                    )}
                    {outgoingMoveRequests.length > 0 && (
                      <>
                        <div
                          className={styles.sectionLabel}
                          style={{
                            marginTop:
                              incomingMoveRequests.length > 0 ? '24px' : '0',
                          }}
                        >
                          Outgoing requests
                        </div>
                        {outgoingMoveRequests.map((request) => (
                          <MoveRequestCard
                            key={request.id}
                            request={request}
                            homes={orgHomes}
                            currentUserHomeId={user?.home}
                            isOLorAdmin={false}
                            onCancel={() => handleCancelMove(request.id)}
                            styles={styles}
                          />
                        ))}
                      </>
                    )}
                    {moveHistory.length > 0 && (
                      <>
                        <div
                          className={styles.sectionLabel}
                          style={{ marginTop: '24px' }}
                        >
                          History
                        </div>
                        {moveHistory.map((request) => (
                          <MoveRequestCard
                            key={request.id}
                            request={request}
                            homes={orgHomes}
                            currentUserHomeId={user?.home}
                            isOLorAdmin={false}
                            styles={styles}
                          />
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Staff profile modal ── */}
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
                { label: 'Driver', val: selectedStaff.driver ? 'Yes' : 'No' },
                {
                  label: 'Home',
                  val: selectedStaff.home
                    ? orgHomes.find((h) => h.id === selectedStaff.home)?.name ||
                      selectedStaff.home
                    : 'Relief pool',
                },
                { label: 'Status', val: selectedStaff.status },
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
                <button
                  className={styles.moveBtn}
                  onClick={() => {
                    setSelectedStaff(null)
                    setMoveStaff(selectedStaff)
                  }}
                >
                  <FontAwesomeIcon icon='right-left' /> Move to another home
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Move staff modal ── */}
      {moveStaff && (
        <MoveStaffModal
          staff={moveStaff}
          homes={orgHomes}
          moveRecords={moveRecords}
          isOLorAdmin={isOLorAdmin}
          onConfirm={handleInitiateMove}
          onClose={() => setMoveStaff(null)}
          styles={styles}
        />
      )}

      {/* ── Reject move modal ── */}
      {showRejectMoveModal && selectedMoveRequest && (
        <div
          className={styles.overlay}
          onClick={() => {
            setShowRejectMoveModal(false)
            setSelectedMoveRequest(null)
            setMoveRejectReason('')
          }}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Reject transfer</div>
              <button
                className={styles.closeBtn}
                onClick={() => {
                  setShowRejectMoveModal(false)
                  setSelectedMoveRequest(null)
                  setMoveRejectReason('')
                }}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Staff</span>
                <span className={styles.detailVal}>
                  {selectedMoveRequest.staff_name}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>From</span>
                <span className={styles.detailVal}>
                  {orgHomes.find(
                    (h) => h.id === selectedMoveRequest.from_home_id
                  )?.name || '—'}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>To</span>
                <span className={styles.detailVal}>
                  {orgHomes.find((h) => h.id === selectedMoveRequest.to_home_id)
                    ?.name || '—'}
                </span>
              </div>
              <div className={styles.field}>
                <label className={styles.detailLabel}>Reason (optional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder='Why is this transfer being rejected?'
                  value={moveRejectReason}
                  onChange={(e) => setMoveRejectReason(e.target.value)}
                  rows='3'
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <div className={styles.modalButtonGroup}>
                <button
                  className={styles.cancelModalBtn}
                  onClick={() => {
                    setShowRejectMoveModal(false)
                    setSelectedMoveRequest(null)
                    setMoveRejectReason('')
                  }}
                >
                  Cancel
                </button>
                <button
                  className={styles.rejectModalBtn}
                  onClick={() => handleRejectMove(selectedMoveRequest)}
                >
                  <FontAwesomeIcon icon='xmark' /> Reject transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add leave modal ── */}
      {leaveStaff && (
        <div className={styles.overlay} onClick={closeLeaveModal}>
          <div
            className={styles.modal}
            style={{ maxWidth: '460px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                {leaveStaff === 'picker'
                  ? 'Add Leave'
                  : `Add Leave — ${leaveStaff.name}`}
              </div>
              <button className={styles.closeBtn} onClick={closeLeaveModal}>
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div className={styles.modalBody}>
              {leaveStaff === 'picker' ? (
                <div className={styles.field}>
                  <label className={styles.detailLabel}>Staff member</label>
                  <select
                    className={styles.input}
                    value=''
                    onChange={(e) => {
                      const selected = allStaff.find(
                        (s) => s.id === e.target.value
                      )
                      if (selected) {
                        setLeaveStaff(selected)
                        setLeaveSelectedDates([])
                      }
                    }}
                  >
                    <option value=''>Select a staff member…</option>
                    {allStaff
                      .filter(
                        (s) =>
                          s.status === 'active' &&
                          !['superadmin', 'operationallead', 'relief'].includes(
                            s.role
                          )
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <>
                  <LeaveCalendar
                    staffId={leaveStaff.id}
                    selectedDates={leaveSelectedDates}
                    onSelectionChange={setLeaveSelectedDates}
                    leaveDays={getLeaveDaysForMember(leaveStaff.id)}
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
                    <label className={styles.detailLabel}>
                      Note (optional)
                    </label>
                    <input
                      className={styles.input}
                      type='text'
                      placeholder='e.g. holiday, hospital appointment'
                      value={leaveNotes}
                      onChange={(e) => setLeaveNotes(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
            {leaveStaff !== 'picker' && (
              <div className={styles.modalFooterRow}>
                <button
                  className={styles.cancelModalBtn}
                  onClick={closeLeaveModal}
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
                    await createLeaveRequest({
                      orgId: user.org_id,
                      homeId: user.home,
                      staffId: leaveStaff.id,
                      staffName: leaveStaff.name,
                      dates: leaveSelectedDates,
                      type: leaveModalType,
                      notes: leaveNotes || null,
                      status: 'approved',
                      approvedBy: user?.name || 'Manager',
                    })
                    refreshLeave()
                    refreshMonthRota()
                    closeLeaveModal()
                  }}
                >
                  <FontAwesomeIcon icon='check' /> Confirm leave
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Leave request detail modal ── */}
      {selectedLeaveRequest && (
        <div
          className={styles.overlay}
          onClick={() => setSelectedLeaveRequest(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>Leave Details</div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedLeaveRequest(null)}
              >
                <FontAwesomeIcon icon='xmark' />
              </button>
            </div>
            <div className={styles.modalBody}>
              {[
                { label: 'Staff', val: selectedLeaveRequest.staff_name },
                {
                  label: 'Type',
                  val:
                    TYPE_LABELS[selectedLeaveRequest.type] ||
                    selectedLeaveRequest.type,
                },
                {
                  label: 'Status',
                  val: selectedLeaveRequest.status,
                  style: {
                    color:
                      selectedLeaveRequest.status === 'approved'
                        ? 'var(--color-success)'
                        : selectedLeaveRequest.status === 'declined'
                          ? 'var(--color-danger)'
                          : selectedLeaveRequest.status === 'partially_approved'
                            ? 'var(--color-warning)'
                            : 'var(--text-primary)',
                    fontWeight: 500,
                    textTransform: 'capitalize',
                  },
                },
                ...(selectedLeaveRequest.notes
                  ? [{ label: 'Note', val: selectedLeaveRequest.notes }]
                  : []),
                {
                  label: 'Requested',
                  val: new Date(
                    selectedLeaveRequest.requested_at
                  ).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }),
                },
                ...(selectedLeaveRequest.reviewed_by
                  ? [
                      {
                        label: 'Reviewed by',
                        val: selectedLeaveRequest.reviewed_by,
                      },
                    ]
                  : []),
                ...(selectedLeaveRequest.reviewed_at
                  ? [
                      {
                        label: 'Reviewed on',
                        val: new Date(
                          selectedLeaveRequest.reviewed_at
                        ).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }),
                      },
                    ]
                  : []),
              ].map((row) => (
                <div key={row.label} className={styles.detailRow}>
                  <span className={styles.detailLabel}>{row.label}</span>
                  <span className={styles.detailVal} style={row.style || {}}>
                    {row.val}
                  </span>
                </div>
              ))}

              {/* Individual days */}
              <div className={styles.divider} />
              <div
                className={styles.detailLabel}
                style={{ marginBottom: '8px' }}
              >
                Days
              </div>
              <div className={styles.dayChips}>
                {leaveDays
                  .filter((d) => d.request_id === selectedLeaveRequest.id)
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((day) => (
                    <span
                      key={day.id}
                      className={styles.dayChip}
                      style={{
                        background:
                          day.status === 'approved'
                            ? 'var(--color-success-bg)'
                            : day.status === 'declined'
                              ? 'var(--color-danger-bg)'
                              : 'var(--bg-active)',
                        color:
                          day.status === 'approved'
                            ? 'var(--color-success)'
                            : day.status === 'declined'
                              ? 'var(--color-danger)'
                              : 'var(--text-muted)',
                        border:
                          day.status === 'approved'
                            ? '1px solid var(--color-success-border)'
                            : day.status === 'declined'
                              ? '1px solid var(--color-danger-border)'
                              : '1px solid var(--border-subtle)',
                        cursor: 'default',
                      }}
                    >
                      {new Date(day.date + 'T00:00:00').toLocaleDateString(
                        'en-GB',
                        { day: 'numeric', month: 'short' }
                      )}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve cancel request modal ── */}
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
                  <FontAwesomeIcon icon='check' /> Approve & remove shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject cancel request modal ── */}
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
                  <FontAwesomeIcon icon='xmark' /> Reject request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Onboard modal ── */}
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

// ── PendingLeaveSection ────────────────────────────────────────────
function PendingLeaveSection({
  leaveRequests,
  leaveDays,
  allStaff,
  user,
  styles,
  refreshLeave,
  refreshMonthRota,
}) {
  const pendingRequests = leaveRequests.filter(
    (r) => r.status === 'pending' && allStaff.some((s) => s.id === r.staff_id)
  )

  if (pendingRequests.length === 0) {
    return <div className={styles.noPending}>No pending leave requests</div>
  }

  return (
    <div className={styles.pendingList}>
      {pendingRequests.map((request) => {
        const requestDays = leaveDays
          .filter((d) => d.request_id === request.id)
          .sort((a, b) => a.date.localeCompare(b.date))

        return (
          <PendingLeaveCard
            key={request.id}
            request={request}
            requestDays={requestDays}
            styles={styles}
            onReview={async (approvedDayIds) => {
              const allDayIds = requestDays.map((d) => d.id)
              await reviewLeaveRequest({
                requestId: request.id,
                allDayIds,
                approvedDayIds,
                reviewedBy: user?.name,
                orgId: user?.org_id,
                homeId: user?.home,
                staffId: request.staff_id,
                onApprovedDate: async (date) => {
                  await removeStaffFromShift(
                    request.staff_id,
                    date,
                    user.home,
                    user.org_id,
                    { fromLeave: true }
                  )
                },
              })
              refreshLeave()
              refreshMonthRota()
            }}
          />
        )
      })}
    </div>
  )
}

// ── PendingLeaveCard ───────────────────────────────────────────────
function PendingLeaveCard({ request, requestDays, styles, onReview }) {
  const [selectedDayIds, setSelectedDayIds] = useState(
    requestDays.map((d) => d.id)
  )
  const [loading, setLoading] = useState(false)

  const toggleDay = (dayId) => {
    setSelectedDayIds((prev) =>
      prev.includes(dayId)
        ? prev.filter((id) => id !== dayId)
        : [...prev, dayId]
    )
  }

  const formatDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    })
  }

  const requestedAgo = () => {
    const diff = Date.now() - new Date(request.requested_at).getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Requested today'
    if (days === 1) return 'Requested yesterday'
    return `Requested ${days} days ago`
  }

  const confirmLabel = loading
    ? 'Processing…'
    : selectedDayIds.length === requestDays.length
      ? 'Approve all'
      : selectedDayIds.length === 0
        ? 'Decline all'
        : `Approve ${selectedDayIds.length} of ${requestDays.length} days`

  return (
    <div className={styles.pendingCard}>
      <div className={styles.pendingCardTop}>
        <div>
          <div className={styles.pendingCardName}>{request.staff_name}</div>
          <div className={styles.pendingCardMeta}>
            {TYPE_LABELS[request.type] || request.type} · {requestedAgo()}
          </div>
        </div>
      </div>

      <div className={styles.dayChips}>
        {requestDays.map((day) => {
          const isSelected = selectedDayIds.includes(day.id)
          return (
            <button
              key={day.id}
              className={styles.dayChip}
              style={{
                background: isSelected
                  ? 'var(--color-success-bg)'
                  : 'var(--bg-active)',
                color: isSelected
                  ? 'var(--color-success)'
                  : 'var(--text-muted)',
                border: isSelected
                  ? '1px solid var(--color-success-border)'
                  : '1px solid var(--border-subtle)',
              }}
              onClick={() => toggleDay(day.id)}
            >
              {formatDate(day.date)}
            </button>
          )
        })}
      </div>

      <div className={styles.pendingCardHint}>
        Tap days to toggle. Green = approve, grey = decline.
      </div>

      <div className={styles.pendingCardActions}>
        <button
          className={styles.declineAllBtn}
          onClick={async () => {
            setLoading(true)
            await onReview([])
            setLoading(false)
          }}
          disabled={loading}
        >
          Decline all
        </button>
        <button
          className={styles.confirmLeaveBtn}
          onClick={async () => {
            setLoading(true)
            await onReview(selectedDayIds)
            setLoading(false)
          }}
          disabled={loading}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}

// ── LeaveHistory ───────────────────────────────────────────────────
function LeaveHistory({
  leaveRequests,
  leaveDays,
  allStaff,
  styles,
  onRowClick,
}) {
  const [staffFilter, setStaffFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [fromFilter, setFromFilter] = useState('all')
  const [toFilter, setToFilter] = useState('all')
  const [visibleCount, setVisibleCount] = useState(20)

  // Only show reviewed requests in history (not pending)
  const historyRequests = leaveRequests.filter((r) =>
    ['approved', 'partially_approved', 'declined'].includes(r.status)
  )

  const monthOptions = (() => {
    const months = new Set()
    historyRequests.forEach((r) => {
      const [y, m] = r.requested_at.split('T')[0].split('-')
      months.add(`${y}-${m}`)
    })
    return Array.from(months)
      .sort()
      .reverse()
      .map((ym) => {
        const [y, m] = ym.split('-').map(Number)
        const label = new Date(y, m - 1, 1).toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        })
        return { value: ym, label }
      })
  })()

  const filtered = historyRequests
    .filter((r) => staffFilter === 'all' || r.staff_id === staffFilter)
    .filter((r) => typeFilter === 'all' || r.type === typeFilter)
    .filter((r) => statusFilter === 'all' || r.status === statusFilter)
    .filter((r) => {
      if (fromFilter === 'all') return true
      return r.requested_at >= `${fromFilter}-01`
    })
    .filter((r) => {
      if (toFilter === 'all') return true
      const [y, m] = toFilter.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      return (
        r.requested_at <=
        `${toFilter}-${String(lastDay).padStart(2, '0')}T23:59:59`
      )
    })
    .sort((a, b) => b.requested_at.localeCompare(a.requested_at))

  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

  const getDateRange = (requestId) => {
    const days = leaveDays
      .filter((d) => d.request_id === requestId)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (days.length === 0) return '—'
    const fmt = (dateStr) =>
      new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })
    if (days.length === 1)
      return new Date(days[0].date + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    return `${fmt(days[0].date)} – ${new Date(days[days.length - 1].date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} (${days.length} days)`
  }

  const STATUS_STYLE = {
    approved: {
      color: 'var(--color-success)',
      background: 'var(--color-success-bg)',
      border: '1px solid var(--color-success-border)',
    },
    partially_approved: {
      color: 'var(--color-warning)',
      background: 'var(--color-warning-bg)',
      border: '1px solid var(--color-warning-border)',
    },
    declined: {
      color: 'var(--color-danger)',
      background: 'var(--color-danger-bg)',
      border: '1px solid var(--color-danger-border)',
    },
  }

  const STATUS_LABEL = {
    approved: 'Approved',
    partially_approved: 'Partial',
    declined: 'Declined',
  }

  if (
    filtered.length === 0 &&
    staffFilter === 'all' &&
    typeFilter === 'all' &&
    statusFilter === 'all' &&
    fromFilter === 'all' &&
    toFilter === 'all'
  ) {
    return null
  }

  return (
    <div className={styles.leaveHistoryWrap}>
      <div className={styles.leaveHistoryTitle}>Leave History</div>
      <div className={styles.leaveFilters}>
        <select
          className={styles.leaveFilter}
          value={staffFilter}
          onChange={(e) => {
            setStaffFilter(e.target.value)
            setVisibleCount(20)
          }}
        >
          <option value='all'>All staff</option>
          {allStaff
            .filter(
              (s) =>
                s.status === 'active' &&
                !['superadmin', 'operationallead'].includes(s.role)
            )
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
        <select
          className={styles.leaveFilter}
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value)
            setVisibleCount(20)
          }}
        >
          <option value='all'>All types</option>
          <option value='annual_leave'>Annual leave</option>
          <option value='sick'>Sick</option>
          <option value='training'>Training</option>
          <option value='other'>Other</option>
        </select>
        <select
          className={styles.leaveFilter}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setVisibleCount(20)
          }}
        >
          <option value='all'>All statuses</option>
          <option value='approved'>Approved</option>
          <option value='partially_approved'>Partially approved</option>
          <option value='declined'>Declined</option>
        </select>
        <select
          className={styles.leaveFilter}
          value={fromFilter}
          onChange={(e) => {
            setFromFilter(e.target.value)
            setVisibleCount(20)
          }}
        >
          <option value='all'>From</option>
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className={styles.leaveFilter}
          value={toFilter}
          onChange={(e) => {
            setToFilter(e.target.value)
            setVisibleCount(20)
          }}
        >
          <option value='all'>To</option>
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.leaveHistoryEmpty}>
          No leave records match your filters
        </div>
      ) : (
        <>
          <div className={styles.leaveTable}>
            <div className={styles.leaveTableHeader}>
              <span>Staff</span>
              <span>Dates</span>
              <span>Type</span>
              <span>Status</span>
              <span>By</span>
              <span />
            </div>
            {visible.map((request) => (
              <div
                key={request.id}
                className={styles.leaveTableRow}
                onClick={() => onRowClick(request)}
              >
                <span className={styles.leaveTableStaff}>
                  {request.staff_name}
                </span>
                <span className={styles.leaveTableDate}>
                  {getDateRange(request.id)}
                </span>
                <span className={styles.leaveTableType}>
                  {TYPE_LABELS[request.type] || request.type}
                </span>
                <span
                  className={styles.leaveTableStatus}
                  style={STATUS_STYLE[request.status] || {}}
                >
                  {STATUS_LABEL[request.status] || request.status}
                </span>
                <span className={styles.leaveTableBy}>
                  {request.reviewed_by || '—'}
                </span>
                <span className={styles.leaveTableChevron}>›</span>
              </div>
            ))}
          </div>
          <div className={styles.leaveTableFooter}>
            <span className={styles.leaveTableCount}>
              Showing {visible.length} of {filtered.length} entries
            </span>
            {hasMore && (
              <button
                className={styles.loadMoreBtn}
                onClick={() => setVisibleCount((n) => n + 20)}
              >
                Load more
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── MoveRequestCard ────────────────────────────────────────────────
function MoveRequestCard({
  request,
  homes,
  currentUserHomeId,
  isOLorAdmin,
  onAccept,
  onReject,
  onCancel,
  styles,
}) {
  const fromHome = homes.find((h) => h.id === request.from_home_id)?.name || '—'
  const toHome = homes.find((h) => h.id === request.to_home_id)?.name || '—'
  const isIncoming = request.to_home_id === currentUserHomeId
  const isOutgoing = request.from_home_id === currentUserHomeId
  const statusStyle = {
    pending: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
    completed: { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
    rejected: { bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
    cancelled: { bg: 'var(--bg-active)', color: 'var(--text-secondary)' },
  }
  const s = statusStyle[request.status] || statusStyle.pending

  return (
    <div
      className={
        request.status === 'pending'
          ? styles.requestCard
          : styles.requestCardHistory
      }
    >
      <div className={styles.requestHeader}>
        <div className={styles.requestStaff}>{request.staff_name}</div>
        <div
          className={styles.requestStatus}
          style={{ background: s.bg, color: s.color }}
        >
          {request.status}
        </div>
      </div>
      <div className={styles.requestDetails}>
        <div>
          {fromHome}{' '}
          <FontAwesomeIcon
            icon='right-left'
            style={{ fontSize: '10px', margin: '0 4px' }}
          />{' '}
          {toHome}
        </div>
        {(isOLorAdmin || isIncoming) && (
          <div>Initiated by {request.initiated_by_name}</div>
        )}
        {isOutgoing && !isOLorAdmin && (
          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            Waiting for {toHome} manager to respond
          </div>
        )}
        {request.status === 'rejected' && request.rejection_reason && (
          <div
            style={{
              color: 'var(--color-danger)',
              fontSize: '12px',
              marginTop: '4px',
            }}
          >
            Rejection reason: {request.rejection_reason}
          </div>
        )}
        <div className={styles.requestTime}>
          {new Date(request.initiated_at).toLocaleString()}
          {request.completed_at &&
            ` · Completed: ${new Date(request.completed_at).toLocaleString()}`}
          {request.reviewed_at &&
            request.status === 'rejected' &&
            ` · Rejected: ${new Date(request.reviewed_at).toLocaleString()}`}
        </div>
      </div>
      {request.status === 'pending' && (
        <div className={styles.requestActions}>
          {(isIncoming || isOLorAdmin) && onAccept && onReject && (
            <>
              <button className={styles.approveRequestBtn} onClick={onAccept}>
                <FontAwesomeIcon icon='check' /> Accept
              </button>
              <button className={styles.rejectRequestBtn} onClick={onReject}>
                <FontAwesomeIcon icon='xmark' /> Reject
              </button>
            </>
          )}
          {isOutgoing && !isOLorAdmin && onCancel && (
            <button className={styles.rejectRequestBtn} onClick={onCancel}>
              <FontAwesomeIcon icon='xmark' /> Cancel request
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── MoveStaffModal ─────────────────────────────────────────────────
function MoveStaffModal({
  staff,
  homes,
  moveRecords,
  isOLorAdmin,
  onConfirm,
  onClose,
  styles,
}) {
  const [selectedHomeId, setSelectedHomeId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [resultMessage, setResultMessage] = useState('')

  const hasPendingRequest = moveRecords.some(
    (r) => r.staff_id === staff.id && r.status === 'pending'
  )
  const availableHomes = homes.filter((h) => h.id !== staff.home)

  const handleConfirm = async () => {
    if (!selectedHomeId) {
      setError('Please select a destination home.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onConfirm({
        staffId: staff.id,
        staffName: staff.name,
        fromHomeId: staff.home,
        toHomeId: selectedHomeId,
      })
      const destName =
        homes.find((h) => h.id === selectedHomeId)?.name || 'the destination'
      setResult('success')
      setResultMessage(
        isOLorAdmin
          ? `${staff.name} has been moved to ${destName}.`
          : `Transfer request for ${staff.name} has been sent to ${destName}.`
      )
    } catch (err) {
      setResult('error')
      setResultMessage('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <div className={styles.modalTitle}>
              {result === 'success' ? 'Transfer complete' : 'Transfer failed'}
            </div>
            <button className={styles.closeBtn} onClick={onClose}>
              <FontAwesomeIcon icon='xmark' />
            </button>
          </div>
          <div className={styles.modalBody}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 0',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  background:
                    result === 'success'
                      ? 'var(--color-success-bg)'
                      : 'var(--color-danger-bg)',
                  color:
                    result === 'success'
                      ? 'var(--color-success)'
                      : 'var(--color-danger)',
                  border:
                    result === 'success'
                      ? '1px solid var(--color-success-border)'
                      : '1px solid var(--color-danger-border)',
                }}
              >
                <FontAwesomeIcon
                  icon={
                    result === 'success'
                      ? 'circle-check'
                      : 'triangle-exclamation'
                  }
                />
              </div>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  margin: 0,
                }}
              >
                {resultMessage}
              </p>
            </div>
          </div>
          <div className={styles.modalFooter}>
            <div className={styles.modalButtonGroup}>
              <button className={styles.approveModalBtn} onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Move to another home</div>
          <button className={styles.closeBtn} onClick={onClose}>
            <FontAwesomeIcon icon='xmark' />
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Staff member</span>
            <span className={styles.detailVal}>{staff.name}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Current home</span>
            <span className={styles.detailVal}>
              {homes.find((h) => h.id === staff.home)?.name || '—'}
            </span>
          </div>
          {hasPendingRequest ? (
            <div className={styles.warningNote}>
              <FontAwesomeIcon icon='triangle-exclamation' /> A transfer request
              for this staff member is already pending. Cancel it first before
              creating a new one.
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.detailLabel}>Destination home</label>
                <select
                  className={styles.input}
                  value={selectedHomeId}
                  onChange={(e) => {
                    setSelectedHomeId(e.target.value)
                    setError('')
                  }}
                >
                  <option value=''>Select a home…</option>
                  {availableHomes.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
              <div
                className={styles.warningNote}
                style={{
                  background: 'var(--accent-bg)',
                  borderColor: 'var(--accent-border)',
                  color: 'var(--accent)',
                }}
              >
                <FontAwesomeIcon icon='circle-info' />{' '}
                {isOLorAdmin
                  ? 'As OL, this move will execute immediately. The destination manager will be notified via the Transfers tab.'
                  : 'A request will be sent to the destination manager for approval. You can cancel it from the Transfers tab.'}
              </div>
              {error && (
                <div className={styles.warningNote}>
                  <FontAwesomeIcon icon='triangle-exclamation' /> {error}
                </div>
              )}
            </>
          )}
        </div>
        {!hasPendingRequest && (
          <div className={styles.modalFooter}>
            <div className={styles.modalButtonGroup}>
              <button className={styles.cancelModalBtn} onClick={onClose}>
                Cancel
              </button>
              <button
                className={styles.approveModalBtn}
                onClick={handleConfirm}
                disabled={loading || !selectedHomeId}
                style={{
                  opacity: loading || !selectedHomeId ? 0.5 : 1,
                  cursor:
                    loading || !selectedHomeId ? 'not-allowed' : 'pointer',
                }}
              >
                {loading
                  ? 'Processing…'
                  : isOLorAdmin
                    ? 'Move now'
                    : 'Send request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Staff
