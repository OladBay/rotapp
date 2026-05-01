// src/context/OrgSetupContext.jsx
// ── Single owner of org setup wizard state ─────────────────────────────────
// Fetches and exposes org setup record.
// ProtectedRoute reads isOrgWizardComplete from here.
// The org wizard reads and writes through here.
// Re-fetches automatically when user.org_id changes.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import { useAuth } from './AuthContext'
import { fetchOrgSetup, initOrgSetup } from '../utils/orgSetup'

const OrgSetupContext = createContext(null)

export function OrgSetupProvider({ children }) {
  const { user } = useAuth()

  const [orgSetup, setOrgSetup] = useState(null)
  const [orgSetupLoading, setOrgSetupLoading] = useState(true)

  // ── fetchAll ───────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user?.org_id) {
      setOrgSetup(null)
      setOrgSetupLoading(false)
      return
    }

    setOrgSetupLoading(true)

    const setup = await fetchOrgSetup(user.org_id)
    setOrgSetup(setup)
    setOrgSetupLoading(false)
  }, [user?.org_id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── refreshOrgSetup ────────────────────────────────────────────────────
  // Called by the wizard after every step save so context stays in sync.
  const refreshOrgSetup = useCallback(async () => {
    if (!user?.org_id) return
    const setup = await fetchOrgSetup(user.org_id)
    setOrgSetup(setup)
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
