// Generate unique ID for cancellation requests
export function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Save requests to localStorage
export function saveRequests(requests) {
  localStorage.setItem('rotapp_cancel_requests', JSON.stringify(requests))
}

// Load requests from localStorage
export function loadRequests() {
  try {
    const stored = localStorage.getItem('rotapp_cancel_requests')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Add a new cancellation request (or update existing one)
export function addRequest(request) {
  const requests = loadRequests()

  // Check if there's already a request for this shift
  const existingIndex = requests.findIndex(
    (r) =>
      r.staffId === request.staffId &&
      r.shiftDate === request.shiftDate &&
      r.shiftType === request.shiftType
  )

  if (existingIndex !== -1) {
    // Update existing request back to pending
    const existingRequest = requests[existingIndex]
    const updatedRequest = {
      ...existingRequest,
      status: 'pending',
      requestedAt: new Date().toISOString(), // Update to new timestamp
      reason: request.reason,
      customReason: request.customReason || null,
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      managerNotes: null,
      withdrawnAt: null,
      // Preserve ping history but reset ping count? Or keep?
      // Keeping ping history but resetting ping count makes sense
      pingCount: 0,
      lastPingedAt: null,
      // Keep existing pingHistory for audit
    }
    requests[existingIndex] = updatedRequest
    saveRequests(requests)
    return updatedRequest
  }

  // No existing request - create new one
  const newRequest = {
    ...request,
    id: generateRequestId(),
    status: 'pending',
    requestedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    managerNotes: null,
    withdrawnAt: null,
    pingCount: 0,
    lastPingedAt: null,
    pingHistory: [],
  }
  requests.push(newRequest)
  saveRequests(requests)
  return newRequest
}

// Update an existing request
export function updateRequest(requestId, updates) {
  const requests = loadRequests()
  const index = requests.findIndex((r) => r.id === requestId)
  if (index !== -1) {
    requests[index] = { ...requests[index], ...updates }
    saveRequests(requests)
    return requests[index]
  }
  return null
}

// Get requests for a specific staff member
export function getStaffRequests(staffId) {
  const requests = loadRequests()
  return requests.filter((r) => r.staffId === staffId)
}

// Get pending requests for manager view
export function getPendingRequests() {
  const requests = loadRequests()
  return requests.filter((r) => r.status === 'pending')
}

// Get all requests (for history)
export function getAllRequests() {
  return loadRequests()
}

// Check if a shift already has a pending request
export function hasPendingRequest(staffId, shiftDate, shiftType) {
  const requests = loadRequests()
  return requests.some(
    (r) =>
      r.staffId === staffId &&
      r.shiftDate === shiftDate &&
      r.shiftType === shiftType &&
      r.status === 'pending'
  )
}

// Check if a shift has any request (for display)
export function getShiftRequest(staffId, shiftDate, shiftType) {
  const requests = loadRequests()
  return requests.find(
    (r) =>
      r.staffId === staffId &&
      r.shiftDate === shiftDate &&
      r.shiftType === shiftType
  )
}

// Count recent cancellation requests for a specific shift (pending + rejected, last 7 days)
export function countRecentRequestsForShift(
  staffId,
  shiftDate,
  shiftType,
  days = 7
) {
  const requests = loadRequests()
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const relevant = requests.filter(
    (r) =>
      r.staffId === staffId &&
      r.shiftDate === shiftDate &&
      r.shiftType === shiftType &&
      (r.status === 'pending' || r.status === 'rejected') &&
      new Date(r.requestedAt) >= cutoffDate
  )

  return relevant.length
}

// Check if staff has made multiple recent attempts (returns count and shouldShowWarning)
export function getRecentRequestWarning(staffId, shiftDate, shiftType) {
  const count = countRecentRequestsForShift(staffId, shiftDate, shiftType, 7)
  return {
    count,
    shouldWarn: count >= 3,
    message:
      count >= 3
        ? `⚠️ You've requested cancellation ${count} times recently`
        : null,
  }
}
// Ping a pending request (staff nudges manager)
export function pingRequest(requestId, staffId) {
  const requests = loadRequests()
  const index = requests.findIndex((r) => r.id === requestId)

  if (index === -1) return null

  const request = requests[index]

  // Validate: request must exist, be pending, and belong to this staff
  if (request.status !== 'pending') {
    console.warn(
      `Cannot ping request ${requestId}: status is ${request.status}`
    )
    return null
  }

  if (request.staffId !== staffId) {
    console.warn(`Cannot ping request ${requestId}: staffId mismatch`)
    return null
  }

  // Check ping limit (max 3)
  const currentPingCount = request.pingCount || 0
  if (currentPingCount >= 3) {
    console.warn(`Cannot ping request ${requestId}: max pings (3) reached`)
    return null
  }

  // Update request with ping data
  const now = new Date().toISOString()
  const updatedRequest = {
    ...request,
    pingCount: currentPingCount + 1,
    lastPingedAt: now,
    pingHistory: [...(request.pingHistory || []), { pingedAt: now }],
  }

  requests[index] = updatedRequest
  saveRequests(requests)

  // Simulated notification to manager
  console.log(
    `[SIMULATED] 🔔 PING from ${request.staffName} for shift ${request.shiftDate} ${request.shiftType}`
  )
  console.log(
    `[SIMULATED] Reason: ${request.reason === 'Other' ? request.customReason : request.reason}`
  )
  console.log(
    `[SIMULATED] This is ping #${currentPingCount + 1} for this request`
  )

  return updatedRequest
}

// Get ping info for a request (for UI display)
export function getPingInfo(request) {
  const pingCount = request.pingCount || 0
  const remainingPings = Math.max(0, 3 - pingCount)
  const canPing = request.status === 'pending' && remainingPings > 0

  return {
    pingCount,
    remainingPings,
    canPing,
    lastPingedAt: request.lastPingedAt || null,
    message:
      !canPing && request.status === 'pending'
        ? 'Maximum pings reached. Please contact manager directly.'
        : null,
  }
}
