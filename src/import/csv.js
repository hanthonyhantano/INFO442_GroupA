import Papa from 'papaparse'
import { cuts } from '../discovery/cuts'

export const CATEGORIES = [...Object.keys(cuts), 'Offal & Bones', 'Ground']
export const FIELDS = [
  { key: 'name', label: 'Product name', aliases: ['name', 'cut', 'cut name'] },
  {
    key: 'part',
    label: 'Cut category',
    aliases: ['category', 'part', 'cow part'],
  },
  {
    key: 'onHand',
    label: 'Qty',
    aliases: ['quantity', 'packages on hand', 'packages_on_hand', 'on hand'],
  },
  {
    key: 'poundsPerPackage',
    label: 'Lb / pkg',
    aliases: ['weight', 'pounds per package', 'pounds_per_package'],
  },
  {
    key: 'pricePerPound',
    label: '$ / lb',
    aliases: ['price', 'price per pound', 'price_per_pound'],
  },
]
export const MAX_BYTES = 5 * 1024 * 1024
export const MAX_ROWS = 1000
const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
const headerKey = (value) => normalize(value).replace(/[^a-z0-9]/g, '')

export function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const records = []
  let cursor = 0
  let line = 1
  let failure = ''
  Papa.parse(source, {
    delimiter: ',',
    skipEmptyLines: false,
    step(result, parser) {
      const rowNumber = line
      const consumed = source.slice(cursor, result.meta.cursor)
      line += (consumed.match(/\r\n|\r|\n/g) ?? []).length
      cursor = result.meta.cursor
      if (result.errors.length) {
        failure = 'Could not read CSV near row ' + rowNumber + '. Check quotation marks.'
        parser.abort()
        return
      }
      const cells = result.data.map((cell) => cell.trim())
      if (cells.some(Boolean)) records.push({ rowNumber, cells })
      if (records.length > MAX_ROWS + 1) {
        failure = 'Upload at most ' + MAX_ROWS + ' data rows at a time.'
        parser.abort()
      }
    },
  })
  if (failure) throw new Error(failure)
  if (records.length < 2) throw new Error('This file has no rows')
  const headers = records.shift().cells
  if (
    headers.some((header) => !header) ||
    new Set(headers.map(headerKey)).size !== headers.length
  ) {
    throw new Error('Give every CSV column a unique, nonempty header.')
  }
  const malformed = records.find((row) => row.cells.length !== headers.length)
  if (malformed)
    throw new Error(
      'Row ' + malformed.rowNumber + ' has a different number of columns than the header.',
    )
  return { headers, records }
}

export function autoMap(headers) {
  return Object.fromEntries(
    FIELDS.map((field) => {
      const names = [field.label, field.key, ...field.aliases].map(headerKey)
      const index = headers.findIndex((header) => names.includes(headerKey(header)))
      return [field.key, index < 0 ? '' : String(index)]
    }),
  )
}

export function mappingComplete(mapping) {
  const values = FIELDS.map((field) => mapping[field.key])
  return (
    values.every((value) => value !== '' && value != null) && new Set(values).size === FIELDS.length
  )
}

function canonicalPart(value, categories) {
  const name = normalize(value)
  return (
    categories.find((category) => normalize(category) === name) ??
    (name === 'head & cheek'
      ? categories.find((category) => normalize(category) === 'cheek')
      : undefined)
  )
}

export function reviewRows(records, mapping, inventory = null, categories = CATEGORIES) {
  const rows = records.map((record) => ({
    rowNumber: record.rowNumber,
    values: Object.fromEntries(
      FIELDS.map(({ key }) => [key, record.cells[Number(mapping[key])] ?? '']),
    ),
  }))
  const counts = new Map()
  rows.forEach(({ values }) =>
    counts.set(normalize(values.name), (counts.get(normalize(values.name)) ?? 0) + 1),
  )
  return rows.map((row) => {
    const { values } = row
    const errors = {}
    const name = normalize(values.name)
    const matches = (inventory ?? []).filter((cut) => normalize(cut.name) === name)
    if (!name) errors.name = 'Product name is required'
    else if (counts.get(name) > 1) errors.name = 'Duplicate product name in this file'
    else if (matches.length > 1) errors.name = 'Multiple inventory cuts match this name'
    const part = canonicalPart(values.part, categories)
    if (!part) errors.part = 'Unknown category'
    if (!/^\d+$/.test(values.onHand.trim()) || !Number.isSafeInteger(Number(values.onHand))) {
      errors.onHand = 'Qty must be a number (a whole number, 0 or more)'
    } else if (
      matches.length === 1 &&
      Number(values.onHand) < (matches[0].held ?? 0) &&
      Number(values.onHand) !== matches[0].onHand
    ) {
      errors.onHand = 'Qty cannot be below packages held for orders'
    }
    for (const key of ['poundsPerPackage', 'pricePerPound']) {
      const value = values[key].trim()
      if (!value) errors[key] = key === 'poundsPerPackage' ? 'Weight missing' : 'Price missing'
      else if (
        !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) ||
        !Number.isFinite(Number(value)) ||
        Number(value) <= 0
      ) {
        errors[key] =
          key === 'poundsPerPackage'
            ? 'Weight must be greater than 0'
            : 'Price must be greater than 0'
      }
    }
    return {
      ...row,
      errors,
      existingId: matches[0]?.id ?? null,
      status:
        inventory === null
          ? 'Inventory check pending'
          : matches.length
            ? 'Updates existing'
            : 'New',
      part,
    }
  })
}

// The persistence adapter must apply this plan atomically, scope it to the
// authenticated farm, recheck held quantities, and deduplicate requestId retries.
// Existing cuts retain their live/draft status. New cuts always start as drafts.
export function importPlan(rows, requestId) {
  if (!rows.length || rows.some((row) => Object.keys(row.errors).length))
    throw new Error('Fix invalid rows before importing.')
  return {
    requestId,
    cuts: rows.map(({ values, existingId, part, rowNumber }) => ({
      rowNumber,
      id: existingId,
      name: values.name.trim(),
      part,
      onHand: Number(values.onHand),
      poundsPerPackage: Number(values.poundsPerPackage),
      pricePerPound: Number(values.pricePerPound),
      ...(existingId === null ? { isLive: false, isFeatured: false } : {}),
    })),
  }
}

export const TEMPLATE = Papa.unparse({
  fields: FIELDS.map((field) => field.label),
  data: [['Chuck roast', 'Chuck', '6', '2.8', '9.50']],
})
