// src/context/AuthContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// ── Step-in persistence keys ───────────────────────────────────
const STEP_IN_KEY = 'rotapp_step_in'

function saveStepIn(previousRole, previousHome, activeRole, home) {
  localStorage.setItem(
    STEP_IN_KEY,
    JSON.stringify({ previousRole, previousHome, activeRole, home })
  )
}

function loadStepIn() {
  try {
    const raw = localStorage.getItem(STEP_IN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function clearStepIn() {
  localStorage.removeItem(STEP_IN_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Build our app user object from Supabase session + profile row
  const buildUser = useCallback(async (supabaseUser) => {
    if (!supabaseUser) {
      setUser(null)
      setLoading(false)
      return
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .single()

    if (error || !profile) {
      console.warn('Profile not found — signing out:', supabaseUser.id)
      await supabase.auth.signOut()
      setUser(null)
      setLoading(false)
      return
    }

    if (profile.status === 'pending' || profile.status === 'suspended') {
      await supabase.auth.signOut()
      setUser({ blockedStatus: profile.status, email: profile.email })
      setLoading(false)
      return
    }

    const emailVerified = !!supabaseUser.email_confirmed_at

    const baseUser = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      activeRole: profile.active_role || profile.role,
      home: profile.home,
      status: profile.status,
      gender: profile.gender,
      driver: profile.driver,
      org_id: profile.org_id,
      contract_type: profile.contract_type,
      contracted_hours: profile.contracted_hours,
      avatar_url: profile.avatar_url || null,
      emailVerified,
    }

    const stepIn = loadStepIn()
    if (stepIn && stepIn.previousRole) {
      setUser({
        ...baseUser,
        activeRole: stepIn.activeRole,
        home: stepIn.home,
        previousRole: stepIn.previousRole,
        previousHome: stepIn.previousHome,
      })
    } else {
      setUser(baseUser)
    }

    setLoading(false)
  }, [])

  // ── refreshUser ────────────────────────────────────────────────
  // Re-fetches the profile for the current session and updates user state.
  // Call this after any operation that changes the user's profile row
  // (e.g. linkUserToOrg, linkUserToHome).
  const refreshUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user) await buildUser(session.user)
  }, [buildUser])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      buildUser(session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      buildUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [buildUser])

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const logout = async () => {
    clearStepIn()
    await supabase.auth.signOut()
    setUser(null)
  }

  const switchRole = (newRole, homeId) => {
    setUser((prev) => {
      const updated = {
        ...prev,
        activeRole: newRole,
        home: homeId,
        previousRole: prev.activeRole,
        previousHome: prev.home,
      }
      saveStepIn(prev.activeRole, prev.home, newRole, homeId)
      return updated
    })
  }

  const revertRole = () => {
    clearStepIn()
    setUser((prev) => ({
      ...prev,
      activeRole: prev.role,
      home: prev.previousHome,
      previousRole: null,
      previousHome: null,
    }))
  }

  // ── updateUser ─────────────────────────────────────────────────
  // Shallow-merges updates into the current user object in memory.
  // Use this after any DB write that changes the user's profile row
  // when you don't want to trigger a full profile re-fetch.
  const updateUser = (updates) => {
    setUser((prev) => ({ ...prev, ...updates }))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        switchRole,
        revertRole,
        refreshUser,
        updateUser,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
