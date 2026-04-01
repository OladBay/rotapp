export function getWeekDates(mondayDate) {
  const dates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayDate)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }
  return dates
}

export function formatDate(date) {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatShort(date) {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

export function getDayLabel(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short' })
}

export function getMondayOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addWeeks(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n * 7)
  return d
}

export function getMonthDates(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Start from Monday of the first week
  const start = getMondayOfWeek(firstDay)
  // End on Sunday of the last week
  const end = new Date(lastDay)
  const endDay = end.getDay()
  if (endDay !== 0) end.setDate(end.getDate() + (7 - endDay))

  const dates = []
  const cur = new Date(start)
  while (cur <= end) {
    dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function dateKey(date) {
  return date.toISOString().split('T')[0]
}

// Returns array of 12 month descriptors for a given year
export function getYearMonths(year) {
  return Array.from({ length: 12 }, (_, i) => ({
    year,
    month: i,
    label: new Date(year, i, 1).toLocaleDateString('en-GB', { month: 'long' }),
    shortLabel: new Date(year, i, 1).toLocaleDateString('en-GB', {
      month: 'short',
    }),
  }))
}

// Returns array of Monday dates for all weeks that touch a given month.
// A week "belongs" to the month if its Monday falls in that month,
// or if any day of that week falls in that month (we use: Monday of each
// calendar row in getMonthDates that has at least one day in the month).
export function getMonthWeeks(year, month) {
  const mondays = []
  const seen = new Set()

  const allDates = getMonthDates(year, month)
  allDates.forEach((date) => {
    // Only include weeks anchored by days that actually belong to the month
    // so we don't generate rota for overflow padding days
    if (date.getMonth() !== month) return
    const mon = getMondayOfWeek(date)
    const key = dateKey(mon)
    if (!seen.has(key)) {
      seen.add(key)
      mondays.push(mon)
    }
  })

  return mondays
}
