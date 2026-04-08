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

  // ── Staff ──────────────────────────────────────────────────────────────
  const [staff, setStaff] = useState([])
  const [staffMap, setStaffMap] = useState({})
  const [staffLoading, setStaffLoading] = useState(true)

  useEffect(() => {
    if (!user?.org_id) return
    setStaffLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('org_id', user.org_id)
      .neq('status', 'declined')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('RotaContext: failed to load staff', error)
          setStaffLoading(false)
          return
        }
        const staffData = data || []
        setStaff(staffData)
        setStaffMap(Object.fromEntries(staffData.map((s) => [s.id, s])))
        setStaffLoading(false)
      })
  }, [user?.org_id])

  // ── Month rota ─────────────────────────────────────────────────────────
  const [monthRota, setMonthRotaState] = useState({})
  const [rotaLoading, setRotaLoading] = useState(true)

  const fetchMonthRota = useCallback(async () => {
    if (!user?.org_id || !user?.home) return
    setRotaLoading(true)
    const { data, error } = await supabase
      .from('rotapp_month_rota')
      .select('week_key, rota_data')
      .eq('org_id', user.org_id)
      .eq('home_id', user.home)
    if (error) {
      console.error('RotaContext: failed to load month rota', error)
      setRotaLoading(false)
      return
    }
    const rotas = {}
    ;(data || []).forEach((row) => {
      rotas[row.week_key] = row.rota_data
    })
    setMonthRotaState(rotas)
    setRotaLoading(false)
  }, [user?.org_id, user?.home])

  useEffect(() => {
    fetchMonthRota()
  }, [fetchMonthRota])

  const setMonthRota = useCallback(
    async (updater) => {
      const next = typeof updater === 'function' ? updater(monthRota) : updater
      // Optimistic update
      setMonthRotaState(next)
      // Persist each changed week to Supabase
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
        // Revert optimistic update on failure
        fetchMonthRota()
      }
    },
    [monthRota, user?.home, user?.org_id, fetchMonthRota]
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

  // ── Time off ───────────────────────────────────────────────────────────
  const [timeOff, setTimeOffState] = useState([])
  const [timeOffLoading, setTimeOffLoading] = useState(true)

  const fetchTimeOff = useCallback(async () => {
    if (!user?.org_id) return
    setTimeOffLoading(true)
    const { data, error } = await supabase
      .from('rotapp_time_off')
      .select('*')
      .eq('org_id', user.org_id)
    if (error) {
      console.error('RotaContext: failed to load time off', error)
      setTimeOffLoading(false)
      return
    }
    setTimeOffState(data || [])
    setTimeOffLoading(false)
  }, [user?.org_id])

  useEffect(() => {
    fetchTimeOff()
  }, [fetchTimeOff])

  const refreshTimeOff = useCallback(() => {
    fetchTimeOff()
  }, [fetchTimeOff])

  // ── Swap requests ──────────────────────────────────────────────────────
  const [swapRequests, setSwapRequestsState] = useState([])
  const [swapsLoading, setSwapsLoading] = useState(true)

  const fetchSwapRequests = useCallback(async () => {
    if (!user?.org_id) return
    setSwapsLoading(true)
    const { data, error } = await supabase
      .from('rotapp_swap_requests')
      .select('*')
      .eq('org_id', user.org_id)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('RotaContext: failed to load swap requests', error)
      setSwapsLoading(false)
      return
    }
    setSwapRequestsState(data || [])
    setSwapsLoading(false)
  }, [user?.org_id])

  useEffect(() => {
    fetchSwapRequests()
  }, [fetchSwapRequests])

  const refreshSwaps = useCallback(() => {
    fetchSwapRequests()
  }, [fetchSwapRequests])

  // ── Cancel requests ────────────────────────────────────────────────────
  const [cancelRequests, setCancelRequestsState] = useState([])
  const [cancelsLoading, setCancelsLoading] = useState(true)

  const fetchCancelRequests = useCallback(async () => {
    if (!user?.org_id) return
    setCancelsLoading(true)
    const { data, error } = await supabase
      .from('rotapp_cancel_requests')
      .select('*')
      .eq('org_id', user.org_id)
      .order('requested_at', { ascending: false })
    if (error) {
      console.error('RotaContext: failed to load cancel requests', error)
      setCancelsLoading(false)
      return
    }
    setCancelRequestsState(data || [])
    setCancelsLoading(false)
  }, [user?.org_id])

  useEffect(() => {
    fetchCancelRequests()
  }, [fetchCancelRequests])

  const refreshCancels = useCallback(() => {
    fetchCancelRequests()
  }, [fetchCancelRequests])

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
        refreshMonthRota: fetchMonthRota,
        // Time off
        timeOff,
        timeOffLoading,
        refreshTimeOff,
        // Swap requests
        swapRequests,
        swapsLoading,
        refreshSwaps,
        // Cancel requests
        cancelRequests,
        cancelsLoading,
        refreshCancels,
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
