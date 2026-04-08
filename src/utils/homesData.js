import { supabase } from '../lib/supabase'

export async function fetchHomes(userRole, userHome, userOrgId) {
  // Fetch homes + manager name + deputy name + active staff count
  const { data: homesData, error } = await supabase
    .from('homes')
    .select('*')
    .eq('org_id', userOrgId)

  if (error) {
    console.error('fetchHomes error:', error)
    return []
  }

  // For each home, fetch manager name, deputy name, active staff count
  const enriched = await Promise.all(
    homesData.map(async (home) => {
      const [managerRes, deputyRes, staffCountRes] = await Promise.all([
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
      ])

      return {
        ...home,
        manager: managerRes.data?.name || '—',
        deputy: deputyRes.data?.name || '—',
        totalStaff: staffCountRes.count || 0,
        shiftsThisWeek: 0, // populated after rota migration
        gaps: 0, // populated after rota migration
        compliance: null, // populated in Phase 2
      }
    })
  )

  // Managers/Deputies/Seniors only see their own home
  const singleHomeRoles = ['manager', 'deputy', 'senior']
  if (singleHomeRoles.includes(userRole)) {
    return enriched.filter((h) => h.id === userHome)
  }

  return enriched
}
