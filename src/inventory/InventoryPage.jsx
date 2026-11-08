import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchInventory } from './inventoryApi'
import {
  CHIPS, availableOf, chipCounts, filterCuts, groupCuts, headerTotals, onHandByPart, rowStatus,
} from './inventory'
import './inventory.css'

function CutRow({ cut }) {
  const available = availableOf(cut)
  const state = rowStatus(cut)
  return (
    <li className="inv-row">
      <div className="inv-photo" aria-hidden="true">
        {cut.photo && <img src={cut.photo} alt="" />}
      </div>
      <div className="inv-name">
        <strong>
          {cut.name}
          {cut.isFeatured && <span className="inv-star" role="img" aria-label="Featured">★</span>}
        </strong>
        <small>{cut.batchCode} · ${cut.pricePerPound.toFixed(2)}/LB</small>
      </div>
      <div className="inv-stock">
        <span className={state === 'sold-out' ? 'inv-available is-sold-out' : 'inv-available'}>
          {available} available
        </span>
        <small>{cut.held} held · {cut.onHand} on hand</small>
      </div>
      {state === 'low' && <span className="inv-tag low">Running low</span>}
      <span className={cut.isLive ? 'inv-tag live' : 'inv-tag'}>{cut.isLive ? 'Live' : 'Draft'}</span>
    </li>
  )
}

export default function InventoryPage() {
  const [cuts, setCuts] = useState([])
  const [status, setStatus] = useState('loading')
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState('all')
  const [part, setPart] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchInventory()
      .then(({ cuts: loaded }) => {
        if (cancelled) return
        setCuts(loaded)
        setStatus('ready')
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [])

  const totals = useMemo(() => headerTotals(cuts), [cuts])
  const counts = useMemo(() => chipCounts(cuts), [cuts])
  const bars = useMemo(() => onHandByPart(cuts), [cuts])
  const groups = useMemo(
    () => groupCuts(filterCuts(cuts, { search, chip, part })),
    [cuts, search, chip, part],
  )

  if (status === 'loading') return <p className="inv-message">Loading inventory…</p>
  if (status === 'error') return <p className="inv-message" role="alert">Something went wrong. Try again.</p>
  if (cuts.length === 0) {
    return (
      <div className="inv">
        <p className="inv-message">No cuts yet. Import a cut sheet or add a cut.</p>
        <Link className="inv-button" to="/producer/import">Import CSV</Link>
      </div>
    )
  }

  const maxOnHand = Math.max(...bars.map((bar) => bar.onHand), 1)

  return (
    <div className="inv">
      <div className="inv-toolbar">
        <p className="inv-totals">{totals.available} available · {totals.cuts} cuts</p>
        <input
          type="search"
          className="inv-search"
          placeholder="Search cuts…"
          aria-label="Search cuts"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Link className="inv-button" to="/producer/import">Import CSV</Link>
      </div>

      <div className="inv-chips" role="group" aria-label="Filter cuts">
        {CHIPS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={chip === key ? 'inv-chip is-selected' : 'inv-chip'}
            aria-pressed={chip === key}
            onClick={() => setChip(key)}
          >
            {label} {counts[key]}
          </button>
        ))}
      </div>

      <section className="inv-animal" aria-label="Inventory across the animal">
        <h2>Inventory across the animal</h2>
        <ul>
          {bars.map(({ part: name, onHand }) => (
            <li key={name}>
              <button
                type="button"
                className={part === name ? 'inv-bar-row is-selected' : 'inv-bar-row'}
                aria-pressed={part === name}
                onClick={() => setPart(part === name ? null : name)}
              >
                <span className="inv-bar-label">{name}</span>
                <span className="inv-bar"><span style={{ width: (onHand / maxOnHand) * 100 + '%' }} /></span>
                <span className="inv-bar-count">{onHand}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {groups.length === 0 ? (
        <p className="inv-message">{search.trim() ? 'No cuts match your search.' : 'No cuts match this filter.'}</p>
      ) : (
        groups.map((group) => (
          <section key={group.name} className="inv-group">
            <h2>{group.name} <span>{group.onHand} PKGS</span></h2>
            <ul>{group.cuts.map((cut) => <CutRow key={cut.id} cut={cut} />)}</ul>
          </section>
        ))
      )}
    </div>
  )
}