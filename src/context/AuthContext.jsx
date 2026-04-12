import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Build our app user object from Supabase session + profile row
  const buildUser = async (supabaseUser) => {
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
      console.error('Failed to fetch profile:', error)
      setUser(null)
      setLoading(false)
      return
    }

    // Block pending and suspended accounts
    if (profile.status === 'pending' || profile.status === 'suspended') {
      await supabase.auth.signOut()
      setUser({ blockedStatus: profile.status, email: profile.email })
      setLoading(false)
      return
    }

    setUser({
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
    })
    setLoading(false)
  }

  useEffect(() => {
    // Check for existing session on app load
    supabase.auth.getSession().then(({ data: { session } }) => {
      buildUser(session?.user ?? null)
    })

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      buildUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  // OL step-in — switches active role and home for the session only
  // homeId is the home the OL is stepping into
  const switchRole = (newRole, homeId) => {
    setUser((prev) => ({
      ...prev,
      activeRole: newRole,
      home: homeId,
      previousRole: prev.activeRole,
      previousHome: prev.home,
    }))
  }

  // Reverts OL back to their real role and home
  const revertRole = () => {
    setUser((prev) => ({
      ...prev,
      activeRole: prev.role,
      home: prev.previousHome,
      previousRole: null,
      previousHome: null,
    }))
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, switchRole, revertRole }}
    >
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
