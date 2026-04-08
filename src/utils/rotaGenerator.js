import { getMonthWeeks, dateKey, toLocalDateString } from './dateUtils'

// Build a Set of 'staffId_YYYY-MM-DD' keys from approved time-off entries
function buildAbsenceSet(timeOffArray = []) {
  const absent = new Set()
  try {
    timeOffArray.forEach((entry) => {
      if (entry.status === 'approved' && entry.staff_id && entry.date) {
        absent.add(`${entry.staff_id}_${entry.date}`)
      }
    })
  } catch (e) {
    console.warn('rotaGenerator: could not build absence set', e)
  }
  return absent
}

function isAbsent(staffId, date, absenceSet) {
  const dateStr = toLocalDateString(date) // timezone-safe
  return absenceSet.has(`${staffId}_${dateStr}`)
}

// Generate rota for a single week, date-aware
function generateWeekRota(monday, absenceSet, staffMap) {
  const rota = {
    early: [],
    late: [],
    onCall: [],
  }

  const allStaff = Object.values(staffMap)

  const onCallPool = allStaff.filter((s) =>
    ['manager', 'deputy', 'senior'].includes(s.role)
  )

  const shiftEligible = allStaff.filter(
    (s) => !['manager', 'deputy', 'relief'].includes(s.role)
  )

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + dayOffset)

    const earlyAvail = shiftEligible.filter((s) => {
      if (isAbsent(s.id, date, absenceSet)) return false
      return true
    })

    const earlyPick = pickStaff(earlyAvail, 3)
    const earlyIds = new Set(earlyPick.map((s) => s.id))

    const lateAvail = shiftEligible.filter((s) => {
      if (earlyIds.has(s.id)) return false
      if (isAbsent(s.id, date, absenceSet)) return false
      return true
    })

    const latePick = pickStaff(lateAvail, 3)
    const lateWithSleep = assignSleepIns(latePick)

    rota.early.push(earlyPick.map((s) => ({ id: s.id, sleepIn: false })))
    rota.late.push(lateWithSleep)

    const onCallPick = shuffle([...onCallPool.map((s) => s.id)]).slice(0, 2)
    rota.onCall.push(onCallPick)
  }

  return rota
}

export function generateMonthRota(year, month, staffMap, timeOffArray = []) {
  const weeks = getMonthWeeks(year, month)
  const weekRotas = {}
  const weekViolations = {}

  const absenceSet = buildAbsenceSet(timeOffArray)

  weeks.forEach((monday) => {
    const rota = generateWeekRota(monday, absenceSet, staffMap)
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
  const picked = shuffled.slice(0, Math.min(target, shuffled.length))

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
    if (driverInPool && picked.length >= 2) {
      picked[picked.length - 1] = driverInPool
    }
  }

  return picked.slice(0, target)
}

function assignSleepIns(staffList) {
  if (staffList.length === 0) return []
  if (staffList.length < 2) {
    return staffList.map((s, i) => ({ id: s.id, sleepIn: i === 0 }))
  }

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
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
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
