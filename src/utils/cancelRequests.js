// ===== /Users/emmanueloladokun/Projects/rotapp/src/utils/cancelRequests.js =====

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

// Add a new cancellation request
export function addRequest(request) {
  const requests = loadRequests()
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
