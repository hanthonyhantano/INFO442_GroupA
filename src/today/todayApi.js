import { supabase } from '../lib/supabase.js'
import { buildTasks } from './today.js'

// TODO: replace with the signed-in producer's farm once producer sign-in exists.
export const DEMO_FARM_SLUG = 'lorem-ranch'

// The tasks table uses underscores; the logic uses dashes.
const DB_TYPE = {
  'order-requests': 'order_request',
  conflict: 'conflict',
  'low-stock': 'low_stock',
  publish: 'publish',
}

// A stored row matches a computed task when type and linked order/cut/batch are the same.
function matchKey(type, orderId, cutId, batchId) {
  return [type, orderId ?? '', cutId ?? '', batchId ?? ''].join(':')
}

// Make the tasks table match the tasks that exist right now.
async function syncTasks(farmId, computed, stored, batchIdByCode) {
  const byKey = new Map()
  const extras = []
  for (const row of stored) {
    const key = matchKey(row.type, row.order_id, row.cut_id, row.batch_id)
    if (byKey.has(key)) extras.push(row.id)
    else byKey.set(key, row)
  }

  const wanted = computed.map((task) => {
    const refs = {
      order_id: task.orderId ?? null,
      cut_id: task.cutId ?? null,
      batch_id: task.type === 'publish' ? batchIdByCode.get(task.batchCode) ?? null : null,
    }
    const type = DB_TYPE[task.type]
    return { task, type, refs, key: matchKey(type, refs.order_id, refs.cut_id, refs.batch_id) }
  })
  const wantedKeys = new Set(wanted.map((item) => item.key))

  // Rows whose problem is fixed (or duplicates) are removed.
  const staleIds = [...extras]
  for (const [key, row] of byKey) if (!wantedKeys.has(key)) staleIds.push(row.id)
  if (staleIds.length > 0) {
    const { error } = await supabase.from('tasks').delete().in('id', staleIds)
    if (error) throw error
  }

  // New tasks get a row, which records when they first appeared.
  const inserted = new Map()
  const toInsert = wanted.filter((item) => !byKey.has(item.key))
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('tasks')
      .insert(
        toInsert.map((item) => ({
          farm_id: farmId,
          type: item.type,
          title: item.task.title,
          description: item.task.description,
          category: item.task.category,
          ...item.refs,
          created_at: item.task.createdAt ?? new Date().toISOString(),
        })),
      )
      .select()
    if (error) throw error
    for (const row of data) inserted.set(matchKey(row.type, row.order_id, row.cut_id, row.batch_id), row)
  }

  const result = []
  for (const item of wanted) {
    let row = byKey.get(item.key) ?? inserted.get(item.key)
    // A changed title (e.g. "Confirm 2" -> "Confirm 3") reopens a task that was checked off.
    if (byKey.has(item.key) && row.title !== item.task.title) {
      const reset = { title: item.task.title, description: item.task.description, is_completed: false, completed_at: null }
      const { error } = await supabase.from('tasks').update(reset).eq('id', row.id)
      if (error) throw error
      row = { ...row, ...reset }
    }
    result.push({ ...item.task, rowId: row.id, createdAt: row.created_at, isCompleted: row.is_completed })
  }
  return result
}

async function load() {
  const { data: farm, error: farmError } = await supabase
    .from('farms')
    .select('id')
    .eq('slug', DEMO_FARM_SLUG)
    .maybeSingle()
  if (farmError) throw farmError
  if (!farm) return { tasks: [], orders: [], cuts: [], batches: [] }

  const [cutsResult, stockResult, ordersResult, batchesResult, tasksResult] = await Promise.all([
    supabase.from('cuts').select('id, name, is_live, batches(batch_code)').eq('farm_id', farm.id),
    // The same stock numbers the Orders page uses: on hand, and reserved by new, confirmed and packed orders.
    supabase.from('cut_stock').select('id, on_hand, reserved').eq('farm_id', farm.id),
    supabase
      .from('orders')
      .select('id, order_number, status, created_at, order_items(cut_id, quantity, reserved_quantity, price_per_pound, pounds_per_package)')
      .eq('farm_id', farm.id)
      .in('status', ['new', 'confirmed']),
    supabase.from('batches').select('id, batch_code, processing_date, processor_name, created_at').eq('farm_id', farm.id),
    supabase.from('tasks').select('*').eq('farm_id', farm.id),
  ])
  for (const result of [cutsResult, stockResult, ordersResult, batchesResult, tasksResult]) {
    if (result.error) throw result.error
  }

  const orders = ordersResult.data.map((order) => ({
    id: order.id,
    number: order.order_number,
    status: order.status,
    createdAt: order.created_at,
    items: order.order_items.map((item) => ({
      cutId: item.cut_id,
      quantity: item.quantity,
      allocated: item.reserved_quantity,
      pricePerPound: Number(item.price_per_pound),
      poundsPerPackage: Number(item.pounds_per_package),
    })),
  }))

  const stock = new Map(stockResult.data.map((row) => [row.id, row]))
  const cuts = cutsResult.data.map((cut) => ({
    id: cut.id,
    name: cut.name,
    batchCode: cut.batches?.batch_code ?? '',
    onHand: stock.get(cut.id)?.on_hand ?? 0,
    held: stock.get(cut.id)?.reserved ?? 0,
    isLive: cut.is_live,
  }))
  const batches = batchesResult.data.map((batch) => ({
    id: batch.id,
    batchCode: batch.batch_code,
    processingDate: batch.processing_date,
    processorName: batch.processor_name,
    createdAt: batch.created_at,
  }))
  const batchIdByCode = new Map(batches.map((batch) => [batch.batchCode, batch.id]))

  const tasks = await syncTasks(farm.id, buildTasks(orders, cuts), tasksResult.data, batchIdByCode)
  return { tasks, orders, cuts, batches }
}

// React runs effects twice in development; sharing one request stops duplicate task rows.
let inFlight = null
export function loadToday() {
  if (!inFlight) {
    inFlight = load().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

/** Check a task off (or reopen it). */
export async function setTaskDone(rowId, done) {
  const { error } = await supabase
    .from('tasks')
    .update({ is_completed: done, completed_at: done ? new Date().toISOString() : null })
    .eq('id', rowId)
  if (error) throw error
}

/** Calls onChange (debounced) whenever orders, order lines or cuts change in the database. */
export function subscribeToChanges(onChange) {
  let timer = null
  const trigger = () => {
    clearTimeout(timer)
    timer = setTimeout(onChange, 300)
  }
  const channel = supabase
    .channel('today-' + Math.random().toString(36).slice(2))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, trigger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cuts' }, trigger)
    .subscribe()
  return () => {
    clearTimeout(timer)
    supabase.removeChannel(channel)
  }
}