import { useState } from 'react'

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (err) {
      console.error('useLocalStorage read error:', err)
      return initialValue
    }
  })

  const setValue = (value) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (err) {
      console.error('useLocalStorage write error:', err)
    }
  }

  const clearValue = () => {
    try {
      setStoredValue(initialValue)
      localStorage.removeItem(key)
    } catch (err) {
      console.error('useLocalStorage clear error:', err)
    }
  }

  return [storedValue, setValue, clearValue]
}
