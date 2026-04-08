import { supabase } from '../lib/supabase'

// Generate unique ID
export function generateTimeOffId() {
  return `to_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Add time off entry to Supabase
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
}

// Approve a time off entry
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

// Remove staff from rota on approved leave dates
// Called after approving time off — mutates monthRota in Supabase
export async function removeStaffFromRotaOnLeave(
  staffId,
  dateStr,
  homeId,
  orgId
) {
  // Find the Monday key for this date
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const dayOfWeek = (date.getDay() + 6) % 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - dayOfWeek)
  const mondayKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`

  // Fetch the rota for that week
  const { data, error } = await supabase
    .from('rotapp_month_rota')
    .select('rota_data')
    .eq('home_id', homeId)
    .eq('org_id', orgId)
    .eq('week_key', mondayKey)
    .maybeSingle()

  if (error || !data) return

  const weekRota = data.rota_data
  if (weekRota.early?.[dayOfWeek]) {
    weekRota.early[dayOfWeek] = weekRota.early[dayOfWeek].filter(
      (s) => s.id !== staffId
    )
  }
  if (weekRota.late?.[dayOfWeek]) {
    weekRota.late[dayOfWeek] = weekRota.late[dayOfWeek].filter(
      (s) => s.id !== staffId
    )
  }

  await supabase
    .from('rotapp_month_rota')
    .update({ rota_data: weekRota, updated_at: new Date().toISOString() })
    .eq('home_id', homeId)
    .eq('org_id', orgId)
    .eq('week_key', mondayKey)
}

// Legacy migration — no longer needed, kept as no-op to avoid import errors
export function migrateLeaveDataIfNeeded() {
  return false
}
