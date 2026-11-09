import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createCut, fetchInventory, saveCut } from './inventoryApi'
import {
  CHIPS, availableOf, chipCounts, filterCuts, groupCuts, headerTotals, isDirty, onHandByPart, rowStatus, validateCut,
} from './inventory'
import EditPanel from './EditPanel'
import CowDiagram from '../discovery/CowDiagram'
import './inventory.css'

const NEW = 'new'
const BLANK_DRAFT = {
  name: '', partId: '', batchId: '', description: '', onHand: '',
  pricePerPound: '', poundsPerPackage: '', isLive: false, isFeatured: false,
}

function toDraft(cut) {
  return {
    description: cut.description,
    onHand: String(cut.onHand),
    pricePerPound: String(cut.pricePerPound),
    poundsPerPackage: String(cut.poundsPerPackage),
    isLive: cut.isLive,
    isFeatured: cut.isFeatured,
  }
}

function CutRow({ cut, selected, onSelect }) {
  const available = availableOf(cut)
  const state = rowStatus(cut)
  return (
    <li>
      <button type="button" className={selected ? 'inv-row is-selected' : 'inv-row'} aria-pressed={selected} onClick={() => onSelect(cut.id)}>
        <span className="inv-photo" aria-hidden="true">
          {cut.photo && <img src={cut.photo} alt="" />}
        </span>
        <span className="inv-name">
          <strong>
            {cut.name}
            {cut.isFeatured && <span className="inv-star" role="img" aria-label="Featured">★</span>}
          </strong>
          <small>{cut.batchCode} · ${cut.pricePerPound.toFixed(2)}/LB</small>
        </span>
        <span className="inv-stock">
          <span className={state === 'sold-out' ? 'inv-available is-sold-out' : 'inv-available'}>
            {available} available
          </span>
          <small>{cut.held} held · {cut.onHand} on hand</small>
        </span>
        {state === 'low' && <span className="inv-tag low">Running low</span>}
        <span className={cut.isLive ? 'inv-tag live' : 'inv-tag'}>{cut.isLive ? 'Live' : 'Draft'}</span>
      </button>
    </li>
  )
}

