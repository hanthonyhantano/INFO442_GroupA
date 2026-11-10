// Pure helpers for the producer Inventory page (no React, no Supabase).
// A cut looks like:
// { id, name, part, batchCode, pricePerPound, poundsPerPackage, onHand, held, isLive, isFeatured }

export const LOW_STOCK_LIMIT = 3

export const PARTS = ['Cheek', 'Chuck', 'Rib', 'Loin', 'Sirloin', 'Brisket', 'Plate', 'Flank', 'Round', 'Shank', 'Tail']

// Parts that share one heading in the cut list. Any part not listed is its own group.
const GROUPS = {
  Plate: 'Plate & Flank',
  Flank: 'Plate & Flank',
  Shank: 'Shank, Tail & Offal',
  Tail: 'Shank, Tail & Offal',
}

export function groupFor(part) {
  return GROUPS[part] ?? part
}

// Available = on hand minus held, never below 0 (held can exceed on hand).
export function availableOf(cut) {
  return Math.max(0, cut.onHand - cut.held)
}

// Row indicator: 0 = sold out, 1 to 3 = running low.
export function rowStatus(cut) {
  const available = availableOf(cut)
  if (available === 0) return 'sold-out'
  if (available <= LOW_STOCK_LIMIT) return 'low'
  return 'ok'
}

export const CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'low', label: 'Running low' },
  { key: 'soldout', label: 'Sold out' },
]

// "Running low" is 3 or fewer available, so it includes sold-out cuts.
function matchesChip(cut, chip) {
  switch (chip) {
    case 'live': return cut.isLive
    case 'drafts': return !cut.isLive
    case 'low': return availableOf(cut) <= LOW_STOCK_LIMIT
    case 'soldout': return availableOf(cut) === 0
    default: return true
  }
}

// Search, chip and part all combine: a cut must match every active one.
export function filterCuts(cuts, { search = '', chip = 'all', part = null } = {}) {
  const term = search.trim().toLowerCase()
  return cuts.filter(cut =>
    (!term || cut.name.toLowerCase().includes(term)) &&
    matchesChip(cut, chip) &&
    (part === null || cut.part === part))
}

export function chipCounts(cuts) {
  const counts = {}
  for (const { key } of CHIPS) counts[key] = cuts.filter(cut => matchesChip(cut, key)).length
  return counts
}

export function headerTotals(cuts) {
  return { available: cuts.reduce((sum, cut) => sum + availableOf(cut), 0), cuts: cuts.length }
}

// One entry per part that has cuts, for the "Inventory across the animal" bars.
export function onHandByPart(cuts) {
  const totals = new Map()
  for (const cut of cuts) totals.set(cut.part, (totals.get(cut.part) ?? 0) + cut.onHand)
  const known = PARTS.filter(part => totals.has(part))
  const other = [...totals.keys()].filter(part => !PARTS.includes(part))
  return [...known, ...other].map(part => ({ part, onHand: totals.get(part) }))
}

function partOrder(part) {
  const index = PARTS.indexOf(part)
  return index === -1 ? PARTS.length : index
}

// Groups for the cut list, each with its total on-hand packages ("44 PKGS").
export function groupCuts(cuts) {
  const groups = new Map()
  for (const cut of cuts) {
    const name = groupFor(cut.part)
    if (!groups.has(name)) groups.set(name, { name, onHand: 0, cuts: [], order: partOrder(cut.part) })
    const group = groups.get(name)
    group.onHand += cut.onHand
    group.cuts.push(cut)
    group.order = Math.min(group.order, partOrder(cut.part))
  }
  return [...groups.values()]
    .sort((a, b) => a.order - b.order)
    .map(group => ({ name: group.name, onHand: group.onHand, cuts: group.cuts }))
}

function isPositive(value) {
  const text = String(value ?? '').trim()
  return text !== '' && Number.isFinite(Number(text)) && Number(text) > 0
}

// Returns an object of error messages keyed by field. Empty object = valid.
// savedOnHand is the on-hand count already saved, so an unchanged value is never rejected
// (a cut can have more held than on hand when an order came in short).
export function validateCut(draft, { held = 0, savedOnHand = null, isNew = false } = {}) {
  const errors = {}
  if (isNew && !String(draft.name ?? '').trim()) errors.name = 'Enter a name for the cut.'
  if (!isPositive(draft.pricePerPound)) errors.pricePerPound = 'Enter a price greater than 0.'
  if (!isPositive(draft.poundsPerPackage)) errors.poundsPerPackage = 'Enter a weight greater than 0.'
  const onHand = String(draft.onHand ?? '').trim()
  if (!/^\d+$/.test(onHand)) {
    errors.onHand = 'Enter a whole number, 0 or more.'
  } else if (Number(onHand) !== savedOnHand && Number(onHand) < held) {
    errors.onHand = "On hand can't be lower than the " + held + ' packages held for orders.'
  }
  return errors
}

const EDITABLE = ['description', 'onHand', 'pricePerPound', 'poundsPerPackage', 'isLive', 'isFeatured']

// True when the draft differs from the saved cut (drives the "Discard your changes?" prompt).
export function isDirty(saved, draft) {
  return EDITABLE.some(key => String(saved[key] ?? '') !== String(draft[key] ?? ''))
}