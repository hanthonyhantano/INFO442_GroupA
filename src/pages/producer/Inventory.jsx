import InventoryPage from '../../inventory/InventoryPage'
import { useNavigation } from '../../navigation/useNavigation'

export default function Inventory() {
  const { producer } = useNavigation()
  return <InventoryPage assignedFarmId={producer?.farmId} />
}
