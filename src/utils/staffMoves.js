import { supabase } from '../lib/supabase'

// ── createRequest ──────────────────────────────────────────────────
// Manager-initiated path. Writes a pending move request.
// Does NOT update profiles.home — that only happens on acceptance.
export async function createRequest({
  orgId,
  staffId,
  staffName,
  fromHomeId,
  toHomeId,
  initiatedBy,
  initiatedByName,
}) {
  if (
    !orgId ||
    !staffId ||
    !staffName ||
    !fromHomeId ||
    !toHomeId ||
    !initiatedBy ||
    !initiatedByName
  ) {
    throw new Error('createRequest: missing required arguments')
  }

  const { data, error } = await supabase
    .from('staff_move_requests')
    .insert({
      org_id: orgId,
      staff_id: staffId,
      staff_name: staffName,
      from_home_id: fromHomeId,
      to_home_id: toHomeId,
      initiated_by: initiatedBy,
      initiated_by_name: initiatedByName,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    console.error('staffMoves.createRequest error:', error)
    throw error
  }

  return data.id
}

// ── executeMove ────────────────────────────────────────────────────
// Shared by both paths. Updates profiles.home to the new home.
// Also marks the move request as completed.
// Called by: acceptRequest() and directly on OL-initiated moves.
export async function executeMove({
  requestId,
  staffId,
  toHomeId,
  reviewedBy,
  reviewedByName,
}) {
  if (!requestId || !staffId || !toHomeId || !reviewedBy || !reviewedByName) {
    throw new Error('executeMove: missing required arguments')
  }

  const now = new Date().toISOString()

  // Update profiles.home
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ home: toHomeId })
    .eq('id', staffId)

  if (profileError) {
    console.error('staffMoves.executeMove: profile update error', profileError)
    throw profileError
  }

  // Mark request as completed
  const { error: requestError } = await supabase
    .from('staff_move_requests')
    .update({
      status: 'completed',
      reviewed_by: reviewedBy,
      reviewed_by_name: reviewedByName,
      reviewed_at: now,
      completed_at: now,
    })
    .eq('id', requestId)

  if (requestError) {
    console.error('staffMoves.executeMove: request update error', requestError)
    throw requestError
  }
}

// ── createAndExecute ───────────────────────────────────────────────
// OL-initiated path. Creates the record and immediately executes.
// Single function so OL path is one call from the component.
export async function createAndExecute({
  orgId,
  staffId,
  staffName,
  fromHomeId,
  toHomeId,
  initiatedBy,
  initiatedByName,
}) {
  if (
    !orgId ||
    !staffId ||
    !staffName ||
    !fromHomeId ||
    !toHomeId ||
    !initiatedBy ||
    !initiatedByName
  ) {
    throw new Error('createAndExecute: missing required arguments')
  }

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('staff_move_requests')
    .insert({
      org_id: orgId,
      staff_id: staffId,
      staff_name: staffName,
      from_home_id: fromHomeId,
      to_home_id: toHomeId,
      initiated_by: initiatedBy,
      initiated_by_name: initiatedByName,
      status: 'completed',
      reviewed_by: initiatedBy,
      reviewed_by_name: initiatedByName,
      reviewed_at: now,
      completed_at: now,
    })
    .select('id')
    .single()

  if (error) {
    console.error('staffMoves.createAndExecute error:', error)
    throw error
  }

  // Update profiles.home
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ home: toHomeId })
    .eq('id', staffId)

  if (profileError) {
    console.error(
      'staffMoves.createAndExecute: profile update error',
      profileError
    )
    throw profileError
  }

  return data.id
}

// ── acceptRequest ──────────────────────────────────────────────────
// Manager B accepts a pending request. Calls executeMove internally.
export async function acceptRequest({
  requestId,
  staffId,
  toHomeId,
  reviewedBy,
  reviewedByName,
}) {
  if (!requestId || !staffId || !toHomeId || !reviewedBy || !reviewedByName) {
    throw new Error('acceptRequest: missing required arguments')
  }

  await executeMove({
    requestId,
    staffId,
    toHomeId,
    reviewedBy,
    reviewedByName,
  })
}

// ── rejectRequest ──────────────────────────────────────────────────
// Manager B rejects a pending request. profiles.home is NOT touched.
export async function rejectRequest({
  requestId,
  reviewedBy,
  reviewedByName,
  rejectionReason,
}) {
  if (!requestId || !reviewedBy || !reviewedByName) {
    throw new Error('rejectRequest: missing required arguments')
  }

  const { error } = await supabase
    .from('staff_move_requests')
    .update({
      status: 'rejected',
      reviewed_by: reviewedBy,
      reviewed_by_name: reviewedByName,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason || null,
    })
    .eq('id', requestId)

  if (error) {
    console.error('staffMoves.rejectRequest error:', error)
    throw error
  }
}
// ── cancelRequest ──────────────────────────────────────────────────
// Manager A cancels their own pending request before Manager B acts.
// profiles.home is NOT touched.
export async function cancelRequest({ requestId }) {
  if (!requestId) {
    throw new Error('cancelRequest: missing requestId')
  }

  const { error } = await supabase
    .from('staff_move_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) {
    console.error('staffMoves.cancelRequest error:', error)
    throw error
  }
}

// ── fetchMoveRecords ───────────────────────────────────────────────
// Fetches all move records for an org.
// Used by RotaContext to expose moveRecords to all consumers.
// The rota flag render check uses this — no separate fetch needed.
export async function fetchMoveRecords(orgId) {
  if (!orgId) return []

  const { data, error } = await supabase
    .from('staff_move_requests')
    .select('*')
    .eq('org_id', orgId)
    .order('initiated_at', { ascending: false })

  if (error) {
    console.error('staffMoves.fetchMoveRecords error:', error)
    return []
  }

  return data || []
}

// ── getActiveMoveForStaff ──────────────────────────────────────────
// Helper — given a moveRecords array and a staffId + homeId,
// returns the completed move record if that staff member has been
// moved away from that home. Used by Rota.jsx for the flag check.
export function getActiveMoveForStaff(moveRecords, staffId, homeId) {
  if (!moveRecords || !staffId || !homeId) return null

  return (
    moveRecords.find(
      (r) =>
        r.staff_id === staffId &&
        r.from_home_id === homeId &&
        r.status === 'completed'
    ) || null
  )
}
