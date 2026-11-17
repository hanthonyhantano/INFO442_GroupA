// @vitest-environment jsdom
/**
 * Tests for the producer Batches page + new-batch form (requirements PB1–PB36).
 *
 * Stack: Vitest + @testing-library/react + react-router-dom (MemoryRouter).
 * Supabase is replaced by a small in-memory fake (see `h` below), so these tests
 * never touch your real database.
 *
 * Data contract these tests assume (change the fake + fixtures if yours differs):
 *  - batches: id, farm_id, batch_code, animal, processing_date, status ('active'|'done'), created_at
 *  - cuts:    id, farm_id, batch_id, cow_part_id, name, total, sold, held, featured
 *  - the batches query embeds cuts and each cut's part:  cuts ( *, cow_parts ( id, name ) )
 *  - live updates (PB21) come from a Supabase realtime channel on the `cuts` table
 *  - "View cuts" (PB26) navigates to /producer/inventory?batch=<batchId>&parts=<partId>,<partId>
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import Batches from './Batches'

/* ------------------------------------------------------------------ */
/* Fake Supabase                                                        */
/* ------------------------------------------------------------------ */

const h = vi.hoisted(() => {
  const state = {
    db: { batches: [], cuts: [], cow_parts: [] },
    fail: {}, // e.g. { 'batches.select': true, 'cuts.update': true }
    calls: [], // every query that ran: { table, op, payload, filters }
    handlers: [], // realtime handlers: { table, cb }
    nextId: 1000,
  }

  const matches = (row, filters) =>
    filters.every(([kind, col, val]) => {
      if (kind === 'eq') return String(row[col]) === String(val)
      if (kind === 'in') return val.map(String).includes(String(row[col]))
      if (kind === 'neq') return String(row[col]) !== String(val)
      return true
    })

  const withPart = (cut) => ({
    ...cut,
    cow_parts: state.db.cow_parts.find((p) => p.id === cut.cow_part_id) ?? null,
  })

  const withCuts = (batch) => ({
    ...batch,
    cuts: state.db.cuts.filter((c) => c.batch_id === batch.id).map(withPart),
  })

  function execute(q) {
    state.calls.push({ table: q.table, op: q.op, payload: q.payload, filters: q.filters })

    if (state.fail[`${q.table}.${q.op}`]) {
      return { data: null, error: { message: 'Simulated failure', code: 'XX000' } }
    }

    const rows = state.db[q.table]
    let data

    if (q.op === 'select') {
      data = rows.filter((r) => matches(r, q.filters))
      if (q.table === 'batches') data = data.map(withCuts)
      if (q.table === 'cuts') data = data.map(withPart)
    } else if (q.op === 'insert') {
      const list = (Array.isArray(q.payload) ? q.payload : [q.payload]).map((r) => ({ ...r }))
      for (const r of list) {
        if (
          q.table === 'batches' &&
          rows.some((b) => String(b.farm_id) === String(r.farm_id) && b.batch_code === r.batch_code)
        ) {
          return {
            data: null,
            error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "batches_farm_id_batch_code_key"',
            },
          }
        }
      }
      for (const r of list) {
        r.id = state.nextId++
        r.created_at = r.created_at ?? new Date().toISOString()
        if (q.table === 'cuts') r.featured = r.featured ?? false
        rows.push(r)
      }
      data = list
    } else if (q.op === 'update') {
      data = rows.filter((r) => matches(r, q.filters))
      data.forEach((r) => Object.assign(r, q.payload))
    } else if (q.op === 'delete') {
      data = rows.filter((r) => matches(r, q.filters))
      state.db[q.table] = rows.filter((r) => !data.includes(r))
    }

    if (q.isSingle) data = data?.[0] ?? null
    return { data, error: null }
  }

  class Query {
    constructor(table) {
      this.table = table
      this.op = 'select'
      this.payload = null
      this.filters = []
      this.isSingle = false
    }
    select() { return this }
    insert(p) { this.op = 'insert'; this.payload = p; return this }
    update(p) { this.op = 'update'; this.payload = p; return this }
    delete() { this.op = 'delete'; return this }
    eq(c, v) { this.filters.push(['eq', c, v]); return this }
    neq(c, v) { this.filters.push(['neq', c, v]); return this }
    in(c, v) { this.filters.push(['in', c, v]); return this }
    order() { return this }
    limit() { return this }
    single() { this.isSingle = true; return this }
    maybeSingle() { this.isSingle = true; return this }
    then(resolve, reject) {
      return Promise.resolve().then(() => execute(this)).then(resolve, reject)
    }
  }

  const supabase = {
    from: (table) => new Query(table),
    channel: () => {
      const ch = {
        on: (_event, filter, cb) => {
          state.handlers.push({ table: filter?.table, cb })
          return ch
        },
        subscribe: () => ch,
        unsubscribe: () => {},
      }
      return ch
    },
    removeChannel: () => {},
  }

  // Simulate another page (e.g. Orders) changing a cut in the database
  function emitCutUpdate(id, changes) {
    const row = state.db.cuts.find((c) => c.id === id)
    const old = { ...row }
    Object.assign(row, changes)
    state.handlers
      .filter((x) => !x.table || x.table === 'cuts')
      .forEach((x) => x.cb({ eventType: 'UPDATE', table: 'cuts', schema: 'public', new: { ...row }, old }))
  }

  function reset(db) {
    state.db = db
    state.fail = {}
    state.calls = []
    state.handlers = []
    state.nextId = 1000
  }

  return { state, supabase, emitCutUpdate, reset }
})

