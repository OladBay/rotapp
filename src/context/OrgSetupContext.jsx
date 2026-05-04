// src/context/OrgSetupContext.jsx
// ── Single owner of org setup wizard state ─────────────────────────────────
// Fetches and exposes org setup record.
// ProtectedRoute reads isOrgWizardComplete from here.
// The org wizard reads and writes through here.
// Re-fetches automatically when user.org_id changes.
//
// LOADING RULE: orgSetupLoading is only true on the very first fetch
// (when orgSetup is null and we have no data yet). Subsequent re-fetches
// triggered by user.org_id changes run silently — they never set
// orgSetupLoading = true. This prevents OrgSetupWizard from hitting its
// `if (orgSetupLoading) return null` guard mid-session, which would unmount
// the wizard and reset all local step state.

import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import { fetchOrgSetup, initOrgSetup } from '../utils/orgSetup'

const OrgSetupContext = createContext(null)

export function OrgSetupProvider({ children }) {
  const { user } = useAuth()

  const [orgSetup, setOrgSetup] = useState(null)
  const [orgSetupLoading, setOrgSetupLoading] = useState(true)
  const [orgName, setOrgName] = useState('')

  // Track whether we have ever completed a fetch successfully.
  // Once true, subsequent re-fetches never touch orgSetupLoading.
  const hasLoadedOnce = useRef(false)

  // ── fetchAll ───────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user?.org_id) {
      setOrgSetup(null)
      setOrgName('')
      // Mark as loaded and clear loading state — even with no org_id,
      // this counts as a completed fetch. This prevents the next fetch
      // (when org_id is set after Step 1 save) from setting loading = true.
      hasLoadedOnce.current = true
      setOrgSetupLoading(false)
      return
    }

    // First load: show loading spinner so the rest of the app waits.
    // Subsequent loads (e.g. after linkUserToOrg updates user.org_id):
    // fetch silently — never unmount the wizard by setting loading = true.
    if (!hasLoadedOnce.current) {
      setOrgSetupLoading(true)
    }

    const [setup, orgRes] = await Promise.all([
      fetchOrgSetup(user.org_id),
      supabase.from('orgs').select('name').eq('id', user.org_id).single(),
    ])

    setOrgSetup(setup)
    setOrgName(orgRes.data?.name || '')

    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true
      setOrgSetupLoading(false)
    }
  }, [user?.org_id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── refreshOrgSetup ────────────────────────────────────────────────────
  // Called by the wizard after every step save so context stays in sync.
  // Always runs silently — never sets loading state.
  const refreshOrgSetup = useCallback(async () => {
    if (!user?.org_id) return
    const [setup, orgRes] = await Promise.all([
      fetchOrgSetup(user.org_id),
      supabase.from('orgs').select('name').eq('id', user.org_id).single(),
    ])
    setOrgSetup(setup)
    setOrgName(orgRes.data?.name || '')
  }, [user?.org_id])

  // ── initSetup ──────────────────────────────────────────────────────────
  // Called when the wizard launches for the first time.
  // Creates the org_setup row if it doesn't exist yet.
  const initSetup = useCallback(
    async (orgId) => {
      if (!orgId) return
      if (orgSetup) return
      await initOrgSetup(orgId)
      const setup = await fetchOrgSetup(orgId)
      setOrgSetup(setup)
    },
    [orgSetup]
  )

  // ── Derived state ──────────────────────────────────────────────────────
  const isOrgWizardComplete = orgSetup?.is_complete === true
  const orgWizardStep = orgSetup?.wizard_step || 0
  const orgConfig = orgSetup?.config || {}

  return (
    <OrgSetupContext.Provider
      value={{
        // State
        orgSetup,
        orgSetupLoading,
        orgName,
        // Derived
        isOrgWizardComplete,
        orgWizardStep,
        orgConfig,
        // Actions
        initSetup,
        refreshOrgSetup,
      }}
    >
      {children}
    </OrgSetupContext.Provider>
  )
}

export function useOrgSetup() {
  const ctx = useContext(OrgSetupContext)
  if (!ctx) throw new Error('useOrgSetup must be used inside OrgSetupProvider')
  return ctx
}
