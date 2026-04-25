import { supabase } from '../lib/supabase'

// ── getMondayKey ───────────────────────────────────────────────────────────
// Returns the Monday-keyed week string (YYYY-MM-DD) for today.
// Matches the same logic used in rotaMutations.js.
function getTodayMondayKey() {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  const y = monday.getFullYear()
  const m = String(monday.getMonth() + 1).padStart(2, '0')
  const d = String(monday.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── calculateRotaStats ─────────────────────────────────────────────────────
// Given a rota_data object for one week, returns shiftsThisWeek and gaps.
// shiftsThisWeek = total staff-shift assignments across all 7 days (early + late).
// gaps = number of shift slots (day × shift type) with fewer than 3 staff.
function calculateRotaStats(rotaData) {
  if (!rotaData) return { shiftsThisWeek: 0, gaps: 0 }

  let shiftsThisWeek = 0
  let gaps = 0

  for (let day = 0; day < 7; day++) {
    const early = rotaData.early?.[day] || []
    const late = rotaData.late?.[day] || []

    shiftsThisWeek += early.length + late.length

    if (early.length < 3) gaps++
    if (late.length < 3) gaps++
  }

  return { shiftsThisWeek, gaps }
}

export async function fetchHomes(userRole, userHome, userOrgId) {
  const { data: homesData, error } = await supabase
    .from('homes')
    .select('*')
    .eq('org_id', userOrgId)

  if (error) {
    console.error('fetchHomes error:', error)
    return []
  }

  const weekKey = getTodayMondayKey()

  const enriched = await Promise.all(
    homesData.map(async (home) => {
      const [managerRes, deputyRes, staffCountRes, rotaRes] = await Promise.all(
        [
          supabase
            .from('profiles')
            .select('name')
            .eq('home', home.id)
            .eq('role', 'manager')
            .eq('status', 'active')
            .maybeSingle(),

          supabase
            .from('profiles')
            .select('name')
            .eq('home', home.id)
            .eq('role', 'deputy')
            .eq('status', 'active')
            .maybeSingle(),

          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('home', home.id)
            .eq('status', 'active'),

          supabase
            .from('rotapp_month_rota')
            .select('rota_data')
            .eq('home_id', home.id)
            .eq('org_id', userOrgId)
            .eq('week_key', weekKey)
            .maybeSingle(),
        ]
      )

      const { shiftsThisWeek, gaps } = calculateRotaStats(
        rotaRes.data?.rota_data || null
      )

      return {
        ...home,
        manager: managerRes.data?.name || '—',
        deputy: deputyRes.data?.name || '—',
        totalStaff: staffCountRes.count || 0,
        shiftsThisWeek,
        gaps,
        compliance: null,
      }
    })
  )

  const singleHomeRoles = ['manager', 'deputy', 'senior']
  if (singleHomeRoles.includes(userRole)) {
    return enriched.filter((h) => h.id === userHome)
  }

  return enriched
}

// ── createHome ─────────────────────────────────────────────────────────────
export async function createHome({ name, address, orgId }) {
  const { data, error } = await supabase
    .from('homes')
    .insert({
      name: name.trim(),
      address: address.trim(),
      org_id: orgId,
    })
    .select('id, name')
    .single()

  if (error) {
    console.error('createHome error:', error)
    throw error
  }

  return data
}