vi.mock('/src/lib/supabase.js', () => ({ supabase: h.supabase }))

/* ------------------------------------------------------------------ */
/* Fixtures                                                             */
/* ------------------------------------------------------------------ */

const FARM_ID = 1

const cut = (id, batch_id, cow_part_id, name, total, sold, held) => ({
  id, farm_id: FARM_ID, batch_id, cow_part_id, name, total, sold, held, featured: false,
})

/*
 * LF-1010 (newest, selected by default) — parts:
 *   Chuck  = Chuck roast 10/6/1 + Chuck steak 6/2/0 → total 16, sold 8, held 1, left 7, 50%
 *   Rib    = Ribeye 4/4/0                           → total 4,  sold 4, held 0, left 0, 100%
 *   Shank  = Cross-cut shank 12/1/0                 → total 12, sold 1, held 0, left 11, 8%
 *   Round  = Round roast 8/1/1                      → total 8,  sold 1, held 1, left 6, 13%
 *   Brisket = 0 packages                            → no column
 *   Batch: total 40, sold 14 → 35%
 *   Most packages left: Shank (11), Chuck (7)   (lowest % would be Shank + Round — tests catch the difference)
 *
 * LF-0912 (older): Chuck 8/5/0 → 62.5% → rounds to 63%
 */