export default function InventoryPage() {
  const [farmId, setFarmId] = useState(null)
  const [cuts, setCuts] = useState([])
  const [partOptions, setPartOptions] = useState([])
  const [batchOptions, setBatchOptions] = useState([])
  const [status, setStatus] = useState('loading')
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState('all')
  const [part, setPart] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [pending, setPending] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchInventory()
      .then((result) => {
        if (cancelled) return
        setFarmId(result.farmId)
        setCuts(result.cuts)
        setPartOptions(result.parts)
        setBatchOptions(result.batches)
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

  const isNew = selectedId === NEW
  const panelOpen = selectedId !== null && draft !== null
  const selected = isNew ? null : cuts.find((cut) => cut.id === selectedId) ?? null
  const dirty = isNew
    ? JSON.stringify(draft) !== JSON.stringify(BLANK_DRAFT)
    : Boolean(selected && draft && isDirty(selected, draft))

  function openCut(id) {
    const cut = cuts.find((item) => item.id === id)
    setSelectedId(id)
    setDraft(toDraft(cut))
    setErrors({})
    setSaveError('')
    setPending(null)
  }
  function openNew() {
    setSelectedId(NEW)
    setDraft({ ...BLANK_DRAFT })
    setErrors({})
    setSaveError('')
    setPending(null)
  }
  function closePanel() {
    setSelectedId(null)
    setDraft(null)
    setErrors({})
    setSaveError('')
    setPending(null)
  }
  function run(action) {
    if (action.type === 'close') closePanel()
    else if (action.type === 'new') openNew()
    else openCut(action.id)
  }
  function request(action) {
    if (dirty) setPending(action)
    else run(action)
  }
  function selectRow(id) {
    if (id !== selectedId) request({ type: 'open', id })
  }
  function addCut() {
    if (!isNew) request({ type: 'new' })
  }
  function change(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }
  function togglePart(name) {
    setPart((current) => (current === name ? null : name))
  }
  function step(delta) {
    const current = Number(draft.onHand)
    const base = Number.isInteger(current) ? current : 0
    change('onHand', String(Math.max(0, base + delta)))
  }

  async function save() {
    if (isNew) {
      const found = validateCut(draft, { isNew: true })
      if (!draft.partId) found.partId = 'Choose a part of the cow.'
      if (!draft.batchId) found.batchId = 'Choose a batch.'
      setErrors(found)
      if (Object.keys(found).length > 0) return
      setSaving(true)
      setSaveError('')
      try {
        const created = await createCut(farmId, draft)
        setCuts((list) => [...list, created])
        // Clear filters so the new cut is visible in the list.
        setSearch('')
        setChip('all')
        setPart(null)
        setSelectedId(created.id)
        setDraft(toDraft(created))
      } catch (error) {
        if (error?.code === '23505') setErrors({ name: 'A cut with this name already exists in that batch.' })
        else setSaveError('Something went wrong. Try again.')
      } finally {
        setSaving(false)
      }
      return
    }

    const found = validateCut(draft, { held: selected.held, savedOnHand: selected.onHand })
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    setSaveError('')
    try {
      await saveCut(selected.id, draft)
      const updated = {
        ...selected,
        description: draft.description,
        onHand: Number(draft.onHand),
        pricePerPound: Number(draft.pricePerPound),
        poundsPerPackage: Number(draft.poundsPerPackage),
        isLive: draft.isLive,
        isFeatured: draft.isFeatured,
      }
      setCuts((list) => list.map((cut) => (cut.id === updated.id ? updated : cut)))
      setDraft(toDraft(updated))
    } catch {
      setSaveError('Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') return <p className="inv-message">Loading inventory…</p>
  if (status === 'error') return <p className="inv-message" role="alert">Something went wrong. Try again.</p>

  const maxOnHand = Math.max(...bars.map((bar) => bar.onHand), 1)

  return (
    <div className={panelOpen ? 'inv-layout has-panel' : 'inv-layout'}>
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
          <button type="button" className="inv-button primary" onClick={addCut}>+ Add cut</button>
        </div>

        {cuts.length === 0 ? (
          <p className="inv-message">No cuts yet. Import a cut sheet or add a cut.</p>
        ) : (
          <>
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
              <div className="inv-animal-body">
                <div className="inv-cow">
                  <CowDiagram selected={part} onSelect={togglePart} />
                </div>
                <ul>
                  {bars.map(({ part: name, onHand }) => (
                    <li key={name}>
                      <button
                        type="button"
                        className={part === name ? 'inv-bar-row is-selected' : 'inv-bar-row'}
                        aria-pressed={part === name}
                        onClick={() => togglePart(name)}
                      >
                        <span className="inv-bar-label">{name}</span>
                        <span className="inv-bar"><span style={{ width: (onHand / maxOnHand) * 100 + '%' }} /></span>
                        <span className="inv-bar-count">{onHand}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {groups.length === 0 ? (
              <p className="inv-message">{search.trim() ? 'No cuts match your search.' : 'No cuts match this filter.'}</p>
            ) : (
              groups.map((group) => (
                <section key={group.name} className="inv-group">
                  <h2>{group.name} <span>{group.onHand} PKGS</span></h2>
                  <ul>
                    {group.cuts.map((cut) => (
                      <CutRow key={cut.id} cut={cut} selected={cut.id === selectedId} onSelect={selectRow} />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </>
        )}
      </div>

      {panelOpen && (
        <EditPanel
          cut={selected}
          isNew={isNew}
          draft={draft}
          errors={errors}
          saving={saving}
          saveError={saveError}
          confirmDiscard={pending !== null}
          partOptions={partOptions}
          batchOptions={batchOptions}
          onChange={change}
          onStep={step}
          onSave={save}
          onClose={() => request({ type: 'close' })}
          onDiscard={() => run(pending)}
          onKeep={() => setPending(null)}
        />
      )}
    </div>
  )
}