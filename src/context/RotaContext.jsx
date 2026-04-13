import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

const RotaContext = createContext(null)

export function RotaProvider({ children }) {
  const { user } = useAuth()

  // ── State ──────────────────────────────────────────────────────────────
  const [staff, setStaff] = useState([])
  const [staffMap, setStaffMap] = useState({})
  const [staffLoading, setStaffLoading] = useState(true)
  const [monthRota, setMonthRotaState] = useState({})
  const [rotaLoading, setRotaLoading] = useState(true)
  const [timeOff, setTimeOffState] = useState([])
  const [timeOffLoading, setTimeOffLoading] = useState(true)
  const [cancelRequests, setCancelRequestsState] = useState([])
  const [cancelsLoading, setCancelsLoading] = useState(true)
  const [homes, setHomes] = useState([])
  const [homesLoading, setHomesLoading] = useState(true)
  const [moveRecords, setMoveRecords] = useState([])
  const [moveRecordsLoading, setMoveRecordsLoading] = useState(true)
  const [notifications, setNotifications] = useState([])
  const [notificationsLoading, setNotificationsLoading] = useState(true)

  // ── Parallel fetch all ─────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user?.org_id) return
    const [
      staffRes,
      rotaRes,
      timeOffRes,
      cancelsRes,
      homesRes,
      moveRecordsRes,
      notificationsRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('org_id', user.org_id)
        .neq('status', 'declined')
        .order('name', { ascending: true }),
      supabase
        .from('rotapp_month_rota')
        .select('week_key, rota_data')
        .eq('org_id', user.org_id)
        .eq('home_id', user.home),

      user.home
        ? supabase
            .from('rotapp_time_off')
            .select('*')
            .eq('org_id', user.org_id)
            .eq('home_id', user.home)
        : supabase
            .from('rotapp_time_off')
            .select('*')
            .eq('org_id', user.org_id),
      user.home
        ? supabase
            .from('rotapp_cancel_requests')
            .select('*')
            .eq('org_id', user.org_id)
            .eq('home_id', user.home)
            .order('requested_at', { ascending: false })
        : supabase
            .from('rotapp_cancel_requests')
            .select('*')
            .eq('org_id', user.org_id)
            .order('requested_at', { ascending: false }),

      supabase.from('homes').select('id, name').eq('org_id', user.org_id),

      supabase
        .from('staff_move_requests')
        .select('*')
        .eq('org_id', user.org_id)
        .order('initiated_at', { ascending: false }),

      supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (staffRes.error)
      console.error('RotaContext: staff fetch failed', staffRes.error)
    else {
      const staffData = staffRes.data || []
      setStaff(staffData)
      setStaffMap(Object.fromEntries(staffData.map((s) => [s.id, s])))
    }
    setStaffLoading(false)

    if (rotaRes.error)
      console.error('RotaContext: rota fetch failed', rotaRes.error)
    else {
      const rotas = {}
      ;(rotaRes.data || []).forEach((row) => {
        rotas[row.week_key] = row.rota_data
      })
      setMonthRotaState(rotas)
    }
    setRotaLoading(false)

    if (timeOffRes.error)
      console.error('RotaContext: timeOff fetch failed', timeOffRes.error)
    else setTimeOffState(timeOffRes.data || [])
    setTimeOffLoading(false)

    if (cancelsRes.error)
      console.error('RotaContext: cancels fetch failed', cancelsRes.error)
    else setCancelRequestsState(cancelsRes.data || [])
    setCancelsLoading(false)

    if (homesRes.error)
      console.error('RotaContext: homes fetch failed', homesRes.error)
    else setHomes(homesRes.data || [])
    setHomesLoading(false)

    if (moveRecordsRes.error)
      console.error(
        'RotaContext: moveRecords fetch failed',
        moveRecordsRes.error
      )
    else setMoveRecords(moveRecordsRes.data || [])
    setMoveRecordsLoading(false)

    if (notificationsRes.error)
      console.error(
        'RotaContext: notifications fetch failed',
        notificationsRes.error
      )
    else setNotifications(notificationsRes.data || [])
    setNotificationsLoading(false)
  }, [user?.org_id, user?.home, user?.id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Individual refresh functions ───────────────────────────────────────
  const refreshMonthRota = useCallback(async () => {
    if (!user?.org_id || !user?.home) return
    const { data, error } = await supabase
      .from('rotapp_month_rota')
      .select('week_key, rota_data')
      .eq('org_id', user.org_id)
      .eq('home_id', user.home)
    if (error) {
      console.error('RotaContext: rota refresh failed', error)
      return
    }
    const rotas = {}
    ;(data || []).forEach((row) => {
      rotas[row.week_key] = row.rota_data
    })
    setMonthRotaState(rotas)
  }, [user?.org_id, user?.home])

  const refreshTimeOff = useCallback(async () => {
    if (!user?.org_id) return
    let query = supabase
      .from('rotapp_time_off')
      .select('*')
      .eq('org_id', user.org_id)
    if (user.home) query = query.eq('home_id', user.home)
    const { data, error } = await query
    if (error) {
      console.error('RotaContext: timeOff refresh failed', error)
      return
    }
    setTimeOffState(data || [])
  }, [user?.org_id, user?.home])

  const refreshCancels = useCallback(async () => {
    if (!user?.org_id) return
    let query = supabase
      .from('rotapp_cancel_requests')
      .select('*')
      .eq('org_id', user.org_id)
      .order('requested_at', { ascending: false })
    if (user.home) query = query.eq('home_id', user.home)
    const { data, error } = await query
    if (error) {
      console.error('RotaContext: cancels refresh failed', error)
      return
    }
    setCancelRequestsState(data || [])
  }, [user?.org_id, user?.home])
  const refreshMoveRecords = useCallback(async () => {
    if (!user?.org_id) return
    const { data, error } = await supabase
      .from('staff_move_requests')
      .select('*')
      .eq('org_id', user.org_id)
      .order('initiated_at', { ascending: false })
    if (error) {
      console.error('RotaContext: moveRecords refresh failed', error)
      return
    }
    setMoveRecords(data || [])
  }, [user?.org_id])

  const refreshNotifications = useCallback(async () => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('RotaContext: notifications refresh failed', error)
      return
    }
    setNotifications(data || [])
  }, [user?.id])

  // ── setMonthRota (write + optimistic update) ───────────────────────────
  const setMonthRota = useCallback(
    async (updater) => {
      const next = typeof updater === 'function' ? updater(monthRota) : updater
      setMonthRotaState(next)
      const upserts = Object.entries(next).map(([week_key, rota_data]) => ({
        home_id: user.home,
        org_id: user.org_id,
        week_key,
        rota_data,
        updated_at: new Date().toISOString(),
      }))
      if (upserts.length === 0) return
      const { error } = await supabase
        .from('rotapp_month_rota')
        .upsert(upserts, { onConflict: 'home_id,week_key' })
      if (error) {
        console.error('RotaContext: failed to save month rota', error)
        refreshMonthRota()
      }
    },
    [monthRota, user?.home, user?.org_id, refreshMonthRota]
  )

  const resetRota = useCallback(async () => {
    setMonthRotaState({})
    const { error } = await supabase
      .from('rotapp_month_rota')
      .delete()
      .eq('home_id', user.home)
      .eq('org_id', user.org_id)
    if (error) {
      console.error('RotaContext: failed to reset rota', error)
    }
  }, [user?.home, user?.org_id])

  return (
    <RotaContext.Provider
      value={{
        // Staff
        staff,
        staffMap,
        staffLoading,
        // Month rota
        monthRota,
        setMonthRota,
        resetRota,
        rotaLoading,
        refreshMonthRota,
        // Time off
        timeOff,
        timeOffLoading,
        refreshTimeOff,
        // Cancel requests
        cancelRequests,
        cancelsLoading,
        refreshCancels,
        // Homes
        homes,
        homesLoading,
        homeName: homes.find((h) => h.id === user?.home)?.name || null,
        // Move records
        moveRecords,
        moveRecordsLoading,
        refreshMoveRecords,
        // Notifications
        notifications,
        notificationsLoading,
        refreshNotifications,
      }}
    >
      {children}
    </RotaContext.Provider>
  )
}

export function useRota() {
  const ctx = useContext(RotaContext)
  if (!ctx) throw new Error('useRota must be used inside RotaProvider')
  return ctx
}
