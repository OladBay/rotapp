// World events - cultural, religious, and observances
// Format: { month, day, name, type, varies }
// month: 0-11 (Jan=0, Feb=1, etc.)
// day: 1-31
// varies: true for events that change year to year (Easter, Eid, etc.)
// type: cultural, religious, seasonal, awareness, bank

export const worldEvents = [
  // January
  { month: 0, day: 1, name: "New Year's Day", type: 'cultural' },
  { month: 0, day: 6, name: 'Epiphany', type: 'religious' },
  { month: 0, day: 25, name: 'Burns Night', type: 'cultural' },
  { month: 0, day: 26, name: 'Australia Day', type: 'cultural' },

  // February
  { month: 1, day: 2, name: 'Candlemas', type: 'religious' },
  { month: 1, day: 14, name: "Valentine's Day", type: 'cultural' },
  {
    month: 1,
    day: 21,
    name: 'International Mother Language Day',
    type: 'awareness',
  },

  // March
  { month: 2, day: 1, name: "St David's Day", type: 'cultural' },
  { month: 2, day: 8, name: "International Women's Day", type: 'awareness' },
  { month: 2, day: 17, name: "St Patrick's Day", type: 'cultural' },
  {
    month: 2,
    day: 19,
    name: "Mother's Day (UK varies)",
    type: 'cultural',
    varies: true,
  },
  { month: 2, day: 20, name: 'Spring Equinox', type: 'seasonal' },

  // April
  { month: 3, day: 1, name: "April Fools' Day", type: 'cultural' },
  { month: 3, day: 23, name: "St George's Day", type: 'cultural' },
  { month: 3, day: 22, name: 'Earth Day', type: 'awareness' },

  // May
  { month: 4, day: 1, name: 'May Day', type: 'cultural' },
  { month: 4, day: 12, name: "Nurses' Day", type: 'awareness' },
  {
    month: 4,
    day: 15,
    name: "Father's Day (UK varies)",
    type: 'cultural',
    varies: true,
  },

  // June
  { month: 5, day: 1, name: "Children's Day", type: 'awareness' },
  { month: 5, day: 21, name: 'Summer Solstice', type: 'seasonal' },

  // July
  {
    month: 6,
    day: 5,
    name: 'International Day of Cooperatives',
    type: 'awareness',
  },
  {
    month: 6,
    day: 12,
    name: "Battle of the Boyne (Orangemen's Day)",
    type: 'cultural',
  },

  // August
  { month: 7, day: 1, name: 'International Friendship Day', type: 'awareness' },
  { month: 7, day: 15, name: 'Assumption Day', type: 'religious' },

  // September
  { month: 8, day: 21, name: 'International Day of Peace', type: 'awareness' },
  { month: 8, day: 22, name: 'Autumn Equinox', type: 'seasonal' },
  { month: 8, day: 29, name: 'Michaelmas', type: 'religious' },

  // October
  { month: 9, day: 31, name: 'Halloween', type: 'cultural' },
  { month: 9, day: 5, name: "World Teachers' Day", type: 'awareness' },
  { month: 9, day: 31, name: 'Samhain', type: 'religious' },

  // November
  { month: 10, day: 1, name: "All Saints' Day", type: 'religious' },
  { month: 10, day: 2, name: "All Souls' Day", type: 'religious' },
  { month: 10, day: 5, name: 'Guy Fawkes Night', type: 'cultural' },
  { month: 10, day: 11, name: 'Remembrance Day', type: 'cultural' },
  { month: 10, day: 30, name: "St Andrew's Day", type: 'cultural' },

  // December
  { month: 11, day: 6, name: 'St Nicholas Day', type: 'religious' },
  { month: 11, day: 21, name: 'Winter Solstice', type: 'seasonal' },
  { month: 11, day: 24, name: 'Christmas Eve', type: 'cultural' },
  { month: 11, day: 25, name: 'Christmas Day', type: 'cultural' },
  { month: 11, day: 26, name: 'Boxing Day', type: 'cultural' },
  { month: 11, day: 31, name: "New Year's Eve", type: 'cultural' },

  // Varies events (will be shown with note)
  {
    month: null,
    day: null,
    name: 'Easter Sunday',
    type: 'religious',
    varies: true,
  },
  {
    month: null,
    day: null,
    name: 'Eid al-Fitr',
    type: 'religious',
    varies: true,
  },
  {
    month: null,
    day: null,
    name: 'Eid al-Adha',
    type: 'religious',
    varies: true,
  },
  { month: null, day: null, name: 'Diwali', type: 'religious', varies: true },
  { month: null, day: null, name: 'Hanukkah', type: 'religious', varies: true },
  {
    month: null,
    day: null,
    name: 'Rosh Hashanah',
    type: 'religious',
    varies: true,
  },
  {
    month: null,
    day: null,
    name: 'Yom Kippur',
    type: 'religious',
    varies: true,
  },
  {
    month: null,
    day: null,
    name: 'Chinese New Year',
    type: 'cultural',
    varies: true,
  },
]

// Helper function to get events for a specific date
export function getEventsForDate(date, bankHolidays = []) {
  const month = date.getMonth()
  const day = date.getDate()
  const year = date.getFullYear()

  // Get fixed-date events (these don't depend on year)
  const fixedEvents = worldEvents.filter(
    (event) => event.month === month && event.day === day && !event.varies
  )

  // Filter bank holidays for THIS SPECIFIC DATE only
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const bankHolidayEvents = bankHolidays
    .filter((bh) => bh.date === dateStr)
    .map((bh) => ({
      name: bh.name,
      type: 'bank',
      isBankHoliday: true,
      notes: bh.notes,
    }))

  return {
    fixed: fixedEvents,
    bank: bankHolidayEvents,
  }
}

// Get color for event type
export function getEventColor(type) {
  switch (type) {
    case 'bank':
      return '#e85c3d'
    case 'religious':
      return '#7a4fa8'
    case 'cultural':
      return '#3a8ac4'
    case 'awareness':
      return '#2ecc8a'
    case 'seasonal':
      return '#c4883a'
    default:
      return '#5d6180'
  }
}
