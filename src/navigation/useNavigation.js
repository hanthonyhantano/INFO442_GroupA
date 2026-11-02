import { createContext, useContext } from 'react'
export const NavigationContext = createContext(null)
export function useNavigation() {
  const value = useContext(NavigationContext)
  if (!value) throw new Error('Navigation components require NavigationProvider')
  return value
}
