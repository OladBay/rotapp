// src/context/TopBarContext.jsx
import { createContext, useContext, useState } from 'react'

const TopBarContext = createContext(null)

export function TopBarProvider({ children }) {
  const [topBar, setTopBar] = useState({
    title: '',
    subtitle: '',
    actions: null,
  })

  return (
    <TopBarContext.Provider value={{ topBar, setTopBar }}>
      {children}
    </TopBarContext.Provider>
  )
}

export function useTopBar() {
  return useContext(TopBarContext)
}
