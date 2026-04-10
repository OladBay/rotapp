import { supabase } from '../lib/supabase'

function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ── Read helpers (operate on context array) ────────────────────────────────

export function getPendingRequests(cancelArray) {
  return (cancelArray || []).filter((r) => r.status === 'pending')
}

export function getAllRequests(cancelArray) {
  return cancelArray || []
}

export function getShiftRequest(cancelArray, staffId, shiftDate, shiftType) {
  return (
    (cancelArray || []).find(
      (r) =>
        r.staff_id === staffId &&
        r.shift_date === shiftDate &&
        r.shift_type === shiftType
    ) || null
  )
}

export function getPendingCancelCount(cancelArray) {
  return getPendingRequests(cancelArray).length
}

export function getRecentRequestWarning(
  cancelArray,
  staffId,
  shiftDate,
  shiftType
) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const count = (cancelArray || []).filter(
    (r) =>
      r.staff_id === staffId &&
      r.shift_date === shiftDate &&
      r.shift_type === shiftType &&
      ['pending', 'rejected'].includes(r.status) &&
      new Date(r.requested_at) >= cutoff
  ).length
  return {
    count,
    shouldWarn: count >= 3,
    message:
      count >= 3
        ? `You've requested cancellation ${count} times recently`
        : null,
  }
}

export function getPingInfo(request) {
  const pingCount = request.ping_count || 0
  const remainingPings = Math.max(0, 3 - pingCount)
  const canPing = request.status === 'pending' && remainingPings > 0
  return {
    pingCount,
    remainingPings,
    canPing,
    lastPingedAt: request.last_pinged_at || null,
    message:
      !canPing && request.status === 'pending'
        ? 'Maximum pings reached. Please contact manager directly.'
        : null,
  }
}

// ── Write (Supabase) ───────────────────────────────────────────────────────

export async function addRequest(
  {
    staffId,
    staffName,
    shiftDate,
    shiftType,
    reason,
    customReason,
    notes,
    homeId,
    orgId,
  },
  cancelArray
) {
  // Check if existing request for this shift
  const existing = getShiftRequest(cancelArray, staffId, shiftDate, shiftType)

  if (existing) {
    // Reset existing request back to pending
    const { error } = await supabase
      .from('rotapp_cancel_requests')
      .update({
        status: 'pending',
        reason,
        custom_reason: customReason || null,
        notes: notes || null,
        requested_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
        rejection_reason: null,
        manager_notes: null,
        withdrawn_at: null,
        ping_count: 0,
        last_pinged_at: null,
      })
      .eq('id', existing.id)
    if (error) {
      console.error('addRequest update error:', error)
      throw error
    }
    return existing.id
  }

  // Create new request
  const newRequest = {
    id: generateRequestId(),
    org_id: orgId,
    home_id: homeId,
    staff_id: staffId,
    staff_name: staffName,
    shift_date: shiftDate,
    shift_type: shiftType,
    reason,
    custom_reason: customReason || null,
    notes: notes || null,
    status: 'pending',
    requested_at: new Date().toISOString(),
    ping_count: 0,
  }
  const { error } = await supabase
    .from('rotapp_cancel_requests')
    .insert(newRequest)
  if (error) {
    console.error('addRequest insert error:', error)
    throw error
  }
  return newRequest.id
}

export async function updateRequest(requestId, updates) {
  // Map camelCase to snake_case for any legacy callers
  const mapped = {}
  if (updates.status !== undefined) mapped.status = updates.status
  if (updates.reviewedAt !== undefined) mapped.reviewed_at = updates.reviewedAt
  if (updates.reviewedBy !== undefined) mapped.reviewed_by = updates.reviewedBy
  if (updates.rejectionReason !== undefined)
    mapped.rejection_reason = updates.rejectionReason
  if (updates.managerNotes !== undefined)
    mapped.manager_notes = updates.managerNotes
  if (updates.withdrawnAt !== undefined)
    mapped.withdrawn_at = updates.withdrawnAt
  if (updates.pingCount !== undefined) mapped.ping_count = updates.pingCount
  if (updates.lastPingedAt !== undefined)
    mapped.last_pinged_at = updates.lastPingedAt

  const { error } = await supabase
    .from('rotapp_cancel_requests')
    .update(mapped)
    .eq('id', requestId)
  if (error) {
    console.error('updateRequest error:', error)
    throw error
  }
}

export async function pingRequest(requestId, staffId, cancelArray) {
  const request = (cancelArray || []).find((r) => r.id === requestId)
  if (!request) return null
  if (request.status !== 'pending') return null
  if (request.staff_id !== staffId) return null

  const currentPingCount = request.ping_count || 0
  if (currentPingCount >= 3) return null

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('rotapp_cancel_requests')
    .update({
      ping_count: currentPingCount + 1,
      last_pinged_at: now,
    })
    .eq('id', requestId)

  if (error) {
    console.error('pingRequest error:', error)
    throw error
  }

  return { ...request, ping_count: currentPingCount + 1, last_pinged_at: now }
}
