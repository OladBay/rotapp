import { supabase } from '../lib/supabase'

// ── Shared helper — get Monday key for any date string ─────────────────────
function getMondayKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  const yr = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const dy = String(date.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${dy}`
}

// ── Shared helper — get day index (0=Mon … 6=Sun) for a date string ────────
function getDayIndex(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return (date.getDay() + 6) % 7
}

// ── supersedeCancelForDate ─────────────────────────────────────────────────
// When leave is approved for a date, any active cancel record for that
// staff member on that date is marked 'superseded'.
// Superseded records are kept for audit history but are no longer the
// active state — leave takes precedence over cancellation.
// Called by: removeStaffFromShift when triggered from a leave approval.
export async function supersedeCancelForDate(staffId, dateStr, orgId) {
  if (!staffId || !dateStr || !orgId) {
    console.error('supersedeCancelForDate: missing required arguments', {
      staffId,
      dateStr,
      orgId,
    })
    return
  }

  const { error } = await supabase
    .from('rotapp_cancel_requests')
    .update({
      status: 'superseded',
      superseded_at: new Date().toISOString(),
    })
    .eq('staff_id', staffId)
    .eq('shift_date', dateStr)
    .eq('org_id', orgId)
    .in('status', ['pending', 'approved'])

  if (error) {
    console.error('supersedeCancelForDate: error', error)
    throw error
  }
}

// ── removeStaffFromShift ───────────────────────────────────────────────────
// Removes a staff member from both early and late shifts on a given date.
// Called by: leave approval, cancellation approval.
//
// fromLeave flag — when true, also supersedes any active cancel record
// for that date so the UI shows one clean state (leave wins).
export async function removeStaffFromShift(
  staffId,
  dateStr,
  homeId,
  orgId,
  { fromLeave = false } = {}
) {
  if (!staffId || !dateStr || !homeId || !orgId) {
    console.error('removeStaffFromShift: missing required arguments', {
      staffId,
      dateStr,
      homeId,
      orgId,
    })
    return
  }

  const mondayKey = getMondayKey(dateStr)
  const dayIdx = getDayIndex(dateStr)

  const { data, error } = await supabase
    .from('rotapp_month_rota')
    .select('rota_data')
    .eq('home_id', homeId)
    .eq('org_id', orgId)
    .eq('week_key', mondayKey)
    .maybeSingle()

  if (error) {
    console.error('removeStaffFromShift: fetch error', error)
    throw error
  }

  // No rota for this week — nothing to remove from rota
  // but still supersede cancel if fromLeave
  if (data) {
    const rota = JSON.parse(JSON.stringify(data.rota_data))

    if (rota.early?.[dayIdx]) {
      rota.early[dayIdx] = rota.early[dayIdx].filter((s) => s.id !== staffId)
    }
    if (rota.late?.[dayIdx]) {
      rota.late[dayIdx] = rota.late[dayIdx].filter((s) => s.id !== staffId)
    }

    const { error: upsertError } = await supabase
      .from('rotapp_month_rota')
      .update({ rota_data: rota, updated_at: new Date().toISOString() })
      .eq('home_id', homeId)
      .eq('org_id', orgId)
      .eq('week_key', mondayKey)

    if (upsertError) {
      console.error('removeStaffFromShift: upsert error', upsertError)
      throw upsertError
    }
  }

  // If called from a leave approval, supersede any active cancel record
  // for this date so only one state is shown on the calendar
  if (fromLeave) {
    await supersedeCancelForDate(staffId, dateStr, orgId)
  }
}

// ── addStaffToShift ────────────────────────────────────────────────────────
// Placeholder — will be implemented as part of the gap filling flow.
// Called by: gap filling (manager assigns staff to an open shift).
export async function addStaffToShift(
  staffId,
  shiftType,
  dateStr,
  homeId,
  orgId,
  sleepIn = false
) {
  throw new Error(
    'addStaffToShift: not yet implemented — coming in gap filling flow'
  )
}

// ── swapStaffBetweenShifts ─────────────────────────────────────────────────
// Placeholder — will be implemented as part of the shift swap rebuild.
// Called by: swap approval (manager approves a staff-initiated swap).
export async function swapStaffBetweenShifts(
  initiatorShift,
  targetShift,
  orgId
) {
  throw new Error(
    'swapStaffBetweenShifts: not yet implemented — coming in swap rebuild'
  )
}
