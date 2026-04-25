// src/context/HomeConfigContext.jsx
// ── Single owner of home config state ─────────────────────────────────────
// Fetches and exposes home config, shifts, shift rules, and home name.
// ProtectedRoute reads isWizardComplete from here.
// The wizard reads and writes through here.
// Re-fetches automatically when user.home changes (OL step-in).

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import {
  fetchHomeConfig,
  fetchHomeShifts,
  fetchHomeShiftRules,
  initHomeConfig,
} from '../utils/homeConfig'

const HomeConfigContext = createContext(null)

export function HomeConfigProvider({ children }) {
  const { user } = useAuth()

  const [homeConfig, setHomeConfig] = useState(null)
  const [homeShifts, setHomeShifts] = useState([])
  const [homeShiftRules, setHomeShiftRules] = useState([])
  const [homeName, setHomeName] = useState(null)
  const [configLoading, setConfigLoading] = useState(true)

  // ── fetchAll ───────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user?.home) {
      setHomeConfig(null)
      setHomeShifts([])
      setHomeShiftRules([])
      setHomeName(null)
      setConfigLoading(false)
      return
    }

    setConfigLoading(true)

    const [config, shifts, rules, homeRes] = await Promise.all([
      fetchHomeConfig(user.home),
      fetchHomeShifts(user.home),
      fetchHomeShiftRules(user.home),
      supabase.from('homes').select('name').eq('id', user.home).single(),
    ])

    setHomeConfig(config)
    setHomeShifts(shifts)
    setHomeShiftRules(rules)
    setHomeName(homeRes.data?.name || null)
    setConfigLoading(false)
  }, [user?.home])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── refreshConfig ──────────────────────────────────────────────────────
  // Called by the wizard after every step save so context stays in sync.
  const refreshConfig = useCallback(async () => {
    if (!user?.home) return

    const [config, shifts, rules, homeRes] = await Promise.all([
      fetchHomeConfig(user.home),
      fetchHomeShifts(user.home),
      fetchHomeShiftRules(user.home),
      supabase.from('homes').select('name').eq('id', user.home).single(),
    ])

    setHomeConfig(config)
    setHomeShifts(shifts)
    setHomeShiftRules(rules)
    setHomeName(homeRes.data?.name || null)
  }, [user?.home])

  // ── initConfig ─────────────────────────────────────────────────────────
  // Called when the wizard launches for the first time.
  // Creates the home_config row if it doesn't exist yet.
  const initConfig = useCallback(async () => {
    if (!user?.home || !user?.org_id) return
    if (homeConfig) return
    await initHomeConfig(user.home, user.org_id)
    await refreshConfig()
  }, [user?.home, user?.org_id, homeConfig, refreshConfig])

  // ── Derived state ──────────────────────────────────────────────────────
  const isWizardComplete = homeConfig?.is_complete === true
  const wizardStep = homeConfig?.wizard_step || 0
  const config = homeConfig?.config || {}

  return (
    <HomeConfigContext.Provider
      value={{
        // State
        homeConfig,
        homeShifts,
        homeShiftRules,
        homeName,
        configLoading,
        // Derived
        isWizardComplete,
        wizardStep,
        config,
        // Actions
        initConfig,
        refreshConfig,
      }}
    >
      {children}
    </HomeConfigContext.Provider>
  )
}

export function useHomeConfig() {
  const ctx = useContext(HomeConfigContext)
  if (!ctx)
    throw new Error('useHomeConfig must be used inside HomeConfigProvider')
  return ctx
}
