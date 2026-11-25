import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { NavigationProvider } from './NavigationProvider'

export default function LiveNavigation({ children }) {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <p role="status">Loading session…</p>
  const user = session?.user
  const farmId = user && !user.is_anonymous ? user.app_metadata?.farm_id : null
  async function signOut() {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
  }
  // The existing producer routes allow a sample walkthrough without an assigned account.
  return (
    <NavigationProvider
      key={[user?.id, farmId].join(':')}
      session={session ?? undefined}
      producer={farmId ? { farmId, role: 'Producer' } : null}
      onSignOut={user && !user.is_anonymous ? signOut : undefined}
    >
      {children}
    </NavigationProvider>
  )
}
