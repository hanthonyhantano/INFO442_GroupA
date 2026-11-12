import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '/src/lib/supabase.js'
import BatchForm from './BatchForm'

const ERROR_MSG = 'Something went wrong. Try again.'

export function pct(n, d) {
  return d > 0 ? Math.round((n / d) * 100) : 0
}

/* ---------- Data shaping ---------- */

function mapCut(c) {
  return {
    id: c.id,
    name: c.name,
    partId: c.cow_part_id ?? null,
    partName: c.cow_parts?.name ?? c.name,
    total: Number(c.total ?? 0),
    sold: Number(c.sold ?? 0),
    held: Number(c.held ?? 0),
    featured: Boolean(c.featured),
  }
}

function mapBatch(b) {
  return {
    id: b.id,
    code: b.batch_code,
    animal: b.animal,
    processingDate: b.processing_date,
    status: b.status,
    createdAt: b.created_at,
    cuts: (b.cuts ?? []).map(mapCut),
  }
}

// One entry per part of the cow (PB11–PB20). Cuts without a part stand on their own.
function groupByPart(cuts) {
  const parts = new Map()
  for (const c of cuts) {
    const key = c.partId ?? `cut-${c.id}`
    const p = parts.get(key) ?? {
      key,
      partId: c.partId,
      name: c.partName,
      total: 0,
      sold: 0,
      held: 0,
      cutIds: [],
      featured: true,
    }
    p.total += c.total
    p.sold += c.sold
    p.held += c.held
    p.cutIds.push(c.id)
    p.featured = p.featured && c.featured
    parts.set(key, p)
  }
  return [...parts.values()]
    .filter((p) => p.total > 0)
    .map((p) => ({ ...p, left: Math.max(p.total - p.sold - p.held, 0) }))
    .sort((a, b) => (a.partId ?? Infinity) - (b.partId ?? Infinity))
}

function batchTotals(batch) {
  const total = batch.cuts.reduce((s, c) => s + c.total, 0)
  const sold = batch.cuts.reduce((s, c) => s + c.sold, 0)
  return { total, sold }
}

const time = (iso) => Date.parse(iso) || 0

// Apply a realtime change on the cuts table to the batches in state (PB21)
function applyCutChange(batches, payload) {
  const row = payload.new ?? {}
  if (payload.eventType === 'DELETE') {
    const id = payload.old?.id
    return batches.map((b) => ({ ...b, cuts: b.cuts.filter((c) => c.id !== id) }))
  }
  if (payload.eventType === 'UPDATE') {
    return batches.map((b) => ({
      ...b,
      cuts: b.cuts.map((c) =>
        c.id === row.id
          ? {
              ...c,
              name: row.name ?? c.name,
              total: Number(row.total ?? c.total),
              sold: Number(row.sold ?? c.sold),
              held: Number(row.held ?? c.held),
              featured: row.featured ?? c.featured,
            }
          : c
      ),
    }))
  }
  return batches
}

/* ---------- Data loading ---------- */

