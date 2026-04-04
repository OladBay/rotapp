// UK bank holidays - fetches from GOV.UK API, no hardcoding
import { toLocalDateString } from './dateUtils'

const BANK_HOLIDAY_CACHE_KEY = 'rotapp_bank_holidays_cache'
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function fetchBankHolidays() {
  // Check cache first
  const cached = localStorage.getItem(BANK_HOLIDAY_CACHE_KEY)
  if (cached) {
    const { data, timestamp } = JSON.parse(cached)
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data
    }
  }

  try {
    const response = await fetch('https://www.gov.uk/bank-holidays.json')
    const data = await response.json()

    // Extract England & Wales holidays (primary for care homes)
    const holidays = data['england-and-wales'].events.map((event) => ({
      date: event.date,
      name: event.title,
      notes: event.notes,
    }))

    // Store in cache
    localStorage.setItem(
      BANK_HOLIDAY_CACHE_KEY,
      JSON.stringify({
        data: holidays,
        timestamp: Date.now(),
      })
    )

    return holidays
  } catch (error) {
    console.error('Failed to fetch bank holidays:', error)
    // Return empty array - no fallback hardcoding
    return []
  }
}

export function getBankHolidayForDate(date, bankHolidays) {
  if (!date || !bankHolidays) return null
  // FIXED: Use toLocalDateString instead of toISOString
  const dateStr = toLocalDateString(date)
  return bankHolidays.find((h) => h.date === dateStr)
}
