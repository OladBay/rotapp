import { createContext, useContext, useState, useEffect } from 'react'
import { mockRota, mockStaff } from '../data/mockRota'

const RotaContext = createContext(null)

const STORAGE_KEY = 'rotapp_rota_v1'

export function RotaProvider({ children }) {
  const [rota, setRotaState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : mockRota
    } catch {
      return mockRota
    }
  })

  const [staff] = useState(mockStaff)

  // Auto-persist whenever rota changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rota))
  }, [rota])

  // Replace entire rota (used by GenerateModal)
  const setRota = (newRota) => setRotaState(newRota)

  // Add a staff member to a cell (shift = 'early' | 'late', dayIdx = 0–6)
  const addToCell = (shift, dayIdx, staffId, sleepIn = false) => {
    setRotaState((prev) => {
      const updated = { ...prev }
      const day = [...(prev[shift][dayIdx] || [])]
      if (day.find((e) => e.id === staffId)) return prev // already there
      day.push({ id: staffId, sleepIn })
      updated[shift] = prev[shift].map((d, i) => (i === dayIdx ? day : d))
      return updated
    })
  }

  // Remove a staff member from a cell
  const removeFromCell = (shift, dayIdx, staffId) => {
    setRotaState((prev) => {
      const updated = { ...prev }
      const day = (prev[shift][dayIdx] || []).filter((e) => e.id !== staffId)
      updated[shift] = prev[shift].map((d, i) => (i === dayIdx ? day : d))
      return updated
    })
  }

  // Toggle sleep-in tag on a late-shift staff member
  const toggleSleepIn = (dayIdx, staffId) => {
    setRotaState((prev) => {
      const late = (prev.late[dayIdx] || []).map((e) =>
        e.id === staffId ? { ...e, sleepIn: !e.sleepIn } : e
      )
      return {
        ...prev,
        late: prev.late.map((d, i) => (i === dayIdx ? late : d)),
      }
    })
  }

  // Reset rota to mock defaults (useful for dev / testing)
  const resetRota = () => {
    localStorage.removeItem(STORAGE_KEY)
    setRotaState(mockRota)
  }

  return (
    <RotaContext.Provider
      value={{
        rota,
        staff,
        setRota,
        addToCell,
        removeFromCell,
        toggleSleepIn,
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
