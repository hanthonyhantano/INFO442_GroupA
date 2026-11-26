import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useNavigation } from '../navigation/useNavigation'
import { supabase } from '../lib/supabase'

// The signed-in producer's profile row ({ id, name, role, farm_id }).
const ProducerContext = createContext(null)
export const useProducer = () => useContext(ProducerContext)

// Guards /producer, following the NavigationProvider session conventions:
// - session undefined = auth not wired up (tests, sample walkthrough): let through
// - session null      = confirmed signed out: ProducerLayout redirects to /sign-in
// - anonymous shopper = not a producer: send to /sign-in
// - signed-in user with no farm: send to /apply
export default function RequireProducer({ children }) {
  const { session } = useNavigation()
  const user = session?.user
  const userId = user && !user.is_anonymous ? user.id : null

  // undefined = loading, null = no profile row
  const [profile, setProfile] = useState(undefined)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setProfile(undefined)
    supabase
      .from('profiles')
      .select('id, name, role, farm_id')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Loading profile failed:', error)
        setProfile(data ?? null)
      })
    return () => { cancelled = true }
  }, [userId])

  if (user?.is_anonymous) return <Navigate to="/sign-in" replace />

  // No real signed-in user to check (not wired up, or signed out): let
  // ProducerLayout decide, exactly as before this guard existed.
  if (!userId) return <ProducerContext.Provider value={null}>{children}</ProducerContext.Provider>

  if (profile === undefined) return <p className="dc">Loading…</p>
  if (!profile?.farm_id) return <Navigate to="/apply" replace />

  return <ProducerContext.Provider value={profile}>{children}</ProducerContext.Provider>
}