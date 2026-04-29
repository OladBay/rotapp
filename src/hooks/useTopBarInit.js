// src/hooks/useTopBarInit.js
import { useEffect, useRef } from 'react'
import { useTopBar } from '../context/TopBarContext'

export function useTopBarInit(title, subtitle, actions) {
  const { setTopBar } = useTopBar()
  const actionsRef = useRef(actions)

  useEffect(() => {
    actionsRef.current = actions
  })

  useEffect(() => {
    setTopBar({
      title: title || '',
      subtitle: subtitle || '',
      actions: actionsRef.current ?? null,
    })
  }, [title, subtitle, setTopBar])
}
