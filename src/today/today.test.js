import { describe, it, expect } from 'vitest'
import {
  attentionLine, buildTasks, filterTasks, formatAge, greeting, nextProcessing,
  orderShortages, splitTasks, taskCounts, weekStats,
} from './today.js'

const cut = (id, name, onHand, held, isLive = true, batchCode = 'LF-0912') => ({
  id, name, batchCode, onHand, held, isLive,
})

// The sample data from the prototype.
const cuts = [
  cut(1, 'Chuck roast', 18, 2),
  cut(2, 'Denver steak', 14, 0),
  cut(3, 'Flat iron', 12, 0),
  cut(4, 'Skirt steak', 5, 6),
  cut(5, 'Short ribs', 16, 0),
  cut(6, 'Flank steak', 4, 2),
  cut(7, 'Eye of round', 28, 0),
  cut(8, 'Cross-cut shank', 14, 0, false, 'LF-1010'),
  cut(9, 'Oxtail', 9, 0, false, 'LF-1010'),
  cut(10, 'Beef cheek', 6, 0, false, 'LF-1010'),
]

const orders = [
  {
    id: 1, number: 'CC-1041', status: 'new', createdAt: '2026-11-19T18:00:00Z',
    items: [{ cutId: 1, quantity: 2, pricePerPound: 9.5, poundsPerPackage: 2.75 }],
  },
  {
    id: 2, number: 'CC-1040', status: 'new', createdAt: '2026-11-19T20:00:00Z',
    items: [
      { cutId: 4, quantity: 6, pricePerPound: 17, poundsPerPackage: 1.5 },
      { cutId: 6, quantity: 2, pricePerPound: 13, poundsPerPackage: 2 },
    ],
  },
  { id: 3, number: 'CC-1030', status: 'confirmed', createdAt: '2026-11-18T10:00:00Z', items: [] },
]

describe('orderShortages', () => {
  it('finds an order that asks for more than is on hand', () => {
    expect([...orderShortages(orders, cuts)]).toEqual([[2, 1]])
  })
  it('gives the stock to the older order first', () => {
    const two = [
      { id: 1, number: 'A', status: 'new', createdAt: '2026-11-19T10:00:00Z', items: [{ cutId: 1, quantity: 3 }] },
      { id: 2, number: 'B', status: 'new', createdAt: '2026-11-19T11:00:00Z', items: [{ cutId: 1, quantity: 3 }] },
    ]
    expect([...orderShortages(two, [cut(1, 'X', 5, 6)])]).toEqual([[2, 1]])
  })
  it('ignores orders that are not new', () => {
    expect(orderShortages([{ ...orders[1], status: 'confirmed' }], cuts).size).toBe(0)
  })
})

describe('buildTasks', () => {
  const tasks = buildTasks(orders, cuts)

  it('lists conflicts first, then orders, stock and listings', () => {
    expect(tasks.map((task) => task.title)).toEqual([
      'CC-1040 requests more than you have',
      'Confirm 2 order requests',
      'Skirt steak is running low',
      'Flank steak is running low',
      'Publish 3 drafts from batch LF-1010',
    ])
  })
  it('gives each task the right tag and button', () => {
    expect(tasks.map((task) => [task.tag, task.action])).toEqual([
      ['Conflict', 'Resolve'], ['Orders', 'Review'], ['Stock', 'Update'], ['Stock', 'Update'], ['Listings', 'Publish'],
    ])
  })
  it('has a task for each cut with 3 or fewer packages, but not for drafts', () => {
    expect(buildTasks([], [cut(1, 'A', 3, 0), cut(2, 'B', 4, 0), cut(3, 'C', 0, 0, false)]).map((t) => t.title))
      .toEqual(['A is running low', 'Publish 1 draft from batch LF-0912'])
  })
  it('has no tasks when nothing needs attention', () => {
    expect(buildTasks([], [cut(1, 'A', 20, 0)])).toEqual([])
  })
  it('drops a task once its condition is fixed', () => {
    const fixed = cuts.map((c) => (c.id === 4 ? { ...c, onHand: 20 } : c))
    expect(buildTasks(orders, fixed).some((task) => task.key === 'low-4' || task.type === 'conflict')).toBe(false)
  })
})

describe('filters and completed', () => {
  const tasks = buildTasks(orders, cuts)
  it('counts each category', () => {
    expect(taskCounts(tasks)).toEqual({ all: 5, orders: 2, stock: 2, listings: 1 })
  })
  it('filters by category', () => {
    expect(filterTasks(tasks, 'stock').map((t) => t.key)).toEqual(['low-4', 'low-6'])
    expect(filterTasks(tasks, 'all')).toHaveLength(5)
  })
  it('splits checked tasks into completed', () => {
    const { open, completed } = splitTasks(tasks, ['order-requests'])
    expect(open).toHaveLength(4)
    expect(completed.map((t) => t.key)).toEqual(['order-requests'])
  })
})

describe('text helpers', () => {
  const now = '2026-11-19T20:00:00Z'
  it('formats age', () => {
    expect(formatAge('2026-11-19T18:00:00Z', now)).toBe('2H')
    expect(formatAge('2026-11-19T19:45:00Z', now)).toBe('15M')
    expect(formatAge('2026-11-17T20:00:00Z', now)).toBe('2D')
    expect(formatAge(null, now)).toBe('')
  })
  it('greets by time of day', () => {
    expect(greeting('Lorem', new Date(2026, 10, 19, 9))).toBe('Good morning, Lorem.')
    expect(greeting('Lorem', new Date(2026, 10, 19, 14))).toBe('Good afternoon, Lorem.')
    expect(greeting('', new Date(2026, 10, 19, 20))).toBe('Good evening.')
  })
  it('says how many things need attention', () => {
    expect(attentionLine(4)).toBe('4 items need attention.')
    expect(attentionLine(1)).toBe('1 item needs attention.')
    expect(attentionLine(0)).toBe("You're all caught up.")
  })
})

describe('weekStats and nextProcessing', () => {
  it('totals the week card', () => {
    expect(weekStats(orders, cuts)).toEqual({ packagesAvailable: 117, pendingValue: 257.25, confirmedOrders: 1 })
  })
  const batches = [
    { batchCode: 'LF-0912', processingDate: '2026-11-20', processorName: 'Lorem Processing Co.' },
    { batchCode: 'LF-1010', processingDate: '2026-12-15', processorName: 'Lorem Processing Co.' },
    { batchCode: 'OLD', processingDate: '2026-11-01', processorName: 'Old Co.' },
  ]
  it('finds the next upcoming date', () => {
    expect(nextProcessing(batches, '2026-11-19').batchCode).toBe('LF-0912')
    expect(nextProcessing(batches, '2026-11-20').batchCode).toBe('LF-0912')
  })
  it('returns null when nothing is scheduled', () => {
    expect(nextProcessing(batches, '2026-12-16')).toBeNull()
    expect(nextProcessing([], '2026-11-19')).toBeNull()
  })
})