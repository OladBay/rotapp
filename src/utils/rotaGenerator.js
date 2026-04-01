import { mockStaff } from '../data/mockRota'
import { getMonthWeeks, dateKey } from './dateUtils'

export function generateRota(availability) {
  const rota = { early: [], late: [], onCall: [] }

  const onCallPool = mockStaff
    .filter((s) => ['manager', 'deputy', 'senior'].includes(s.role))
    .map((s) => s.id)

  const shiftEligible = mockStaff.filter(
    (s) => !['manager', 'deputy'].includes(s.role)
  )

  for (let day = 0; day < 7; day++) {
    // Get available staff for each shift
    const earlyAvail = shiftEligible.filter((s) => {
      const av = availability[s.id]?.[day]
      return av === 'E' || av === 'B'
    })

    const lateAvail = shiftEligible.filter((s) => {
      const av = availability[s.id]?.[day]
      return av === 'L' || av === 'B'
    })

    // Pick early staff — aim for 3, prefer female + driver mix
    const earlyPick = pickStaff(earlyAvail, 3)

    // Pick late staff from remaining — aim for 3
    const usedInEarly = earlyPick.map((s) => s.id)
    const latePool = lateAvail.filter((s) => !usedInEarly.includes(s.id))
    const latePick = pickStaff(latePool.length >= 3 ? latePool : lateAvail, 3)

    // Assign sleep-ins — pick 2 from late shift, prefer permanent staff
    const lateWithSleep = assignSleepIns(latePick)

    rota.early.push(earlyPick.map((s) => ({ id: s.id, sleepIn: false })))
    rota.late.push(lateWithSleep)

    // On-call — pick 2 from manager/deputy/senior
    const onCallPick = shuffle([...onCallPool]).slice(0, 2)
    rota.onCall.push(onCallPick)
  }

  return rota
}

// Generate rota for every week in a given month.
// availability is the 7-day template (same shape as weekly generate).
// Returns { weekRotas: { [mondayKey]: rota }, weekViolations: { [mondayKey]: violations }, weeks: Date[] }
export function generateMonthRota(year, month, availability, staffMap) {
  const weeks = getMonthWeeks(year, month)
  const weekRotas = {}
  const weekViolations = {}

  weeks.forEach((monday) => {
    const rota = generateRota(availability)
    const violations = checkViolations(rota, staffMap)
    const key = dateKey(monday)
    weekRotas[key] = rota
    weekViolations[key] = violations
  })

  return { weekRotas, weekViolations, weeks }
}

function pickStaff(pool, target) {
  if (pool.length === 0) return []
  const shuffled = shuffle([...pool])
  const picked = shuffled.slice(0, target)

  // Soft rule checks — try to ensure female and driver
  const hasF = picked.some((s) => s.gender === 'F')
  const hasD = picked.some((s) => s.driver)

  if (!hasF) {
    const femaleInPool = shuffled.find(
      (s) => s.gender === 'F' && !picked.includes(s)
    )
    if (femaleInPool) picked[picked.length - 1] = femaleInPool
  }

  if (!hasD) {
    const driverInPool = shuffled.find((s) => s.driver && !picked.includes(s))
    if (driverInPool && picked.length >= 2)
      picked[picked.length - 1] = driverInPool
  }

  return picked.slice(0, target)
}

function assignSleepIns(staffList) {
  if (staffList.length < 2) {
    return staffList.map((s, i) => ({
      id: s.id,
      sleepIn: i < staffList.length,
    }))
  }

  // Prefer permanent staff (rcw/senior) for sleep-in
  const permanent = staffList.filter((s) => ['rcw', 'senior'].includes(s.role))
  const sleepInIds = new Set(
    permanent.length >= 2
      ? shuffle([...permanent])
          .slice(0, 2)
          .map((s) => s.id)
      : shuffle([...staffList])
          .slice(0, 2)
          .map((s) => s.id)
  )

  return staffList.map((s) => ({ id: s.id, sleepIn: sleepInIds.has(s.id) }))
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5)
}

export function checkViolations(rota, staffMap) {
  const violations = []

  for (let day = 0; day < 7; day++) {
    const early = rota.early?.[day] || []
    const late = rota.late?.[day] || []
    const sleepIns = late.filter((e) => e.sleepIn)

    if (early.length < 3)
      violations.push({
        day,
        shift: 'Early',
        type: 'hard',
        message: `Day ${day + 1} Early: only ${early.length}/3 staff`,
      })

    if (late.length < 3)
      violations.push({
        day,
        shift: 'Late',
        type: 'hard',
        message: `Day ${day + 1} Late: only ${late.length}/3 staff`,
      })

    if (sleepIns.length !== 2)
      violations.push({
        day,
        shift: 'Sleep-in',
        type: 'hard',
        message: `Day ${day + 1}: ${sleepIns.length}/2 sleep-ins`,
      })

    const earlyHasF = early.some((e) => staffMap[e.id]?.gender === 'F')
    const lateHasF = late.some((e) => staffMap[e.id]?.gender === 'F')
    const earlyHasD = early.some((e) => staffMap[e.id]?.driver)
    const lateHasD = late.some((e) => staffMap[e.id]?.driver)

    if (!earlyHasF)
      violations.push({
        day,
        shift: 'Early',
        type: 'soft',
        message: `Day ${day + 1} Early: no female staff`,
      })
    if (!lateHasF)
      violations.push({
        day,
        shift: 'Late',
        type: 'soft',
        message: `Day ${day + 1} Late: no female staff`,
      })
    if (!earlyHasD)
      violations.push({
        day,
        shift: 'Early',
        type: 'soft',
        message: `Day ${day + 1} Early: no driver`,
      })
    if (!lateHasD)
      violations.push({
        day,
        shift: 'Late',
        type: 'soft',
        message: `Day ${day + 1} Late: no driver`,
      })
  }

  return violations
}
