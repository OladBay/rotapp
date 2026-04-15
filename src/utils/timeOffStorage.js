import { supabase } from '../lib/supabase'

// ── ID generators ──────────────────────────────────────────────────
export function generateRequestId() {
  return `lr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function generateDayId() {
  return `ld_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ── createLeaveRequest ─────────────────────────────────────────────
// Creates one request row + one day row per date.
// status: 'pending' for staff-submitted, 'approved' for manager direct-add.
// When status is 'approved', also removes staff from rota for each date.
export async function createLeaveRequest({
  orgId,
  homeId,
  staffId,
  staffName,
  dates,
  type,
  notes,
  status = 'pending',
  approvedBy = null,
}) {
  if (!orgId || !homeId || !staffId || !staffName || !dates?.length || !type) {
    throw new Error('createLeaveRequest: missing required arguments')
  }

  const requestId = generateRequestId()
  const now = new Date().toISOString()

  // Insert request row
  const { error: requestError } = await supabase
    .from('rotapp_leave_requests')
    .insert({
      id: requestId,
      org_id: orgId,
      home_id: homeId,
      staff_id: staffId,
      staff_name: staffName,
      type,
      notes: notes || null,
      status,
      requested_at: now,
      reviewed_by: status === 'approved' ? approvedBy : null,
      reviewed_at: status === 'approved' ? now : null,
    })

  if (requestError) {
    console.error('createLeaveRequest: request insert error', requestError)
    throw requestError
  }

  // Insert one day row per date
  const dayRows = dates.map((date) => ({
    id: generateDayId(),
    request_id: requestId,
    org_id: orgId,
    home_id: homeId,
    staff_id: staffId,
    staff_name: staffName,
    date,
    status: status === 'approved' ? 'approved' : 'pending',
    approved_by: status === 'approved' ? approvedBy : null,
    approved_at: status === 'approved' ? now : null,
  }))

  const { error: daysError } = await supabase
    .from('rotapp_leave_days')
    .insert(dayRows)

  if (daysError) {
    console.error('createLeaveRequest: days insert error', daysError)
    throw daysError
  }

  return requestId
}

// ── reviewLeaveRequest ─────────────────────────────────────────────
// Manager reviews a pending request. Approves selected dates,
// declines the rest. Updates request status accordingly.
// Calls removeStaffFromShift for each approved date — caller must
// pass the removeStaffFromShift function to avoid circular imports.
export async function reviewLeaveRequest({
  requestId,
  allDayIds,
  approvedDayIds,
  reviewedBy,
  orgId,
  homeId,
  staffId,
  onApprovedDate,
}) {
  if (!requestId || !reviewedBy || !orgId) {
    throw new Error('reviewLeaveRequest: missing required arguments')
  }

  const now = new Date().toISOString()
  const declinedDayIds = allDayIds.filter((id) => !approvedDayIds.includes(id))

  // Update approved days
  if (approvedDayIds.length > 0) {
    const { error } = await supabase
      .from('rotapp_leave_days')
      .update({
        status: 'approved',
        approved_by: reviewedBy,
        approved_at: now,
      })
      .in('id', approvedDayIds)

    if (error) {
      console.error('reviewLeaveRequest: approve days error', error)
      throw error
    }
  }

  // Update declined days
  if (declinedDayIds.length > 0) {
    const { error } = await supabase
      .from('rotapp_leave_days')
      .update({
        status: 'declined',
        declined_by: reviewedBy,
        declined_at: now,
      })
      .in('id', declinedDayIds)

    if (error) {
      console.error('reviewLeaveRequest: decline days error', error)
      throw error
    }
  }

  // Determine overall request status
  const newRequestStatus =
    approvedDayIds.length === 0
      ? 'declined'
      : declinedDayIds.length === 0
        ? 'approved'
        : 'partially_approved'

  // Update request row
  const { error: requestError } = await supabase
    .from('rotapp_leave_requests')
    .update({
      status: newRequestStatus,
      reviewed_by: reviewedBy,
      reviewed_at: now,
    })
    .eq('id', requestId)

  if (requestError) {
    console.error('reviewLeaveRequest: request update error', requestError)
    throw requestError
  }

  // Fetch approved day dates and call rota mutation for each
  if (approvedDayIds.length > 0 && onApprovedDate) {
    const { data: approvedDays } = await supabase
      .from('rotapp_leave_days')
      .select('date')
      .in('id', approvedDayIds)

    for (const day of approvedDays || []) {
      await onApprovedDate(day.date)
    }
  }
}

// ── fetchLeaveRequests ─────────────────────────────────────────────
// Fetches all leave requests for a home or org.
// Used by RotaContext.
export async function fetchLeaveRequests(orgId, homeId) {
  if (!orgId) return []

  let query = supabase
    .from('rotapp_leave_requests')
    .select('*')
    .eq('org_id', orgId)
    .order('requested_at', { ascending: false })

  if (homeId) query = query.eq('home_id', homeId)

  const { data, error } = await query
  if (error) {
    console.error('fetchLeaveRequests error:', error)
    return []
  }
  return data || []
}

// ── fetchLeaveDays ─────────────────────────────────────────────────
// Fetches all leave days for a home or org.
// Used by RotaContext. Calendar, rota, and hours calculator read
// from this array to determine if a staff member is off on a date.
export async function fetchLeaveDays(orgId, homeId) {
  if (!orgId) return []

  let query = supabase.from('rotapp_leave_days').select('*').eq('org_id', orgId)

  if (homeId) query = query.eq('home_id', homeId)

  const { data, error } = await query
  if (error) {
    console.error('fetchLeaveDays error:', error)
    return []
  }
  return data || []
}

// ── getPendingRequestCount ─────────────────────────────────────────
// Returns count of pending requests. Used by Navbar badge.
export function getPendingRequestCount(leaveRequests) {
  return (leaveRequests || []).filter((r) => r.status === 'pending').length
}

// ── getLeaveDaysForStaff ───────────────────────────────────────────
// Returns all leave days for a specific staff member.
// Used by Calendar.jsx and hoursCalculator.js.
export function getLeaveDaysForStaff(leaveDays, staffId) {
  return (leaveDays || []).filter((d) => d.staff_id === staffId)
}

// ── getLeaveDayForDate ─────────────────────────────────────────────
// Returns the leave day entry for a specific staff member on a date.
// Used by Calendar.jsx getDayState.
export function getLeaveDayForDate(leaveDays, staffId, dateStr) {
  return (
    (leaveDays || []).find(
      (d) => d.staff_id === staffId && d.date === dateStr
    ) || null
  )
}

// ── getApprovedLeaveDates ──────────────────────────────────────────
// Returns array of date strings where staff member has approved leave.
// Used by hoursCalculator.js to skip days when calculating hours.
export function getApprovedLeaveDates(leaveDays, staffId) {
  return (leaveDays || [])
    .filter((d) => d.staff_id === staffId && d.status === 'approved')
    .map((d) => d.date)
}

// ── Legacy exports — kept for backwards compatibility during transition
// Remove once all consumers are updated to new functions.
export function generateTimeOffId() {
  return generateDayId()
}
