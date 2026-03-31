import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  const login = (userData) => {
    setUser(userData)
    localStorage.setItem('rotapp_user', JSON.stringify(userData))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('rotapp_user')
  }

  const switchRole = (role, home) => {
    setUser((prev) => ({
      ...prev,
      activeRole: role,
      activeHome: home,
      originalRole: prev.role,
    }))
  }

  const revertRole = () => {
    setUser((prev) => ({
      ...prev,
      activeRole: prev.originalRole,
      activeHome: null,
      originalRole: null,
    }))
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
