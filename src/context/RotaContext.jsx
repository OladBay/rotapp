import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

const RotaContext = createContext(null)

const STORAGE_KEY = 'rotapp_month_rota'

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

  // ── Month rota (localStorage — migrated to Supabase in Step 3) ─────────
  const [monthRota, setMonthRotaState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })

  const setMonthRota = (updater) => {
    setMonthRotaState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        console.error('RotaContext: failed to save monthRota')
      }
      return next
    })
  }

  const resetRota = () => {
    setMonthRotaState({})
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <RotaContext.Provider
      value={{
        staff,
        staffMap,
        staffLoading,
        monthRota,
        setMonthRota,
        resetRota,
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
