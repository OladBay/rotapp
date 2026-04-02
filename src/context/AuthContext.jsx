import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('rotapp_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const login = (userData) => {
    setUser(userData)
    localStorage.setItem('rotapp_user', JSON.stringify(userData))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('rotapp_user')
  }

  const switchRole = (role, home) => {
    const updated = {
      ...user,
      activeRole: role,
      activeHome: home,
      originalRole: user.role,
    }
    setUser(updated)
    localStorage.setItem('rotapp_user', JSON.stringify(updated))
  }

  const revertRole = () => {
    const updated = {
      ...user,
      activeRole: user.originalRole,
      activeHome: null,
      originalRole: null,
    }
    setUser(updated)
    localStorage.setItem('rotapp_user', JSON.stringify(updated))
  }

  return (
    <AuthContext.Provider
      value={{ user, login, logout, switchRole, revertRole }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
