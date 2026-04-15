import { getMonthWeeks, dateKey } from './dateUtils'
import { getApprovedLeaveDates } from './timeOffStorage'

// Get shift hours based on shift type and day of week
// Early shift: always 7.5 hours
// Late shift: varies by day (Mon-Thu 9h, Fri-Sat 9.5h, Sun 9h)
// NOTE: These values are hardcoded and will be replaced when the rota
// generation rebuild reads shift times from the homes table.
export function getShiftHours(shift, date) {
  if (shift === 'early') return 7.5
  if (shift === 'late') {
    const dayOfWeek = date.getDay()
    if (dayOfWeek >= 1 && dayOfWeek <= 4) return 9
    if (dayOfWeek === 5 || dayOfWeek === 6) return 9.5
    return 9
  }
  return 0
}

// Calculate total hours for a staff member in a specific week.
// leaveDays — the full leaveDays array from RotaContext.
// Approved leave days are skipped when summing hours.
export function calculateStaffHoursForWeek(
  staffId,
  weekRota,
  weekStartDate,
  leaveDays
) {
  let totalHours = 0

  if (!weekRota || !weekStartDate) return totalHours
  if (!(weekStartDate instanceof Date) || isNaN(weekStartDate))
    return totalHours

  // Get approved leave date strings for this staff member
  const approvedLeaveDates = getApprovedLeaveDates(leaveDays || [], staffId)

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStartDate)
    date.setDate(weekStartDate.getDate() + dayOffset)
    if (isNaN(date)) continue

    const dateStr = date.toISOString().split('T')[0]

    // Skip if staff has approved leave on this day
    if (approvedLeaveDates.includes(dateStr)) continue

    // Early shift
    const earlyShift = weekRota.early?.[dayOffset] || []
    if (earlyShift.some((entry) => entry && entry.id === staffId)) {
      totalHours += getShiftHours('early', date)
    }

    // Late shift
    const lateShift = weekRota.late?.[dayOffset] || []
    if (lateShift.some((entry) => entry && entry.id === staffId)) {
      totalHours += getShiftHours('late', date)
    }
  }

  return totalHours
}

// Calculate total hours for a staff member in a specific month.
// leaveDays — the full leaveDays array from RotaContext.
export function calculateStaffHoursForMonth(
  staffId,
  year,
  month,
  monthRota,
  currentWeekRota,
  currentMonday,
  leaveDays
) {
  let totalHours = 0

  if (!monthRota) return totalHours
  if (typeof year !== 'number' || typeof month !== 'number') return totalHours

  const weeks = getMonthWeeks(year, month)
  if (!weeks || !Array.isArray(weeks) || weeks.length === 0) return totalHours

  weeks.forEach((monday) => {
    if (!monday || !(monday instanceof Date) || isNaN(monday)) return

    const key = dateKey(monday)
    if (!key) return

    let weekRotaData = monthRota[key]

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
        leaveDays
      )
    }
  })

  return totalHours
}

// Get number of weeks in a month
export function getWeeksInMonth(year, month) {
  const weeks = getMonthWeeks(year, month)
  if (!weeks || !Array.isArray(weeks)) return 4
  return weeks.length
}
