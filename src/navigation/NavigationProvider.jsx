import { useState } from 'react'
import { NavigationContext } from './useNavigation'
import { readZip, saveZip } from './navigation'


// Supply live values here from the team's future auth/cart/data providers.
// undefined session = not integrated; null = confirmed signed out.
export function NavigationProvider({ children, session, producer = null, counts = {}, cartPackageCount = null, onSignOut }) {
  const [zip, setZip] = useState(() => {
    try { return readZip(window.localStorage) } catch { return '' }
  })
  function setDeliveryZip(value) {
    setZip(value)
    try { saveZip(window.localStorage, value) } catch { /* Session-only fallback. */ }
  }
  return <NavigationContext.Provider value={{ zip, setDeliveryZip, session, producer, counts, cartPackageCount, onSignOut }}>
    {children}
  </NavigationContext.Provider>
}
