import { describe, expect, it } from 'vitest'
import { autoMap, importPlan, mappingComplete, parseCsv, reviewRows, TEMPLATE } from './csv'

function review(text, inventory = []) {
  const file = parseCsv(text)
  return reviewRows(file.records, autoMap(file.headers), inventory)
}
const header = 'Product name,Cut category,Qty,Lb / pkg,$ / lb\n'
describe('CSV parsing and validation', () => {
  it('round-trips the downloadable template and maps database column names', () => {
    const file = parseCsv(TEMPLATE)
    expect(mappingComplete(autoMap(file.headers))).toBe(true)
    expect(
      mappingComplete(
        autoMap(['name', 'part', 'packages_on_hand', 'pounds_per_package', 'price_per_pound']),
      ),
    ).toBe(true)
    expect(review(TEMPLATE)[0].errors).toEqual({})
  })
  it('handles BOM, quoted commas, escaped quotes, multiline cells and blank lines with source line numbers', () => {
    const file = parseCsv(
      '\uFEFF' + header + '"Roast, ""large""\ncut",Chuck,2,3,10\n\nTail,Tail,1,2,9\n',
    )
    expect(file.records.map((row) => row.rowNumber)).toEqual([2, 5])
    expect(file.records[0].cells[0]).toBe('Roast, "large"\ncut')
  })
  it.each(['', header])('rejects empty files', (text) => {
    expect(() => parseCsv(text)).toThrow('This file has no rows')
  })
  it('rejects malformed records and ambiguous headers', () => {
    expect(() => parseCsv(header + '"unclosed,Chuck,2,3,10')).toThrow(/quotation/)
    expect(() => parseCsv(header + 'Roast,Chuck,2')).toThrow(/Row 2/)
    expect(() => parseCsv('Name,name\na,b')).toThrow(/unique/)
  })
  it('uses supplied categories before falling back to the guide alias', () => {
    const file = parseCsv(header + 'Beef cheek,Head & Cheek,2,1,10')
    const mapping = autoMap(file.headers)
    expect(reviewRows(file.records, mapping, [], ['Head & Cheek'])[0].part).toBe('Head & Cheek')
    expect(reviewRows(file.records, mapping)[0].part).toBe('Cheek')
  })
  it('requires distinct mappings', () => {
    const mapping = autoMap(parseCsv(TEMPLATE).headers)
    mapping.part = mapping.name
    expect(mappingComplete(mapping)).toBe(false)
  })
  it.each(['five', '-1', '1.2', 'Infinity', '1e3', '', '9007199254740993'])(
    'rejects invalid quantity %s',
    (qty) => {
      expect(review(header + 'Roast,Chuck,' + qty + ',2,10')[0].errors.onHand).toBeTruthy()
    },
  )
  it('accepts zero stock, rejects missing weight and unknown categories, then clears corrected errors', () => {
    const file = parseCsv(header + 'Roast,Unknown,0,,0')
    const mapping = autoMap(file.headers)
    expect(Object.keys(reviewRows(file.records, mapping)[0].errors)).toEqual([
      'part',
      'poundsPerPackage',
      'pricePerPound',
    ])
    file.records[0].cells = ['Roast', 'Chuck', '0', '2', '10']
    expect(reviewRows(file.records, mapping)[0].errors).toEqual({})
  })
  it('flags all duplicates ignoring case and outside whitespace', () => {
    const rows = review(header + 'Roast,Chuck,1,2,10\n roast ,Chuck,2,2,10')
    expect(rows.every((row) => row.errors.name)).toBe(true)
  })
  it('matches existing cuts, enforces held stock, and blocks ambiguous matches', () => {
    const inventory = [{ id: 4, name: 'Chuck roast', onHand: 6, held: 3 }]
    expect(review(TEMPLATE, inventory)[0].status).toBe('Updates existing')
    expect(review(header + 'Chuck roast,Chuck,1,2,10', inventory)[0].errors.onHand).toBeTruthy()
    expect(
      review(TEMPLATE, [...inventory, { id: 5, name: 'Chuck roast' }])[0].errors.name,
    ).toBeTruthy()
  })
  it('prepares new cuts as drafts while preserving existing status', () => {
    const rows = review(header + 'Roast,Chuck,1,2,10\nTail,Tail,0,2,8', [{ id: 4, name: 'Roast' }])
    const plan = importPlan(rows, 'test-request')
    expect(plan.requestId).toBe('test-request')
    expect(plan.cuts[0].id).toBe(4)
    expect(plan.cuts[0]).not.toHaveProperty('isLive')
    expect(plan.cuts[1]).toMatchObject({
      id: null,
      isLive: false,
      isFeatured: false,
    })
    expect(() => importPlan([], 'x')).toThrow()
  })
})
