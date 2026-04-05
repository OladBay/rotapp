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

export function getGeneratorMondayKey(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return dateKey(d)
}

export function toLocalDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromLocalDateString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Returns all unique Monday-owned weeks across a month range.
// Each entry: { monday: Date, year: number, month: number, monthLabel: string }
// A week is owned by the month its Monday falls in — this is the
// single source of truth for both batch generation and skip logic.
export function getWeeksForRange(startYear, startMonth, endYear, endMonth) {
  const weeks = []
  const seen = new Set()

  let y = startYear
  let m = startMonth

  while (y < endYear || (y === endYear && m <= endMonth)) {
    const mondays = getMonthWeeks(y, m)
    mondays.forEach((monday) => {
      const key = dateKey(monday)
      if (!seen.has(key)) {
        seen.add(key)
        weeks.push({
          monday,
          year: y,
          month: m,
          monthLabel: new Date(y, m, 1).toLocaleDateString('en-GB', {
            month: 'long',
            year: 'numeric',
          }),
        })
      }
    })

    m++
    if (m > 11) {
      m = 0
      y++
    }
  }

  return weeks
}
