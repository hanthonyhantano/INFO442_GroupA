import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ImportPage from '../../import/ImportPage'
import { submitImport } from '../../import/importApi'
import { fetchInventory } from '../../inventory/inventoryApi'
import { useNavigation } from '../../navigation/useNavigation'

export default function Import() {
  const { session, producer } = useNavigation()
  const farmId = producer?.farmId
  const [inventory, setInventory] = useState(null)
  const [error, setError] = useState(false)
  const [attempt, retry] = useState(0)
  useEffect(() => {
    if (!farmId) return
    let current = true
    fetchInventory(farmId)
      .then((result) => {
        if (!result.farmId) throw new Error('Missing farm')
        if (current) {
          setInventory(result)
          setError(false)
        }
      })
      .catch(() => {
        if (current) {
          setError(true)
          setInventory(null)
        }
      })
    return () => {
      current = false
    }
  }, [farmId, attempt])
  if (!farmId)
    return (
      <>
        <p>
          <Link to="/sign-in">Sign in with an assigned producer account</Link> to save inventory.
        </p>
        <ImportPage />
      </>
    )
  if (error)
    return (
      <p role="alert">
        Could not load your inventory. <button onClick={() => retry((n) => n + 1)}>Retry</button>
      </p>
    )
  if (!inventory) return <p role="status">Loading inventory…</p>
  return (
    <ImportPage
      inventory={inventory.cuts}
      batches={inventory.batches}
      scope={':' + session.user.id + ':' + farmId}
      categories={inventory.parts.map((part) => part.name)}
      onImport={(plan) => submitImport(farmId, plan)}
      onSaved={() => retry((n) => n + 1)}
    />
  )
}
