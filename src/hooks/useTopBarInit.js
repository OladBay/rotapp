// src/hooks/useTopBarInit.js
import { useEffect } from 'react'
import { useTopBar } from '../context/TopBarContext'

// ── useTopBarInit ──────────────────────────────────────────────
// Call this at the top of any page component to set the top bar
// title and subtitle. Re-runs whenever title or subtitle changes
// so week navigation updates the top bar automatically.

export function useTopBarInit(title, subtitle) {
  const { setTopBar } = useTopBar()

  useEffect(() => {
    setTopBar({ title, subtitle: subtitle || '' })
  }, [title, subtitle])
}
