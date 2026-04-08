const TIME_OFF_KEY = 'rotapp_time_off'

// Helper: Convert date to local YYYY-MM-DD (no timezone issues)
function toLocalDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Get all time off records
export function getTimeOffRecords() {
  try {
    const stored = localStorage.getItem(TIME_OFF_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

// Get time off for a specific date
export function getTimeOffForDate(date) {
  const records = getTimeOffRecords()
  const dateStr = toLocalDateString(date)
  return records[dateStr] || []
}

// Get all time off for a specific staff member
export function getTimeOffForStaff(staffId) {
  const records = getTimeOffRecords()
  const result = []
  for (const [date, staffList] of Object.entries(records)) {
    staffList.forEach((record) => {
      if (record.staffId === staffId) {
        result.push({ ...record, date })
      }
    })
  }
  return result
}

// Add or update time off for a date
export function addTimeOff(date, timeOffEntry) {
  const records = getTimeOffRecords()
  const dateStr = toLocalDateString(date)

  if (!records[dateStr]) {
    records[dateStr] = []
  }

  // Check if already exists (prevent duplicates)
  const exists = records[dateStr].some((t) => t.id === timeOffEntry.id)
  if (!exists) {
    records[dateStr].push(timeOffEntry)
    localStorage.setItem(TIME_OFF_KEY, JSON.stringify(records))
  }

  return records[dateStr]
}

// Remove time off from a date
export function removeTimeOff(date, timeOffId) {
  const records = getTimeOffRecords()
  const dateStr = toLocalDateString(date)

  if (records[dateStr]) {
    records[dateStr] = records[dateStr].filter((t) => t.id !== timeOffId)
    if (records[dateStr].length === 0) {
      delete records[dateStr]
    }
    localStorage.setItem(TIME_OFF_KEY, JSON.stringify(records))
  }

  return records[dateStr] || []
}

// Generate unique ID
export function generateTimeOffId() {
  return `to_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Auto-migration from old rotapp_leave to new rotapp_time_off
export function migrateLeaveDataIfNeeded() {
  // Check if we've already migrated
  const hasMigrated = localStorage.getItem('rotapp_time_off_migrated')
  if (hasMigrated) return false

  // Get old leave data
  const oldLeave = localStorage.getItem('rotapp_leave')
  if (!oldLeave) {
    // Mark as migrated even if no data
    localStorage.setItem('rotapp_time_off_migrated', 'true')
    return false
  }

  const leaveData = JSON.parse(oldLeave)
  let migratedCount = 0

  for (const [staffId, dates] of Object.entries(leaveData)) {
    if (!Array.isArray(dates)) continue

    dates.forEach((dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      if (isNaN(date)) return

      // Check if already exists in new system
      const existingRecords = getTimeOffRecords()
      const existingForDate = existingRecords[dateStr] || []
      const alreadyExists = existingForDate.some((r) => r.staffId === staffId)

      if (!alreadyExists) {
        addTimeOff(date, {
          id: generateTimeOffId(),
          staffId: staffId,
          staffName: getStaffNameById(staffId),
          type: 'other',
          status: 'approved',
          approvedBy: 'System (auto-migrated)',
          approvedAt: new Date().toISOString(),
          notes: 'Migrated from legacy leave system',
        })
        migratedCount++
      }
    })
  }

  // Mark as migrated so this only runs once
  localStorage.setItem('rotapp_time_off_migrated', 'true')

  if (migratedCount > 0) {
    console.log(`✅ Auto-migrated ${migratedCount} leave records to new system`)
  }

  return migratedCount > 0
}
// Count pending time-off requests (for navbar badge)
export function getPendingTimeOffCount() {
  const records = getTimeOffRecords()
  let count = 0
  for (const entries of Object.values(records)) {
    entries.forEach((e) => {
      if (e.status === 'pending') count++
    })
  }
  return count
}
