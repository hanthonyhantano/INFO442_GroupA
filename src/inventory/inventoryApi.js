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

/** The farm's cuts (with held packages), plus the parts and batches the Add cut form needs. */
export async function fetchInventory() {
  const { data: farm, error: farmError } = await supabase
    .from('farms')
    .select('id')
    .eq('slug', DEMO_FARM_SLUG)
    .maybeSingle()
  if (farmError) throw farmError
  if (!farm) return { farmId: null, cuts: [], parts: [], batches: [] }

  const [cutsResult, heldResult, partsResult, batchesResult] = await Promise.all([
    supabase.from('cuts').select(CUT_COLUMNS).eq('farm_id', farm.id).order('id'),
    // Held = packages in orders that are still New.
    supabase
      .from('order_items')
      .select('cut_id, quantity, orders!inner(status, farm_id)')
      .eq('orders.status', 'new')
      .eq('orders.farm_id', farm.id),
    supabase.from('cow_parts').select('id, name').order('id'),
    supabase.from('batches').select('id, batch_code, animal').eq('farm_id', farm.id).order('id'),
  ])
  for (const result of [cutsResult, heldResult, partsResult, batchesResult]) {
    if (result.error) throw result.error
  }

  const held = new Map()
  for (const item of heldResult.data) {
    held.set(item.cut_id, (held.get(item.cut_id) ?? 0) + item.quantity)
  }
  return {
    farmId: farm.id,
    cuts: cutsResult.data.map((row) => toCut(row, held.get(row.id) ?? 0)),
    parts: partsResult.data,
    batches: batchesResult.data.map((batch) => ({ id: batch.id, label: batch.batch_code + ' · ' + batch.animal })),
  }
}

/** Save the editable fields of one cut. */
export async function saveCut(id, values) {
  const { error } = await supabase
    .from('cuts')
    .update({
      description: values.description,
      price_per_pound: Number(values.pricePerPound),
      pounds_per_package: Number(values.poundsPerPackage),
      packages_on_hand: Number(values.onHand),
      is_live: values.isLive,
      is_featured: values.isFeatured,
    })
    .eq('id', id)
  if (error) throw error
}

/** Create a cut. Throws an error with code '23505' if the name already exists in that batch. */
export async function createCut(farmId, values) {
  const { data, error } = await supabase
    .from('cuts')
    .insert({
      farm_id: farmId,
      batch_id: Number(values.batchId),
      cow_part_id: Number(values.partId),
      name: values.name.trim(),
      description: values.description,
      price_per_pound: Number(values.pricePerPound),
      pounds_per_package: Number(values.poundsPerPackage),
      packages_on_hand: Number(values.onHand),
      is_live: values.isLive,
      is_featured: values.isFeatured,
    })
    .select(CUT_COLUMNS)
    .single()
  if (error) throw error
  return toCut(data, 0)
}