const SWAP_KEY = 'rotapp_swap_requests'

// ── Helpers ────────────────────────────────────────────────────────────────

function loadAll() {
  try {
    const stored = localStorage.getItem(SWAP_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveAll(requests) {
  try {
    localStorage.setItem(SWAP_KEY, JSON.stringify(requests))
  } catch {
    console.error('Failed to save swap requests')
  }
}

function generateId() {
  return `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ── Read ───────────────────────────────────────────────────────────────────

export function getSwapRequests() {
  return loadAll()
}

export function getSwapRequestById(id) {
  return loadAll().find((r) => r.id === id) || null
}

// All swaps where this staff is initiator OR target — for calendar badge
export function getSwapsForStaff(staffId) {
  return loadAll().filter(
    (r) => r.initiatorId === staffId || r.targetId === staffId
  )
}

// Pending swaps awaiting manager review (Staff C has accepted)
export function getPendingManagerSwaps() {
  return loadAll().filter((r) => r.status === 'awaiting_manager')
}

// Count for navbar badge
export function getPendingSwapCount() {
  return getPendingManagerSwaps().length
}

// ── Write ──────────────────────────────────────────────────────────────────

// Staff A submits a swap request
export function createSwapRequest({
  initiatorId,
  initiatorName,
  initiatorShift, // { date, type, sleepIn }
  targetId,
  targetName,
  targetShift, // { date, type, sleepIn }
  note,
}) {
  const requests = loadAll()
  const newRequest = {
    id: generateId(),
    initiatorId,
    initiatorName,
    initiatorShift, // snapshot at time of submission
    targetId,
    targetName,
    targetShift, // snapshot at time of submission
    note: note || null,
    status: 'pending', // pending → awaiting_manager → approved | rejected
    // pending → withdrawn (Staff A)
    // pending → declined (Staff C)
    createdAt: new Date().toISOString(),
    // Filled in as flow progresses:
    targetRespondedAt: null,
    managerNote: null,
    resolvedBy: null,
    resolvedAt: null,
  }
  requests.push(newRequest)
  saveAll(requests)
  return newRequest
}

// Staff A withdraws before Staff C responds
export function withdrawSwapRequest(id, initiatorId) {
  const requests = loadAll()
  const idx = requests.findIndex(
    (r) =>
      r.id === id && r.initiatorId === initiatorId && r.status === 'pending'
  )
  if (idx === -1) return null
  requests[idx] = {
    ...requests[idx],
    status: 'withdrawn',
    resolvedAt: new Date().toISOString(),
  }
  saveAll(requests)
  return requests[idx]
}

// Staff C declines
export function declineSwapRequest(id, targetId) {
  const requests = loadAll()
  const idx = requests.findIndex(
    (r) => r.id === id && r.targetId === targetId && r.status === 'pending'
  )
  if (idx === -1) return null
  requests[idx] = {
    ...requests[idx],
    status: 'declined',
    targetRespondedAt: new Date().toISOString(),
    resolvedAt: new Date().toISOString(),
  }
  saveAll(requests)
  return requests[idx]
}

// Staff C accepts — moves to awaiting manager
export function acceptSwapRequest(id, targetId) {
  const requests = loadAll()
  const idx = requests.findIndex(
    (r) => r.id === id && r.targetId === targetId && r.status === 'pending'
  )
  if (idx === -1) return null
  requests[idx] = {
    ...requests[idx],
    status: 'awaiting_manager',
    targetRespondedAt: new Date().toISOString(),
  }
  saveAll(requests)
  return requests[idx]
}

// Manager approves
export function approveSwapRequest(id, managerName) {
  const requests = loadAll()
  const idx = requests.findIndex(
    (r) => r.id === id && r.status === 'awaiting_manager'
  )
  if (idx === -1) return null
  requests[idx] = {
    ...requests[idx],
    status: 'approved',
    resolvedBy: managerName,
    resolvedAt: new Date().toISOString(),
  }
  saveAll(requests)
  return requests[idx]
}

// Manager rejects
export function rejectSwapRequest(id, managerName, note) {
  const requests = loadAll()
  const idx = requests.findIndex(
    (r) => r.id === id && r.status === 'awaiting_manager'
  )
  if (idx === -1) return null
  requests[idx] = {
    ...requests[idx],
    status: 'rejected',
    managerNote: note || null,
    resolvedBy: managerName,
    resolvedAt: new Date().toISOString(),
  }
  saveAll(requests)
  return requests[idx]
}

// ── Rota mutation ──────────────────────────────────────────────────────────

// Called after manager approves — swaps the two staff in monthRota
// Returns the updated monthRota object
export function applySwapToRota(swapRequest, monthRota) {
  const { initiatorId, initiatorShift, targetId, targetShift } = swapRequest
  const updated = JSON.parse(JSON.stringify(monthRota)) // deep clone

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

  function removeStaffFromShift(rota, mondayKey, shiftType, dayIdx, staffId) {
    if (!rota[mondayKey]) return
    const shiftArr = rota[mondayKey][shiftType]?.[dayIdx]
    if (!shiftArr) return
    rota[mondayKey][shiftType][dayIdx] = shiftArr.filter(
      (s) => s.id !== staffId
    )
  }

  function addStaffToShift(
    rota,
    mondayKey,
    shiftType,
    dayIdx,
    staffId,
    sleepIn
  ) {
    if (!rota[mondayKey]) return
    if (!rota[mondayKey][shiftType]) return
    if (!rota[mondayKey][shiftType][dayIdx]) return
    // Avoid duplicates
    const already = rota[mondayKey][shiftType][dayIdx].some(
      (s) => s.id === staffId
    )
    if (!already) {
      rota[mondayKey][shiftType][dayIdx].push({
        id: staffId,
        sleepIn: sleepIn || false,
      })
    }
  }

  const iMondayKey = getMondayKey(initiatorShift.date)
  const iDayIdx = getDayIndex(initiatorShift.date, iMondayKey)
  const tMondayKey = getMondayKey(targetShift.date)
  const tDayIdx = getDayIndex(targetShift.date, tMondayKey)

  // Remove initiator from their shift, add target
  removeStaffFromShift(
    updated,
    iMondayKey,
    initiatorShift.type,
    iDayIdx,
    initiatorId
  )
  addStaffToShift(
    updated,
    iMondayKey,
    initiatorShift.type,
    iDayIdx,
    targetId,
    initiatorShift.sleepIn
  )

  // Remove target from their shift, add initiator
  removeStaffFromShift(updated, tMondayKey, targetShift.type, tDayIdx, targetId)
  addStaffToShift(
    updated,
    tMondayKey,
    targetShift.type,
    tDayIdx,
    initiatorId,
    targetShift.sleepIn
  )

  return updated
}
