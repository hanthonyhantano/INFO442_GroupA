export const shopperLinks = [
  ['/shop', 'Shop'], ['/explore', 'Explore Cuts'], ['/farms', 'Farms'],
  ['/mission', 'Our Mission'], ['/producers', 'For Producers'],
]
export const producerLinks = [
  ['/producer/today', 'Today'], ['/producer/orders', 'Orders'],
  ['/producer/inventory', 'Inventory'], ['/producer/batches', 'Batches'],
  ['/producer/import', 'Import'],
]
export function isValidZip(value) { return /^\d{5}$/.test(value) }
export function readZip(storage) {
  try {
    const value = storage?.getItem('catcow.deliveryZip')
    return isValidZip(value) ? value : ''
  } catch { return '' }
}
export function saveZip(storage, value) {
  try {
    if (value) storage?.setItem('catcow.deliveryZip', value)
    else storage?.removeItem('catcow.deliveryZip')
  } catch { /* ZIP still works for this session when storage is unavailable. */ }
}
export function visibleCount(value) {
  return Number.isInteger(value) && value > 0 ? value : null
}
export function producerTitle(pathname) {
  return producerLinks.find(([path]) => pathname === path)?.[1] ?? 'Farm Profile'
}
