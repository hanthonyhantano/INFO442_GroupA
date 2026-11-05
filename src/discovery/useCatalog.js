import { useState, useEffect } from 'react'
import { useNavigation } from '../navigation/useNavigation'
import { loadCatalog, visibleCatalog } from './catalog'
export function useCatalog() {
  const { zip } = useNavigation()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    let current = true
    loadCatalog(zip)
      .then((data) => {
        if (current)
          setResult({ zip, attempt, data: visibleCatalog(data, zip) })
      })
      .catch(() => {
        if (current) setResult({ zip, attempt, error: true })
      })
    return () => {
      current = false
    }
  }, [zip, attempt])
  return {
    ...(result?.zip === zip && result.attempt === attempt ? result : {}),
    retry: () => setAttempt((n) => n + 1),
  }
}