function useProducerBatches(farmId) {
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState(0)
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!farmId) {
      setLoading(false)
      setError(new Error('No farmId passed to <Batches />'))
      return
    }
    let cancelled = false

    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('batches')
        .select(
          'id, batch_code, animal, processing_date, status, created_at, cuts ( *, cow_parts ( id, name ) )'
        )
        .eq('farm_id', Number(farmId))
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (error) console.error('Batches query failed:', error)
      setError(error)
      if (!error) setBatches((data ?? []).map(mapBatch))
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [farmId, version])

  // Live updates when cuts change elsewhere, e.g. an order is confirmed (PB21)
  useEffect(() => {
    if (!farmId) return
    const channel = supabase
      .channel(`producer-cuts-${farmId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cuts', filter: `farm_id=eq.${farmId}` },
        (payload) => setBatches((prev) => applyCutChange(prev, payload))
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [farmId])

  return { batches, setBatches, loading, error, reload }
}

/* ---------- Page ---------- */

export default function Batches({ farmId }) {
  const navigate = useNavigate()
  const { batches: all, setBatches, loading, error, reload } = useProducerBatches(farmId)

  // Not-done batches, newest first (PB3, PB8)
  const active = useMemo(
    () => all.filter((b) => b.status !== 'done').sort((a, b) => time(b.createdAt) - time(a.createdAt)),
    [all]
  )
  const doneCount = all.length - active.length

  const [selectedId, setSelectedId] = useState(null)
  const selected = active.find((b) => b.id === selectedId) ?? active[0]

  const parts = useMemo(() => (selected ? groupByPart(selected.cuts) : []), [selected])

  // Two parts with the most packages left (PB22)
  const slowest = useMemo(
    () => parts.filter((p) => p.left > 0).sort((a, b) => b.left - a.left).slice(0, 2),
    [parts]
  )
  const slowCutIds = slowest.flatMap((p) => p.cutIds)
  const allFeatured = slowest.length > 0 && slowest.every((p) => p.featured)

  // null = closed, 'new' = creating, batch object = editing
  const [formFor, setFormFor] = useState(null)
  const [featuring, setFeaturing] = useState(false)
  const [featureError, setFeatureError] = useState(false)

  function selectBatch(id) {
    setSelectedId(id)
    setFeatureError(false)
  }

  // PB24 / PB25 — one update for all cuts, so it either all saves or nothing changes
  async function toggleFeatured() {
    if (!slowCutIds.length) return
    const value = !allFeatured
    setFeaturing(true)
    setFeatureError(false)
    const { error } = await supabase.from('cuts').update({ featured: value }).in('id', slowCutIds)
    setFeaturing(false)
    if (error) {
      console.error('Featuring cuts failed:', error)
      setFeatureError(true)
      return
    }
    setBatches((prev) =>
      prev.map((b) => ({
        ...b,
        cuts: b.cuts.map((c) => (slowCutIds.includes(c.id) ? { ...c, featured: value } : c)),
      }))
    )
  }

  // PB26
  function viewCuts() {
    const partIds = slowest.map((p) => p.partId).filter((id) => id != null)
    navigate(`/producer/inventory?batch=${selected.id}&parts=${partIds.join(',')}`)
  }

  const slowestText =
    slowest.length > 1
      ? `${slowest[0].name} and ${slowest[1].name.toLowerCase()} are filling slowest.`
      : slowest.length === 1
        ? `${slowest[0].name} is filling slowest.`
        : ''

  const featureLabel = featuring
    ? 'Saving…'
    : allFeatured
      ? slowest.length > 1 ? 'Unfeature both' : 'Unfeature'
      : slowest.length > 1 ? 'Feature both' : 'Feature it'

  return (
    <div className="batches">
      <header className="batches-header">
        <button type="button" className="batches-btn batches-btn--dark" onClick={() => setFormFor('new')}>
          + New batch
        </button>
      </header>

      <div className="batches-body">
        {loading && all.length === 0 && !error && <p className="batches-msg">Loading batches…</p>}

        {/* PB1 */}
        {!loading && error && (
          <p className="batches-msg" role="alert">{ERROR_MSG}</p>
        )}

        {/* PB2 */}
        {!loading && !error && all.length === 0 && (
          <p className="batches-msg">No batches yet. Import your first cut sheet.</p>
        )}

        {/* Batch cards (PB3–PB10) */}
        {all.length > 0 && (
          <div className="batches-tabs" role="tablist" aria-label="Batches">
            {active.map((b) => {
              const { total, sold } = batchTotals(b)
              const isSelected = b.id === selected?.id
              return (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`batches-tab${isSelected ? ' is-active' : ''}`}
                  onClick={() => selectBatch(b.id)}
                >
                  <span className="batches-tab-code">{b.code}</span>
                  <span className="batches-tab-meta">
                    {b.animal} · {pct(sold, total)}% sold
                  </span>
                </button>
              )
            })}
            {doneCount > 0 && <span className="batches-done">+{doneCount} done</span>}
          </div>
        )}

        {selected && (
          <>
            {/* Chart (PB11–PB20) */}
            <section className="batches-card">
              <div className="batches-card-head">
                <div>
                  <h2 className="batches-card-title">{`${selected.code} · how the animal is selling`}</h2>
                  <p className="batches-card-sub">Column width = share of packages</p>
                </div>
                <div className="batches-card-tools">
                  <ul className="batches-legend">
                    <li><span className="swatch swatch--sold" />Sold</li>
                    <li><span className="swatch swatch--held" />Held</li>
                    <li><span className="swatch swatch--freezer" />In freezer</li>
                  </ul>
                  <button
                    type="button"
                    className="batches-btn batches-btn--outline"
                    onClick={() => setFormFor(selected)}
                  >
                    Edit batch
                  </button>
                </div>
              </div>

              {parts.length === 0 ? (
                <p className="batches-msg">No packages in this batch yet.</p>
              ) : (
                <div className="batches-chart">
                  {parts.map((p) => (
                    <div key={p.key} className="batches-col" style={{ flexGrow: p.total }}>
                      <div
                        className="batches-bar"
                        role="img"
                        aria-label={`${p.name}: ${p.sold} sold, ${p.held} held, ${p.left} in freezer`}
                      >
                        <div className="batches-bar-held" style={{ height: `${(p.held / p.total) * 100}%` }} />
                        <div className="batches-bar-sold" style={{ height: `${(p.sold / p.total) * 100}%` }} />
                      </div>
                      <div className="batches-col-name">
                        {p.name}
                        {p.featured && <span className="batches-star" title="Featured on shop"> ★</span>}
                      </div>
                      <div className="batches-col-pct">{pct(p.sold, p.total)}%</div>
                      <div className="batches-col-left">{p.left} left</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Slowest parts bar (PB22–PB26) */}
            {slowest.length > 0 && (
              <section className="batches-insight">
                <div>
                  <p>{slowestText}</p>
                  {featureError && (
                    <span className="batches-insight-note is-error" role="alert">{ERROR_MSG}</span>
                  )}
                  {!featureError && allFeatured && (
                    <span className="batches-insight-note">Featured on shop.</span>
                  )}
                </div>
                <div className="batches-insight-actions">
                  <button
                    type="button"
                    className={`batches-btn ${allFeatured ? 'batches-btn--outline' : 'batches-btn--dark'}`}
                    onClick={toggleFeatured}
                    disabled={featuring}
                  >
                    {featureLabel}
                  </button>
                  <button type="button" className="batches-btn batches-btn--outline" onClick={viewCuts}>
                    View cuts
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {formFor && (
        <BatchForm
          farmId={farmId}
          batch={formFor === 'new' ? null : formFor}
          existingCodes={all.filter((b) => b.id !== formFor?.id).map((b) => b.code)}
          onClose={() => setFormFor(null)}
          onCreated={(created) => {
            setSelectedId(created.id)
            reload()
          }}
          onCutsChanged={reload}
          onSaved={() => {
            setFormFor(null)
            reload()
          }}
        />
      )}
    </div>
  )
}