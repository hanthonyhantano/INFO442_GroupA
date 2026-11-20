// Pure helpers for the producer Today dashboard (no React, no Supabase).
//
// cuts:    [{ id, name, batchCode, onHand, held, isLive }]
// orders:  [{ id, number, status, createdAt, items: [{ cutId, quantity, pricePerPound, poundsPerPackage }] }]
// batches: [{ batchCode, processingDate: 'YYYY-MM-DD', processorName }]

import { LOW_STOCK_LIMIT, availableOf } from '../inventory/inventory.js'

export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'orders', label: 'Orders' },
  { key: 'stock', label: 'Stock' },
  { key: 'listings', label: 'Listings' },
]

function byCreatedAt(a, b) {
  return new Date(a.createdAt) - new Date(b.createdAt)
}

function waitingOrders(orders) {
  return orders.filter((order) => order.status === 'new').sort(byCreatedAt)
}

function plural(count, word) {
  return count + ' ' + word + (count === 1 ? '' : 's')
}

// Packages each waiting order is short. The oldest order gets the stock first.
// Returns a Map of orderId -> packages short (orders with no shortage are left out).
export function orderShortages(orders, cuts) {
  const remaining = new Map(cuts.map((cut) => [cut.id, cut.onHand]))
  const shortages = new Map()
  for (const order of waitingOrders(orders)) {
    let short = 0
    for (const item of order.items) {
      const left = remaining.get(item.cutId) ?? 0
      if (item.quantity > left) short += item.quantity - left
      remaining.set(item.cutId, Math.max(0, left - item.quantity))
    }
    if (short > 0) shortages.set(order.id, short)
  }
  return shortages
}

// Every task the farm currently has, conflicts first. A task exists only while its condition is true.
export function buildTasks(orders, cuts) {
  const tasks = []
  const waiting = waitingOrders(orders)
  const shortages = orderShortages(orders, cuts)

  for (const order of waiting) {
    if (!shortages.has(order.id)) continue
    tasks.push({
      key: 'conflict-' + order.id,
      type: 'conflict',
      category: 'Orders',
      tag: 'Conflict',
      title: order.number + ' requests more than you have',
      description: 'Short by ' + plural(shortages.get(order.id), 'package') + '. Lower the quantity or reject the order.',
      action: 'Resolve',
      to: '/producer/orders',
      createdAt: order.createdAt,
    })
  }

  if (waiting.length > 0) {
    tasks.push({
      key: 'order-requests',
      type: 'order-requests',
      category: 'Orders',
      tag: 'Orders',
      title: 'Confirm ' + plural(waiting.length, 'order request'),
      description: 'New requests are waiting for you to confirm or reject.',
      action: 'Review',
      to: '/producer/orders',
      createdAt: waiting[0].createdAt,
    })
  }

  // Running low = 3 or fewer available, including sold out. Drafts are skipped: nobody can buy them.
  for (const cut of cuts) {
    const left = availableOf(cut)
    if (!cut.isLive || left > LOW_STOCK_LIMIT) continue
    tasks.push({
      key: 'low-' + cut.id,
      type: 'low-stock',
      category: 'Stock',
      tag: 'Stock',
      title: cut.name + ' is running low',
      description: left === 0 ? 'Sold out. Update the count if you have more.' : plural(left, 'package') + ' left.',
      action: 'Update',
      to: '/producer/inventory',
      cutId: cut.id,
      createdAt: null,
    })
  }

  const drafts = new Map()
  for (const cut of cuts) {
    if (!cut.isLive) drafts.set(cut.batchCode, (drafts.get(cut.batchCode) ?? 0) + 1)
  }
  for (const [batchCode, count] of drafts) {
    tasks.push({
      key: 'publish-' + batchCode,
      type: 'publish',
      category: 'Listings',
      tag: 'Listings',
      title: 'Publish ' + plural(count, 'draft') + ' from batch ' + batchCode,
      description: 'These cuts are hidden from shoppers until you publish them.',
      action: 'Publish',
      to: '/producer/inventory',
      batchCode,
      createdAt: null,
    })
  }
  return tasks
}

export function filterTasks(tasks, key) {
  return key === 'all' ? tasks : tasks.filter((task) => task.category.toLowerCase() === key)
}

export function taskCounts(tasks) {
  const counts = {}
  for (const { key } of FILTERS) counts[key] = filterTasks(tasks, key).length
  return counts
}

// Open tasks vs the ones the producer has checked off.
export function splitTasks(tasks, completedKeys) {
  const done = new Set(completedKeys)
  return {
    open: tasks.filter((task) => !done.has(task.key)),
    completed: tasks.filter((task) => done.has(task.key)),
  }
}

// "2H", "5H", "1D" like the prototype. Empty when the task has no created time.
export function formatAge(createdAt, now = new Date()) {
  if (!createdAt) return ''
  const minutes = Math.max(1, Math.floor((new Date(now) - new Date(createdAt)) / 60000))
  if (minutes < 60) return minutes + 'M'
  if (minutes < 60 * 24) return Math.floor(minutes / 60) + 'H'
  return Math.floor(minutes / (60 * 24)) + 'D'
}

export function greeting(firstName, date = new Date()) {
  const hour = date.getHours()
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  return 'Good ' + part + (firstName ? ', ' + firstName : '') + '.'
}

export function attentionLine(openCount) {
  if (openCount === 0) return "You're all caught up."
  return openCount + (openCount === 1 ? ' item needs' : ' items need') + ' attention.'
}

// Numbers for the "This week" card.
export function weekStats(orders, cuts) {
  const pending = waitingOrders(orders).reduce(
    (sum, order) =>
      sum + order.items.reduce((total, item) => total + item.quantity * item.pricePerPound * item.poundsPerPackage, 0),
    0,
  )
  return {
    packagesAvailable: cuts.reduce((sum, cut) => sum + availableOf(cut), 0),
    pendingValue: Math.round(pending * 100) / 100,
    confirmedOrders: orders.filter((order) => order.status === 'confirmed').length,
  }
}

// The earliest processing date that is today or later, or null if none is scheduled.
export function nextProcessing(batches, todayIso) {
  const upcoming = batches
    .filter((batch) => batch.processingDate && batch.processingDate >= todayIso)
    .sort((a, b) => a.processingDate.localeCompare(b.processingDate))
  return upcoming[0] ?? null
}