function seed() {
  return {
    cow_parts: [
      { id: 1, name: 'Chuck' },
      { id: 2, name: 'Rib' },
      { id: 3, name: 'Shank' },
      { id: 4, name: 'Round' },
      { id: 5, name: 'Brisket' },
    ],
    batches: [
      // Deliberately NOT in newest-first order
      { id: 1, farm_id: FARM_ID, batch_code: 'LF-0912', animal: 'Steer #14', processing_date: '2026-09-12', status: 'active', created_at: '2026-09-12T10:00:00Z' },
      { id: 2, farm_id: FARM_ID, batch_code: 'LF-1010', animal: 'Steer #15', processing_date: '2026-10-10', status: 'active', created_at: '2026-10-10T10:00:00Z' },
      { id: 3, farm_id: FARM_ID, batch_code: 'CB-0930', animal: 'Heifer #3', processing_date: '2026-09-30', status: 'done', created_at: '2026-09-30T10:00:00Z' },
      { id: 4, farm_id: FARM_ID, batch_code: 'CB-0801', animal: 'Heifer #2', processing_date: '2026-08-01', status: 'done', created_at: '2026-08-01T10:00:00Z' },
    ],
    cuts: [
      cut(11, 1, 1, 'Chuck roast', 8, 5, 0),

      cut(21, 2, 1, 'Chuck roast', 10, 6, 1),
      cut(22, 2, 1, 'Chuck steak', 6, 2, 0),
      cut(23, 2, 2, 'Ribeye', 4, 4, 0),
      cut(24, 2, 3, 'Cross-cut shank', 12, 1, 0),
      cut(25, 2, 4, 'Round roast', 8, 1, 1),
      cut(26, 2, 5, 'Brisket', 0, 0, 0),
    ],
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function LocationProbe() {
  const loc = useLocation()
  return <output data-testid="location">{loc.pathname + loc.search}</output>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/producer/batches']}>
      <Routes>
        <Route path="/producer/batches" element={<Batches farmId={FARM_ID} />} />
        <Route path="/producer/inventory" element={<p>Inventory page</p>} />
        <Route path="/producer/import" element={<p>Import page</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  )
}

const location = () => new URL(screen.getByTestId('location').textContent, 'http://x')

async function cards() {
  const list = await screen.findByRole('tablist')
  return within(list).getAllByRole('tab')
}

const cardFor = async (code) => (await cards()).find((c) => c.textContent.includes(code))

const chart = () => screen.getByText(/how the animal is selling/i).closest('section')

// Each column = the wrapper around a bar (role="img") + its labels
const columns = () => within(chart()).getAllByRole('img').map((bar) => bar.parentElement)

const columnFor = (part) =>
  columns().find((col) => within(col).queryByText(new RegExp(`^${part}\\b`)))

function barCounts(col) {
  const label = within(col).getByRole('img').getAttribute('aria-label')
  const [, sold, held, left] = label.match(/(\d+) sold, (\d+) held, (\d+) in freezer/)
  return { sold: +sold, held: +held, left: +left }
}

function columnShare(col) {
  const all = columns()
  const size = (el) => parseFloat(el.style.width) || parseFloat(el.style.flexGrow) || 0
  if (col.style.width.endsWith('%')) return parseFloat(col.style.width) / 100
  return size(col) / all.reduce((s, el) => s + size(el), 0)
}

const segmentHeight = (col, kind) =>
  parseFloat(col.querySelector(`.batches-bar-${kind}`)?.style.height ?? '0')

async function openNewBatchForm() {
  fireEvent.click(await screen.findByRole('button', { name: /new batch/i }))
  return {
    code: screen.getByLabelText(/batch code/i),
    animal: screen.getByLabelText(/animal/i),
    date: screen.getByLabelText(/processing date/i),
  }
}

function fill(fields, { code = 'LF-1111', animal = 'Steer #16', date = '2026-12-01' } = {}) {
  fireEvent.change(fields.code, { target: { value: code } })
  fireEvent.change(fields.animal, { target: { value: animal } })
  fireEvent.change(fields.date, { target: { value: date } })
}

// fireEvent.submit skips the browser's own `required` check, so we test the app's validation
const submit = (fields) => fireEvent.submit(fields.code.closest('form'))

const batchInserts = () => h.state.calls.filter((c) => c.table === 'batches' && c.op === 'insert')

/* ------------------------------------------------------------------ */
/* Tests                                                                */
/* ------------------------------------------------------------------ */

beforeEach(() => h.reset(seed()))
afterEach(cleanup)

describe('Page states', () => {
  it('PB1: shows an error message when the data fails to load', async () => {
    // Requirement text says "Try agin." — testing the corrected spelling.
    h.state.fail['batches.select'] = true
    renderPage()
    expect(await screen.findByText(/something went wrong\. try again\./i)).toBeTruthy()
  })

  it('PB2: shows the empty message when the farm has no batches', async () => {
    h.reset({ ...seed(), batches: [], cuts: [] })
    renderPage()
    expect(await screen.findByText('No batches yet. Import your first cut sheet.')).toBeTruthy()
  })
})

describe('Batch cards', () => {
  it('PB3: shows one card per batch that is not done', async () => {
    renderPage()
    const list = await cards()
    expect(list).toHaveLength(2)
    expect(list.some((c) => c.textContent.includes('CB-0930'))).toBe(false)
  })

  it('PB4: each card shows the batch code', async () => {
    renderPage()
    expect(within(await cardFor('LF-0912')).getByText('LF-0912')).toBeTruthy()
    expect(within(await cardFor('LF-1010')).getByText('LF-1010')).toBeTruthy()
  })

  it('PB5: each card shows the animal type and number', async () => {
    renderPage()
    expect((await cardFor('LF-0912')).textContent).toContain('Steer #14')
    expect((await cardFor('LF-1010')).textContent).toContain('Steer #15')
  })

  it('PB6 + PB7: each card shows percent sold = sold / total packages, rounded', async () => {
    renderPage()
    expect((await cardFor('LF-1010')).textContent).toMatch(/\b35% sold/) // 14 / 40
    expect((await cardFor('LF-0912')).textContent).toMatch(/\b63% sold/) // 5 / 8 = 62.5
  })

  it('PB8: the most recently created batch is selected and charted on load', async () => {
    renderPage()
    const newest = await cardFor('LF-1010')
    expect(newest.getAttribute('aria-selected')).toBe('true')
    expect(within(chart()).getByText(/LF-1010/)).toBeTruthy()
  })

  it('PB9: clicking a card shows that batch’s chart', async () => {
    renderPage()
    fireEvent.click(await cardFor('LF-0912'))
    await waitFor(() => expect(within(chart()).getByText(/LF-0912/)).toBeTruthy())
    expect(columns()).toHaveLength(1)
  })

  it('PB10: shows "+N done" for done batches', async () => {
    renderPage()
    expect(await screen.findByText('+2 done')).toBeTruthy()
  })
})

describe('Chart', () => {
  it('PB11: one column per cow part with at least one package', async () => {
    renderPage()
    await cards()
    expect(columns()).toHaveLength(4) // Chuck, Rib, Shank, Round — not Brisket (0 packages)
    expect(columnFor('Brisket')).toBeUndefined()
  })

  it('PB12: each column is labeled with its part name (cuts grouped by part)', async () => {
    renderPage()
    await cards()
    for (const part of ['Chuck', 'Rib', 'Shank', 'Round']) {
      expect(columnFor(part), `column for ${part}`).toBeTruthy()
    }
  })

  it('PB13: column width = part packages / batch packages', async () => {
    renderPage()
    await cards()
    expect(columnShare(columnFor('Chuck'))).toBeCloseTo(16 / 40, 2)
    expect(columnShare(columnFor('Shank'))).toBeCloseTo(12 / 40, 2)
    expect(columnShare(columnFor('Rib'))).toBeCloseTo(4 / 40, 2)
  })

  it('PB14–PB16: sold, held and in-freezer portions match the part totals', async () => {
    renderPage()
    await cards()
    const chuck = columnFor('Chuck')
    expect(barCounts(chuck)).toEqual({ sold: 8, held: 1, left: 7 })
    expect(segmentHeight(chuck, 'sold')).toBeCloseTo((8 / 16) * 100, 0)
    expect(segmentHeight(chuck, 'held')).toBeCloseTo((1 / 16) * 100, 0)
    // The rest of the bar (100 - sold - held) is the in-freezer portion
    expect(100 - segmentHeight(chuck, 'sold') - segmentHeight(chuck, 'held')).toBeCloseTo((7 / 16) * 100, 0)
  })

  it('PB17 + PB18: percent sold under each column = sold / total, rounded', async () => {
    renderPage()
    await cards()
    expect(within(columnFor('Chuck')).getByText('50%')).toBeTruthy()
    expect(within(columnFor('Rib')).getByText('100%')).toBeTruthy()
    expect(within(columnFor('Shank')).getByText('8%')).toBeTruthy() // 1/12 = 8.3
    expect(within(columnFor('Round')).getByText('13%')).toBeTruthy() // 1/8 = 12.5
  })

  it('PB19 + PB20: packages left under each column = total − sold − held', async () => {
    renderPage()
    await cards()
    expect(within(columnFor('Chuck')).getByText('7 left')).toBeTruthy()
    expect(within(columnFor('Rib')).getByText('0 left')).toBeTruthy()
    expect(within(columnFor('Shank')).getByText('11 left')).toBeTruthy()
    expect(within(columnFor('Round')).getByText('6 left')).toBeTruthy()
  })

  it('PB21: a confirmed order shows as sold without reloading the page', async () => {
    renderPage()
    await cards()
    const loadsBefore = h.state.calls.filter((c) => c.table === 'batches' && c.op === 'select').length

    // Orders page confirms 4 packages of cross-cut shank
    h.emitCutUpdate(24, { sold: 5 })

    await waitFor(() => expect(within(columnFor('Shank')).getByText('42%')).toBeTruthy()) // 5/12
    expect(within(columnFor('Shank')).getByText('7 left')).toBeTruthy()
    // Updated from the realtime event, not by refetching the whole page
    const loadsAfter = h.state.calls.filter((c) => c.table === 'batches' && c.op === 'select').length
    expect(loadsAfter).toBe(loadsBefore)
  })
})

describe('Slowest parts bar', () => {
  it('PB22: names the two parts with the most packages left', async () => {
    renderPage()
    expect(await screen.findByText('Shank and chuck are filling slowest.')).toBeTruthy()
  })

  it('PB23: hidden when no part has packages left', async () => {
    const db = seed()
    db.cuts
      .filter((c) => c.batch_id === 2)
      .forEach((c) => {
        c.sold = c.total
        c.held = 0
      })
    h.reset(db)
    renderPage()
    await cards()
    expect(screen.queryByText(/filling slowest/i)).toBeNull()
  })

  it('PB24: "Feature both" turns on Feature on shop for every cut in the two parts', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /feature both/i }))

    await waitFor(() => {
      const featured = h.state.db.cuts.filter((c) => c.featured).map((c) => c.id).sort()
      expect(featured).toEqual([21, 22, 24]) // both chuck cuts + the shank cut, only in LF-1010
    })
  })

  it('PB25: if featuring fails, shows an error and no cuts change', async () => {
    h.state.fail['cuts.update'] = true
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /feature both/i }))

    expect(await screen.findByText(/something went wrong\. try again\./i)).toBeTruthy()
    expect(h.state.db.cuts.some((c) => c.featured)).toBe(false)
  })

  it('PB26: "View cuts" opens Inventory filtered to the two named parts in this batch', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /view cuts/i }))

    expect(await screen.findByText('Inventory page')).toBeTruthy()
    const loc = location()
    expect(loc.pathname).toBe('/producer/inventory')
    expect(loc.searchParams.get('batch')).toBe('2')
    expect(new Set(loc.searchParams.get('parts').split(','))).toEqual(new Set(['1', '3']))
  })
})

