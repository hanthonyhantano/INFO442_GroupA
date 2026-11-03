import { useEffect, useRef, useState } from 'react'
import { useNavigation } from '../navigation/useNavigation'
import { isValidZip } from '../navigation/navigation'

export default function ZipControl() {
  const { zip, setDeliveryZip } = useNavigation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(zip)
  const [error, setError] = useState('')
  const container = useRef(null)
  const trigger = useRef(null)
  const input = useRef(null)
  function close() { setOpen(false); trigger.current?.focus() }
  useEffect(() => {
    if (!open) return
    input.current?.focus()
    function outside(event) { if (!container.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  function submit(event) {
    event.preventDefault()
    const value = draft.trim()
    if (!isValidZip(value)) { setError('Enter a 5-digit ZIP code.'); return }
    setDeliveryZip(value); close()
  }
  return <div className="zip-control" ref={container} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); close() }
  }}>
    <button className="shopper-pill" ref={trigger} aria-expanded={open} aria-controls="delivery-zip-panel"
      onClick={() => { setDraft(zip); setError(''); setOpen(!open) }}>
      <span className="location-icon" aria-hidden="true">⌖</span>
      <span>{zip || 'Set ZIP'}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <form id="delivery-zip-panel" className="zip-panel" aria-label="Delivery ZIP code" onSubmit={submit} noValidate>
      <label htmlFor="delivery-zip">Delivery ZIP code</label>
      <input ref={input} id="delivery-zip" inputMode="numeric" autoComplete="postal-code" maxLength={5}
        value={draft} onChange={event => { setDraft(event.target.value); setError('') }}
        aria-invalid={Boolean(error)} aria-describedby={error ? 'zip-error' : 'zip-help'} />
      <p id="zip-help">Choose the ZIP for your local shopping area.</p>
      {error && <p id="zip-error" role="alert">{error}</p>}
      <div className="zip-actions"><button type="submit">Save ZIP</button>
        {zip && <button type="button" onClick={() => { setDeliveryZip(''); close() }}>Clear</button>}
        <button type="button" onClick={close}>Cancel</button></div>
    </form>}
  </div>
}
