import { supabase } from '../lib/supabase'

function generateId() {
  return `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ── Read helpers (operate on context array) ────────────────────────────────

export function getSwapsForStaff(swapArray, staffId) {
  return (swapArray || []).filter(
    (r) => r.initiator_id === staffId || r.target_id === staffId
  )
}

export function getPendingManagerSwaps(swapArray) {
  return (swapArray || []).filter((r) => r.status === 'awaiting_manager')
}

export function getPendingSwapCount(swapArray) {
  return getPendingManagerSwaps(swapArray).length
}

export function getSwapRequestById(swapArray, id) {
  return (swapArray || []).find((r) => r.id === id) || null
}

// ── Write (Supabase) ───────────────────────────────────────────────────────

export async function createSwapRequest({
  initiatorId,
  initiatorName,
  initiatorShift,
  targetId,
  targetName,
  targetShift,
  note,
  homeId,
  orgId,
}) {
  const newRequest = {
    id: generateId(),
    org_id: orgId,
    home_id: homeId,
    initiator_id: initiatorId,
    initiator_name: initiatorName,
    initiator_shift: initiatorShift,
    target_id: targetId,
    target_name: targetName,
    target_shift: targetShift,
    note: note || null,
    status: 'pending',
    created_at: new Date().toISOString(),
    target_responded_at: null,
    manager_note: null,
    resolved_by: null,
    resolved_at: null,
  }
  const { error } = await supabase
    .from('rotapp_swap_requests')
    .insert(newRequest)
  if (error) {
    console.error('createSwapRequest error:', error)
    throw error
  }
  return newRequest
}

export async function withdrawSwapRequest(id, initiatorId) {
  const { error } = await supabase
    .from('rotapp_swap_requests')
    .update({
      status: 'withdrawn',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('initiator_id', initiatorId)
    .eq('status', 'pending')
  if (error) {
    console.error('withdrawSwapRequest error:', error)
    throw error
  }
}

export async function declineSwapRequest(id, targetId) {
  const { error } = await supabase
    .from('rotapp_swap_requests')
    .update({
      status: 'declined',
      target_responded_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('target_id', targetId)
    .eq('status', 'pending')
  if (error) {
    console.error('declineSwapRequest error:', error)
    throw error
  }
}

export async function acceptSwapRequest(id, targetId) {
  const { error } = await supabase
    .from('rotapp_swap_requests')
    .update({
      status: 'awaiting_manager',
      target_responded_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('target_id', targetId)
    .eq('status', 'pending')
  if (error) {
    console.error('acceptSwapRequest error:', error)
    throw error
  }
}

export async function approveSwapRequest(id, managerName) {
  const { error } = await supabase
    .from('rotapp_swap_requests')
    .update({
      status: 'approved',
      resolved_by: managerName,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'awaiting_manager')
  if (error) {
    console.error('approveSwapRequest error:', error)
    throw error
  }
}

export async function rejectSwapRequest(id, managerName, note) {
  const { error } = await supabase
    .from('rotapp_swap_requests')
    .update({
      status: 'rejected',
      manager_note: note || null,
      resolved_by: managerName,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'awaiting_manager')
  if (error) {
    console.error('rejectSwapRequest error:', error)
    throw error
  }
}

// ── Rota mutation ──────────────────────────────────────────────────────────

// Called after manager approves — swaps the two staff in Supabase rota
export async function applySwapToRota(swapRequest, homeId, orgId) {
  const { initiator_id, initiator_shift, target_id, target_shift } = swapRequest

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

  function getDayIndex(dateStr, mondayKey) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const [my, mm, md] = mondayKey.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const monday = new Date(my, mm - 1, md)
    return Math.round((date - monday) / (1000 * 60 * 60 * 24))
  }

  const iMondayKey = getMondayKey(initiator_shift.date)
  const iDayIdx = getDayIndex(initiator_shift.date, iMondayKey)
  const tMondayKey = getMondayKey(target_shift.date)
  const tDayIdx = getDayIndex(target_shift.date, tMondayKey)

  // Fetch both weeks (may be the same week)
  const weekKeysToFetch = [...new Set([iMondayKey, tMondayKey])]
  const { data: rotaRows, error: fetchError } = await supabase
    .from('rotapp_month_rota')
    .select('week_key, rota_data')
    .eq('home_id', homeId)
    .eq('org_id', orgId)
    .in('week_key', weekKeysToFetch)

  if (fetchError) {
    console.error('applySwapToRota fetch error:', fetchError)
    throw fetchError
  }

  const rotaMap = {}
  ;(rotaRows || []).forEach((row) => {
    rotaMap[row.week_key] = JSON.parse(JSON.stringify(row.rota_data))
  })

  function removeFromShift(weekKey, shiftType, dayIdx, staffId) {
    if (!rotaMap[weekKey]?.[shiftType]?.[dayIdx]) return
    rotaMap[weekKey][shiftType][dayIdx] = rotaMap[weekKey][shiftType][
      dayIdx
    ].filter((s) => s.id !== staffId)
  }

  function addToShift(weekKey, shiftType, dayIdx, staffId, sleepIn) {
    if (!rotaMap[weekKey]?.[shiftType]?.[dayIdx]) return
    const already = rotaMap[weekKey][shiftType][dayIdx].some(
      (s) => s.id === staffId
    )
    if (!already) {
      rotaMap[weekKey][shiftType][dayIdx].push({
        id: staffId,
        sleepIn: sleepIn || false,
      })
    }
  }

  // Swap initiator out, target in — on initiator's shift
  removeFromShift(iMondayKey, initiator_shift.type, iDayIdx, initiator_id)
  addToShift(
    iMondayKey,
    initiator_shift.type,
    iDayIdx,
    target_id,
    initiator_shift.sleepIn
  )

  // Swap target out, initiator in — on target's shift
  removeFromShift(tMondayKey, target_shift.type, tDayIdx, target_id)
  addToShift(
    tMondayKey,
    target_shift.type,
    tDayIdx,
    initiator_id,
    target_shift.sleepIn
  )

  // Upsert both weeks back
  const upserts = weekKeysToFetch.map((wk) => ({
    home_id: homeId,
    org_id: orgId,
    week_key: wk,
    rota_data: rotaMap[wk],
    updated_at: new Date().toISOString(),
  }))

  const { error: upsertError } = await supabase
    .from('rotapp_month_rota')
    .upsert(upserts, { onConflict: 'home_id,week_key' })

  if (upsertError) {
    console.error('applySwapToRota upsert error:', upsertError)
    throw upsertError
  }
}