describe('New batch', () => {
  it('PB27: "+ New batch" opens a form with batch code, animal and processing date', async () => {
    renderPage()
    const fields = await openNewBatchForm()
    expect(fields.code).toBeTruthy()
    expect(fields.animal).toBeTruthy()
    expect(fields.date).toBeTruthy()
  })

  it.each([
    ['PB28', 'batch code', { code: '' }],
    ['PB29', 'animal', { animal: '' }],
    ['PB30', 'processing date', { date: '' }],
  ])('%s: empty %s shows an error and does not create the batch', async (_id, _field, values) => {
    renderPage()
    const fields = await openNewBatchForm()
    fill(fields, values)
    submit(fields)

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(batchInserts()).toHaveLength(0)
    expect(h.state.db.batches).toHaveLength(4)
  })

  it('PB31: a batch code that already exists shows an error and is not created', async () => {
    renderPage()
    const fields = await openNewBatchForm()
    fill(fields, { code: 'LF-0912' })
    submit(fields)

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(h.state.db.batches.filter((b) => b.batch_code === 'LF-0912')).toHaveLength(1)
    expect(await cards()).toHaveLength(2)
  })

  it('PB32: valid values show "Import a cut sheet" and "Add cuts by hand"', async () => {
    renderPage()
    const fields = await openNewBatchForm()
    fill(fields)
    submit(fields)

    expect(await screen.findByRole('button', { name: /import a cut sheet/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /add cuts by hand/i })).toBeTruthy()
  })

  it('PB33: "Import a cut sheet" opens the Import page', async () => {
    renderPage()
    const fields = await openNewBatchForm()
    fill(fields)
    submit(fields)
    fireEvent.click(await screen.findByRole('button', { name: /import a cut sheet/i }))

    expect(await screen.findByText('Import page')).toBeTruthy()
    expect(location().pathname).toBe('/producer/import')
  })

  it('PB34: "Add cuts by hand" opens a blank Add cut panel', async () => {
    renderPage()
    const fields = await openNewBatchForm()
    fill(fields)
    submit(fields)
    fireEvent.click(await screen.findByRole('button', { name: /add cuts by hand/i }))

    const panel = await screen.findByRole('dialog', { name: /add cut/i })
    const inputs = within(panel).queryAllByRole('textbox')
    expect(inputs.length).toBeGreaterThan(0)
    inputs.forEach((input) => expect(input.value).toBe(''))
  })

  it('PB35: a created batch gets a card on the Batches page', async () => {
    renderPage()
    const fields = await openNewBatchForm()
    fill(fields, { code: 'LF-1111' })
    submit(fields)

    await waitFor(async () => expect(await cardFor('LF-1111')).toBeTruthy())
    expect(h.state.db.batches.some((b) => b.batch_code === 'LF-1111' && b.farm_id === FARM_ID)).toBe(true)
  })

  it('PB36: if saving fails, shows an error and keeps the typed values', async () => {
    h.state.fail['batches.insert'] = true
    renderPage()
    const fields = await openNewBatchForm()
    fill(fields, { code: 'LF-2222', animal: 'Heifer #9', date: '2026-12-15' })
    submit(fields)

    expect(await screen.findByText(/something went wrong\. try again\./i)).toBeTruthy()
    expect(screen.getByLabelText(/batch code/i).value).toBe('LF-2222')
    expect(screen.getByLabelText(/animal/i).value).toBe('Heifer #9')
    expect(screen.getByLabelText(/processing date/i).value).toBe('2026-12-15')
  })
})