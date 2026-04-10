import { supabase } from '../lib/supabase'
import { removeStaffFromShift } from './rotaMutations'

// Generate unique ID
export function generateTimeOffId() {
  return `to_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ── addTimeOff ─────────────────────────────────────────────────────────────
// Inserts a time off entry into Supabase.
// If status is 'approved' (e.g. manager adding leave directly), also removes
// the staff member from the rota for that date and supersedes any active
// cancel record — leave is the authoritative state.
export async function addTimeOff(timeOffEntry, homeId, orgId) {
  const { error } = await supabase.from('rotapp_time_off').insert({
    id: timeOffEntry.id,
    home_id: homeId,
    org_id: orgId,
    staff_id: timeOffEntry.staffId,
    staff_name: timeOffEntry.staffName,
    date: timeOffEntry.date,
    type: timeOffEntry.type,
    status: timeOffEntry.status,
    approved_by: timeOffEntry.approvedBy || null,
    approved_at: timeOffEntry.approvedAt || null,
    notes: timeOffEntry.notes || null,
    requested_at: timeOffEntry.requestedAt || new Date().toISOString(),
  })
  if (error) {
    console.error('addTimeOff error:', error)
    throw error
  }

  // If leave is being added as already approved (manager direct add),
  // remove from rota and supersede any conflicting cancel record immediately.
  // fromLeave: true triggers supersedeCancelForDate inside removeStaffFromShift.
  if (timeOffEntry.status === 'approved') {
    await removeStaffFromShift(
      timeOffEntry.staffId,
      timeOffEntry.date,
      homeId,
      orgId,
      { fromLeave: true }
    )
  }
}

// ── approveTimeOff ─────────────────────────────────────────────────────────
// Updates a pending time off entry to approved status.
// Does NOT call removeStaffFromShift here — that is the caller's
// responsibility so it can also call refreshMonthRota() afterwards.
export async function approveTimeOff(timeOffId, approvedBy) {
  const { error } = await supabase
    .from('rotapp_time_off')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', timeOffId)
  if (error) {
    console.error('approveTimeOff error:', error)
    throw error
  }
}

// Remove a time off entry
export async function removeTimeOff(timeOffId) {
  const { error } = await supabase
    .from('rotapp_time_off')
    .delete()
    .eq('id', timeOffId)
  if (error) {
    console.error('removeTimeOff error:', error)
    throw error
  }
}

// Get all time off for a specific staff member (from context array)
export function getTimeOffForStaff(timeOffArray, staffId) {
  return (timeOffArray || []).filter((e) => e.staff_id === staffId)
}

// Get time off entries for a specific date string (from context array)
export function getTimeOffForDateStr(timeOffArray, dateStr) {
  return (timeOffArray || []).filter((e) => e.date === dateStr)
}

// Count pending time-off requests (from context array)
export function getPendingTimeOffCount(timeOffArray) {
  return (timeOffArray || []).filter((e) => e.status === 'pending').length
}

// removeStaffFromRotaOnLeave — legacy re-export for backwards compatibility.
// All new code should call removeStaffFromShift from rotaMutations directly.
export { removeStaffFromShift as removeStaffFromRotaOnLeave } from './rotaMutations'

// Legacy migration — no longer needed, kept as no-op to avoid import errors
export function migrateLeaveDataIfNeeded() {
  return false
}
