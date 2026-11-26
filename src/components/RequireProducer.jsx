import { Navigate } from 'react-router-dom'
import { useNavigation } from '../navigation/useNavigation'

// Guards /producer. Follows the NavigationProvider conventions:
// - session undefined = auth not wired up (tests, sample walkthrough): let through
// - session null      = confirmed signed out: ProducerLayout redirects to /sign-in
// - anonymous shopper = not a producer: send to /sign-in
// - signed in, but app_metadata has no farm_id: send to /apply to set up a ranch
// The farm id is the trusted app_metadata.farm_id that LiveNavigation passes in
// as producer.farmId (the same value the producer RPCs check).
export default function RequireProducer({ children }) {
  const { session, producer } = useNavigation()
  const user = session?.user

  if (user?.is_anonymous) return <Navigate to="/sign-in" replace />
  if (user?.id && !producer?.farmId) return <Navigate to="/apply" replace />

  return children
}