import { describe, it, expect } from 'vitest'
import {
  availableOf, rowStatus, filterCuts, chipCounts, headerTotals,
  onHandByPart, groupCuts, validateCut, isDirty,
} from './inventory.js'

const cut = (name, part, onHand, held, isLive = true) => ({
  id: name, name, part, batchCode: 'LF-0912', pricePerPound: 9.5, poundsPerPackage: 2.75,
  onHand, held, isLive, isFeatured: false,
})

const cuts = [
  cut('Chuck roast', 'Chuck', 18, 2),
  cut('Denver steak', 'Chuck', 14, 0),
  cut('Flat iron', 'Chuck', 12, 0),
  cut('Skirt steak', 'Plate', 5, 6),
  cut('Short ribs', 'Plate', 16, 0),
  cut('Cross-cut shank', 'Shank', 14, 0, false),
  cut('Oxtail', 'Tail', 9, 1),
]

describe('available and status', () => {
  it('is on hand minus held', () => expect(availableOf(cuts[0])).toBe(16))
  it('is never below 0 when held exceeds on hand', () => expect(availableOf(cuts[3])).toBe(0))
  it('marks 0 available as sold out', () => expect(rowStatus(cuts[3])).toBe('sold-out'))
  it('marks 1 to 3 available as low', () => expect(rowStatus(cut('a', 'Chuck', 4, 1))).toBe('low'))
  it('marks 4 or more as ok', () => expect(rowStatus(cut('a', 'Chuck', 4, 0))).toBe('ok'))
})

describe('filterCuts', () => {
  it('searches names ignoring case', () => {
    expect(filterCuts(cuts, { search: 'STEAK' }).map(c => c.name)).toEqual(['Denver steak', 'Skirt steak'])
  })
  it('treats a spaces-only search as no search', () => {
    expect(filterCuts(cuts, { search: '   ' })).toHaveLength(7)
  })
  it('filters by chip', () => {
    expect(filterCuts(cuts, { chip: 'drafts' }).map(c => c.name)).toEqual(['Cross-cut shank'])
    expect(filterCuts(cuts, { chip: 'live' })).toHaveLength(6)
    expect(filterCuts(cuts, { chip: 'low' }).map(c => c.name)).toEqual(['Skirt steak'])
    expect(filterCuts(cuts, { chip: 'soldout' }).map(c => c.name)).toEqual(['Skirt steak'])
  })
  it('filters by part', () => {
    expect(filterCuts(cuts, { part: 'Chuck' })).toHaveLength(3)
  })
  it('combines part, chip and search', () => {
    expect(filterCuts(cuts, { part: 'Chuck', chip: 'live', search: 'roast' }).map(c => c.name)).toEqual(['Chuck roast'])
    expect(filterCuts(cuts, { part: 'Plate', search: 'roast' })).toEqual([])
  })
})

describe('totals and counts', () => {
  it('counts every chip', () => {
    expect(chipCounts(cuts)).toEqual({ all: 7, live: 6, drafts: 1, low: 1, soldout: 1 })
  })
  it('totals available packages and cuts', () => {
    expect(headerTotals(cuts)).toEqual({ available: 80, cuts: 7 })
  })
  it('sums on-hand packages per part, only for parts with cuts', () => {
    expect(onHandByPart(cuts)).toEqual([
      { part: 'Chuck', onHand: 44 }, { part: 'Plate', onHand: 21 },
      { part: 'Shank', onHand: 14 }, { part: 'Tail', onHand: 9 },
    ])
  })
  it('groups related parts with a total per group', () => {
    const groups = groupCuts(cuts)
    expect(groups.map(g => [g.name, g.onHand])).toEqual([
      ['Chuck', 44], ['Plate & Flank', 21], ['Shank, Tail & Offal', 23],
    ])
  })
})

describe('validateCut', () => {
  const valid = { name: 'Chuck roast', pricePerPound: '9.50', poundsPerPackage: '2.75', onHand: '18' }
  const ctx = { held: 2, savedOnHand: 18 }

  it('accepts valid values', () => expect(validateCut(valid, ctx)).toEqual({}))

  it.each(['', '0', '-1', 'abc'])('rejects price %j', value => {
    expect(validateCut({ ...valid, pricePerPound: value }, ctx).pricePerPound).toBeDefined()
  })
  it.each(['', '0', '-1', 'abc'])('rejects weight %j', value => {
    expect(validateCut({ ...valid, poundsPerPackage: value }, ctx).poundsPerPackage).toBeDefined()
  })
  it.each(['', '-1', '1.5', 'abc'])('rejects on hand %j', value => {
    expect(validateCut({ ...valid, onHand: value }, ctx).onHand).toBeDefined()
  })

  it('rejects lowering on hand below held', () => {
    expect(validateCut({ ...valid, onHand: '1' }, ctx).onHand).toBeDefined()
  })
  it('accepts on hand equal to held', () => {
    expect(validateCut({ ...valid, onHand: '2' }, ctx).onHand).toBeUndefined()
  })
  it('accepts an unchanged on hand even when held is higher', () => {
    expect(validateCut({ ...valid, onHand: '5' }, { held: 6, savedOnHand: 5 })).toEqual({})
  })
  it('requires a name for a new cut', () => {
    expect(validateCut({ ...valid, name: ' ' }, { isNew: true }).name).toBeDefined()
    expect(validateCut({ ...valid, name: 'Oxtail' }, { isNew: true })).toEqual({})
  })
})

describe('isDirty', () => {
  const saved = { description: 'x', onHand: 18, pricePerPound: 9.5, poundsPerPackage: 2.75, isLive: true, isFeatured: false }
  it('is false when nothing changed', () => expect(isDirty(saved, { ...saved })).toBe(false))
  it('is false when a number is typed as text', () => expect(isDirty(saved, { ...saved, onHand: '18' })).toBe(false))
  it('is true when a field changed', () => expect(isDirty(saved, { ...saved, isLive: false })).toBe(true))
})