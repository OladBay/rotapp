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

  const start = getMondayOfWeek(firstDay)
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
  if (!date || !(date instanceof Date) || isNaN(date)) {
    return ''
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
export function getMonthWeeks(year, month) {
  const mondays = []
  const seen = new Set()

  const allDates = getMonthDates(year, month)
  allDates.forEach((date) => {
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

// NEW: Get the Monday key that matches the generator's format
// The generator saves weeks with keys like "2026-04-05" (actual Monday dates)
// This ensures we look up the correct key in monthRota
export function getGeneratorMondayKey(date) {
  const d = new Date(date)
  const day = d.getDay()
  // Get the Monday of this week (0 = Sunday, so Monday is day 1)
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return dateKey(d)
}
