import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '/src/lib/supabase.js'

// batches_status_check only allows these two
export const STATUS_OPTIONS = ['active', 'done']

const ERROR_MSG = 'Something went wrong. Try again.'

const toInt = (v) => Math.max(0, parseInt(v, 10) || 0)
const toNumOrNull = (v) => (v === '' || v == null ? null : Number(v))
const sameCode = (a, b) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/**
 * - batch = null  → New batch flow: details → choose how to add cuts → (Add cut panel)
 * - batch = {...} → Edit an existing batch and its cuts
 */
export default function BatchForm({ batch, ...props }) {
  return batch ? <EditBatchForm batch={batch} {...props} /> : <NewBatchFlow {...props} />
}

/* ---------- Shared pieces ---------- */

function Modal({ title, onClose, busy, children }) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  return (
    <div
      className="batch-form-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="batch-form" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="batch-form-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="batch-form-x" onClick={onClose} aria-label="Close" disabled={busy}>
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

function FormError({ message }) {
  return message ? (
    <p className="batch-form-error" role="alert">
      {message}
    </p>
  ) : null
}

function useCowParts() {
  const [parts, setParts] = useState([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.from('cow_parts').select('id, name').order('id')
      if (error) console.error('Loading cow parts failed:', error)
      if (!cancelled && data) setParts(data)
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return parts
}

/* ---------- New batch (PB27–PB36) ---------- */

function NewBatchFlow({ farmId, existingCodes = [], onClose, onCreated, onCutsChanged }) {
  const navigate = useNavigate()
  const [step, setStep] = useState('details') // 'details' | 'next' | 'cut'
  const [fields, setFields] = useState({ batch_code: '', animal: '', processing_date: '' })
  const [created, setCreated] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const setField = (name) => (e) => setFields((f) => ({ ...f, [name]: e.target.value }))

  function validate() {
    const code = fields.batch_code.trim()
    if (!code) return 'Enter a batch code.'
    if (!fields.animal.trim()) return 'Enter the animal, for example Steer #16.'
    if (!fields.processing_date) return 'Choose the next processing date.'
    if (existingCodes.some((c) => sameCode(c, code))) return `This farm already has a batch called ${code}.`
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)
    setError(null)
    const { data, error } = await supabase
      .from('batches')
      .insert({
        farm_id: Number(farmId),
        batch_code: fields.batch_code.trim(),
        animal: fields.animal.trim(),
        processing_date: fields.processing_date,
        status: 'active',
      })
      .select('id, batch_code')
      .single()
    setSaving(false)

    if (error) {
      console.error('Creating batch failed:', error)
      // Typed values stay in the form (PB36)
      setError(
        error.code === '23505'
          ? `This farm already has a batch called ${fields.batch_code.trim()}.`
          : ERROR_MSG
      )
      return
    }

    setCreated(data)
    setStep('next')
    onCreated?.(data)
  }

  if (step === 'cut') {
    return (
      <Modal title="Add cut" onClose={onClose}>
        <AddCutPanel
          farmId={farmId}
          batchId={created.id}
          onAdded={onCutsChanged}
          onDone={onClose}
        />
      </Modal>
    )
  }

  if (step === 'next') {
    return (
      <Modal title={`${created.batch_code} created`} onClose={onClose}>
        <div className="batch-form-body">
          <p className="batch-form-lead">How do you want to add this batch’s cuts?</p>
          <div className="batch-form-choices">
            <button
              type="button"
              className="batch-form-choice"
              onClick={() => navigate(`/producer/import?batch=${created.id}`)}
            >
              <strong>Import a cut sheet</strong>
              <span>Upload the sheet from your processor.</span>
            </button>
            <button type="button" className="batch-form-choice" onClick={() => setStep('cut')}>
              <strong>Add cuts by hand</strong>
              <span>Enter each cut and its package count.</span>
            </button>
          </div>
        </div>
        <footer className="batch-form-foot">
          <button type="button" className="batches-btn batches-btn--outline" onClick={onClose}>
            Do this later
          </button>
        </footer>
      </Modal>
    )
  }

  return (
    <Modal title="New batch" onClose={onClose} busy={saving}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="batch-form-body">
          <div className="batch-form-grid">
            <label>
              Batch code
              <input value={fields.batch_code} onChange={setField('batch_code')} placeholder="LF-1010" />
            </label>
            <label>
              Animal
              <input value={fields.animal} onChange={setField('animal')} placeholder="Steer #15" />
            </label>
            <label>
              Next processing date
              <input type="date" value={fields.processing_date} onChange={setField('processing_date')} />
            </label>
          </div>
          <FormError message={error} />
        </div>
        <footer className="batch-form-foot">
          <button type="button" className="batches-btn batches-btn--outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="batches-btn batches-btn--dark" disabled={saving}>
            {saving ? 'Saving…' : 'Create batch'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}

/* ---------- Add cut panel (PB34) ---------- */

const EMPTY_CUT = { name: '', cow_part_id: '', total: '', price_per_pound: '', pounds_per_package: '' }

function AddCutPanel({ farmId, batchId, onAdded, onDone }) {
  const parts = useCowParts()
  const [fields, setFields] = useState(EMPTY_CUT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [added, setAdded] = useState([])

  const setField = (name) => (e) => setFields((f) => ({ ...f, [name]: e.target.value }))

  function validate() {
    if (!fields.name.trim()) return 'Enter a cut name.'
    if (parts.length > 0 && !fields.cow_part_id) return 'Choose which part of the cow it’s from.'
    if (toInt(fields.total) < 1) return 'Enter how many packages there are.'
    if (fields.price_per_pound !== '' && Number(fields.price_per_pound) <= 0) return 'Price per lb must be more than 0.'
    if (fields.pounds_per_package !== '' && Number(fields.pounds_per_package) <= 0) return 'Lbs per package must be more than 0.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)
    setError(null)
    const name = fields.name.trim()
    const { error } = await supabase.from('cuts').insert({
      batch_id: batchId,
      farm_id: Number(farmId),
      name,
      cow_part_id: fields.cow_part_id ? Number(fields.cow_part_id) : null,
      total: toInt(fields.total),
      sold: 0,
      held: 0,
      price_per_pound: toNumOrNull(fields.price_per_pound),
      pounds_per_package: toNumOrNull(fields.pounds_per_package),
    })
    setSaving(false)

    if (error) {
      console.error('Adding cut failed:', error)
      setError(error.code === '23505' ? `This batch already has a cut called ${name}.` : ERROR_MSG)
      return
    }

    setAdded((list) => [...list, name])
    setFields(EMPTY_CUT)
    onAdded?.()
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="batch-form-body">
        {added.length > 0 && (
          <p className="batch-form-success">Added: {added.join(', ')}. Add another, or click Done.</p>
        )}
        <div className="batch-form-grid">
          <label>
            Cut name
            <input value={fields.name} onChange={setField('name')} placeholder="Chuck roast" />
          </label>
          <label>
            Part of the cow
            <select value={fields.cow_part_id} onChange={setField('cow_part_id')}>
              <option value="">Choose a part</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            Packages
            <input type="number" min="1" value={fields.total} onChange={setField('total')} />
          </label>
          <label>
            Price per lb
            <input type="number" min="0" step="0.01" value={fields.price_per_pound} onChange={setField('price_per_pound')} />
          </label>
          <label>
            Lbs per package
            <input type="number" min="0" step="0.01" value={fields.pounds_per_package} onChange={setField('pounds_per_package')} />
          </label>
        </div>
        <FormError message={error} />
      </div>
      <footer className="batch-form-foot">
        <button type="button" className="batches-btn batches-btn--outline" onClick={onDone} disabled={saving}>
          Done
        </button>
        <button type="submit" className="batches-btn batches-btn--dark" disabled={saving}>
          {saving ? 'Saving…' : 'Save cut'}
        </button>
      </footer>
    </form>
  )
}

/* ---------- Edit batch ---------- */

let tempKey = 0
const emptyRow = () => ({ key: `new-${tempKey++}`, id: null, name: '', partId: '', total: '', sold: '', held: '' })

function EditBatchForm({ farmId, batch, existingCodes = [], onClose, onSaved }) {
  const parts = useCowParts()

  const [fields, setFields] = useState({
    batch_code: batch.code ?? '',
    animal: batch.animal ?? '',
    processing_date: batch.processingDate ?? '',
    status: batch.status ?? 'active',
  })
  const [cuts, setCuts] = useState(() =>
    batch.cuts.map((c) => ({ ...c, partId: c.partId ?? '', key: `id-${c.id}` }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const setField = (name) => (e) => setFields((f) => ({ ...f, [name]: e.target.value }))
  const setCut = (key, name) => (e) =>
    setCuts((list) => list.map((c) => (c.key === key ? { ...c, [name]: e.target.value } : c)))
  const removeCut = (key) => setCuts((list) => list.filter((c) => c.key !== key))
  const addCut = () => setCuts((list) => [...list, emptyRow()])

  function validate() {
    const code = fields.batch_code.trim()
    if (!code) return 'Enter a batch code.'
    if (!fields.animal.trim()) return 'Enter the animal, for example Steer #16.'
    if (existingCodes.some((c) => sameCode(c, code))) return `This farm already has a batch called ${code}.`
    const names = cuts.map((c) => c.name.trim().toLowerCase())
    const dup = names.find((n, i) => n && names.indexOf(n) !== i)
    if (dup) return `Two cuts are both named "${dup}". Each cut name must be unique in a batch.`
    for (const c of cuts) {
      if (!c.name.trim()) return 'Every cut needs a name.'
      if (toInt(c.sold) + toInt(c.held) > toInt(c.total)) return `${c.name}: sold + held can't be more than total.`
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { error: batchError } = await supabase
        .from('batches')
        .update({
          batch_code: fields.batch_code.trim(),
          animal: fields.animal.trim(),
          processing_date: fields.processing_date || null,
          status: fields.status,
        })
        .eq('id', batch.id)
      if (batchError) throw batchError

      const keptIds = cuts.filter((c) => c.id).map((c) => c.id)
      const removedIds = batch.cuts.map((c) => c.id).filter((id) => !keptIds.includes(id))
      if (removedIds.length) {
        const { error } = await supabase.from('cuts').delete().in('id', removedIds)
        if (error) throw error
      }

      const toRow = (c) => ({
        name: c.name.trim(),
        cow_part_id: c.partId === '' ? null : Number(c.partId),
        total: toInt(c.total),
        sold: toInt(c.sold),
        held: toInt(c.held),
      })

      const results = await Promise.all(
        cuts.filter((c) => c.id).map((c) => supabase.from('cuts').update(toRow(c)).eq('id', c.id))
      )
      for (const { error } of results) if (error) throw error

      const newRows = cuts
        .filter((c) => !c.id)
        .map((c) => ({ ...toRow(c), batch_id: batch.id, farm_id: Number(farmId) }))
      if (newRows.length) {
        const { error } = await supabase.from('cuts').insert(newRows)
        if (error) throw error
      }

      onSaved()
    } catch (err) {
      console.error('Saving batch failed:', err)
      setError(
        err.code === '23505' && err.message?.includes('batch_code')
          ? `This farm already has a batch called ${fields.batch_code.trim()}.`
          : ERROR_MSG
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Edit ${batch.code}`} onClose={onClose} busy={saving}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="batch-form-body">
          <div className="batch-form-grid">
            <label>
              Batch code
              <input value={fields.batch_code} onChange={setField('batch_code')} />
            </label>
            <label>
              Animal
              <input value={fields.animal} onChange={setField('animal')} />
            </label>
            <label>
              Next processing date
              <input type="date" value={fields.processing_date} onChange={setField('processing_date')} />
            </label>
            <label>
              Status
              <select value={fields.status} onChange={setField('status')}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <h3 className="batch-form-sub">Cuts</h3>
          <table className="batch-form-cuts">
            <thead>
              <tr>
                <th>Name</th>
                <th>Part</th>
                <th>Total</th>
                <th>Sold</th>
                <th>Held</th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {cuts.map((c) => (
                <tr key={c.key}>
                  <td>
                    <input value={c.name} onChange={setCut(c.key, 'name')} aria-label="Cut name" />
                  </td>
                  <td>
                    <select value={c.partId} onChange={setCut(c.key, 'partId')} aria-label={`${c.name || 'Cut'} part`}>
                      <option value="">—</option>
                      {parts.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>
                  {['total', 'sold', 'held'].map((f) => (
                    <td key={f}>
                      <input
                        type="number"
                        min="0"
                        value={c[f]}
                        onChange={setCut(c.key, f)}
                        aria-label={`${c.name || 'Cut'} ${f}`}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="batch-form-remove"
                      onClick={() => removeCut(c.key)}
                      aria-label={`Remove ${c.name || 'cut'}`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="batches-btn batches-btn--outline" onClick={addCut}>
            + Add cut
          </button>

          <FormError message={error} />
        </div>

        <footer className="batch-form-foot">
          <button type="button" className="batches-btn batches-btn--outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="batches-btn batches-btn--dark" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}