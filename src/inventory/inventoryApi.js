import { supabase } from '../lib/supabase.js'

// TODO: replace with the signed-in producer's farm once producer sign-in exists.
export const DEMO_FARM_SLUG = 'lorem-ranch'

const CUT_COLUMNS =
  'id, name, description, photo, price_per_pound, pounds_per_package, packages_on_hand, is_live, is_featured, batches(batch_code), cow_parts(name)'

// Database columns are snake_case; the page uses camelCase.
function toCut(row, held) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    photo: row.photo,
    part: row.cow_parts?.name ?? '',
    batchCode: row.batches?.batch_code ?? '',
    pricePerPound: Number(row.price_per_pound),
    poundsPerPackage: Number(row.pounds_per_package),
    onHand: row.packages_on_hand,
    held,
    isLive: row.is_live,
    isFeatured: row.is_featured,
  }
}

/** All of the farm's cuts, each with its batch code, part name and held packages. */
export async function fetchInventory() {
  const { data: farm, error: farmError } = await supabase
    .from('farms')
    .select('id')
    .eq('slug', DEMO_FARM_SLUG)
    .maybeSingle()
  if (farmError) throw farmError
  if (!farm) return { farmId: null, cuts: [] }

  const [cutsResult, heldResult] = await Promise.all([
    supabase.from('cuts').select(CUT_COLUMNS).eq('farm_id', farm.id).order('id'),
    // Held = packages in orders that are still New.
    supabase
      .from('order_items')
      .select('cut_id, quantity, orders!inner(status, farm_id)')
      .eq('orders.status', 'new')
      .eq('orders.farm_id', farm.id),
  ])
  if (cutsResult.error) throw cutsResult.error
  if (heldResult.error) throw heldResult.error

  const held = new Map()
  for (const item of heldResult.data) {
    held.set(item.cut_id, (held.get(item.cut_id) ?? 0) + item.quantity)
  }
  return {
    farmId: farm.id,
    cuts: cutsResult.data.map((row) => toCut(row, held.get(row.id) ?? 0)),
  }
}