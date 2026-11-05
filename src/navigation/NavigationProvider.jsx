import { useState } from 'react'
import { NavigationContext } from './useNavigation'
import { readZip, saveZip } from './navigation'

// Supply live values here from the team's future auth/cart/data providers.
// undefined session = not integrated; null = confirmed signed out.
export function NavigationProvider({
  children,
  session,
  producer = null,
  counts = {},
  cartPackageCount = null,
  onSignOut,
}) {
  const [quantities, setQuantities] = useState({})
  const packageCount = Object.values(quantities).reduce((sum, n) => sum + n, 0)
  function addPackage(id, available) {
    if (!Number.isInteger(available) || available <= 0) return
    setQuantities((current) => ({
      ...current,
      [id]: Math.min(available, (current[id] ?? 0) + 1),
    }))
  }
  const [zip, setZip] = useState(() => {
    try {
      return readZip(window.localStorage)
    } catch {
      return ''
    }
  })
  function setDeliveryZip(value) {
    setZip(value)
    try {
      saveZip(window.localStorage, value)
    } catch {
      /* Session-only fallback. */
    }
  }
  return (
    <NavigationContext.Provider
      value={{
        zip,
        setDeliveryZip,
        session,
        producer,
        counts,
        quantities,
        addPackage,
        cartPackageCount: cartPackageCount ?? (packageCount || null),
        onSignOut,
      }}
    >
      {children}
    </NavigationContext.Provider>
  )
}
