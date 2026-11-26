import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useNavigation } from '../navigation/useNavigation'
import { supabase } from '../lib/supabase'

// The signed-in producer's profile row ({ id, name, role, farm_id }),
// available to every page under /producer via useProducer().
const ProducerContext = createContext(null)
export const useProducer = () => useContext(ProducerContext)

export default function RequireProducer({ children }) {
  const { session } = useNavigation()
  const userId = session?.user && !session.user.is_anonymous ? session.user.id : null

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

  // Not signed in (or only an anonymous shopper) -> sign in
  if (!userId) return <Navigate to="/sign-in" replace />

  if (profile === undefined) return <p className="dc">Loading…</p>

  // Signed in, but not linked to a farm -> apply
  if (!profile?.farm_id) return <Navigate to="/apply" replace />

  return <ProducerContext.Provider value={profile}>{children}</ProducerContext.Provider>
}