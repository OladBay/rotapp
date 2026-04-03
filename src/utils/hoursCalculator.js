import { getMonthWeeks, dateKey } from './dateUtils'

// Get shift hours based on shift type and day of week
// Early shift: always 7.5 hours
// Late shift: varies by day (Mon-Thu 9h, Fri-Sat 9.5h, Sun 9h)
export function getShiftHours(shift, date) {
  if (shift === 'early') return 7.5

  if (shift === 'late') {
    const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.

    // Monday (1) to Thursday (4) = 9 hours
    if (dayOfWeek >= 1 && dayOfWeek <= 4) return 9

    // Friday (5) or Saturday (6) = 9.5 hours
    if (dayOfWeek === 5 || dayOfWeek === 6) return 9.5

    // Sunday (0) = 9 hours
    return 9
  }

  return 0
}

// Calculate total hours for a staff member in a specific week
export function calculateStaffHoursForWeek(
  staffId,
  weekRota,
  weekStartDate,
  leaveData
) {
  let totalHours = 0

  // Guard clauses - return early if missing required data
  if (!weekRota || !weekStartDate || !leaveData) return totalHours
  if (!(weekStartDate instanceof Date) || isNaN(weekStartDate))
    return totalHours

  // Check each day of the week
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStartDate)
    date.setDate(weekStartDate.getDate() + dayOffset)

    // Skip if date is invalid
    if (isNaN(date)) continue

    // Skip if staff is on leave this day
    const dateStr = date.toISOString().split('T')[0]
    const leaveDates = leaveData[staffId] || []
    if (leaveDates.includes(dateStr)) continue

    // Check early shift
    const earlyShift = weekRota.early?.[dayOffset] || []
    const isOnEarly = earlyShift.some((entry) => entry && entry.id === staffId)
    if (isOnEarly) {
      totalHours += getShiftHours('early', date)
    }

    // Check late shift
    const lateShift = weekRota.late?.[dayOffset] || []
    const isOnLate = lateShift.some((entry) => entry && entry.id === staffId)
    if (isOnLate) {
      totalHours += getShiftHours('late', date)
    }
  }

  return totalHours
}

// Calculate total hours for a staff member in a specific month
export function calculateStaffHoursForMonth(
  staffId,
  year,
  month,
  monthRota,
  currentWeekRota,
  currentMonday,
  leaveData
) {
  let totalHours = 0

  // Guard clauses
  if (!monthRota || !leaveData) return totalHours
  if (typeof year !== 'number' || typeof month !== 'number') return totalHours

  // Get all weeks in this month
  const weeks = getMonthWeeks(year, month)

  // Guard against invalid weeks array
  if (!weeks || !Array.isArray(weeks) || weeks.length === 0) return totalHours

  // Sum hours across all weeks
  weeks.forEach((monday) => {
    // Guard against invalid monday date
    if (!monday || !(monday instanceof Date) || isNaN(monday)) return

    const key = dateKey(monday)
    if (!key) return

    // Get the rota for this week from monthRota
    let weekRotaData = monthRota[key]

    // If not found in monthRota, check if this is the current week we're viewing
    if (!weekRotaData && currentWeekRota && currentMonday) {
      const currentWeekKey = dateKey(currentMonday)
      if (key === currentWeekKey) {
        weekRotaData = currentWeekRota
      }
    }

    if (weekRotaData) {
      totalHours += calculateStaffHoursForWeek(
        staffId,
        weekRotaData,
        monday,
        leaveData
      )
    }
  })

  return totalHours
}

// Get number of weeks in a month (for contracted hours calculation)
export function getWeeksInMonth(year, month) {
  const weeks = getMonthWeeks(year, month)
  if (!weeks || !Array.isArray(weeks)) return 4 // Default to 4 weeks if calculation fails
  return weeks.length
}
