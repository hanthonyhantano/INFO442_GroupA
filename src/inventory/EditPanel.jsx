export default function EditPanel({
  cut, draft, errors, saving, saveError, confirmDiscard,
  onChange, onStep, onSave, onClose, onDiscard, onKeep,
}) {
  const onHandNumber = Number(draft.onHand)
  // "-" stops at 0 and at the held count, so it can't push on hand below held.
  const canDecrease = onHandNumber > Math.max(cut.held, 0)

  return (
    <aside className="inv-panel" aria-label="Edit cut">
      <div className="inv-panel-top">
        <span className="inv-panel-label">SELECTED</span>
        <button type="button" className="inv-panel-close" aria-label="Close panel" onClick={onClose}>×</button>
      </div>

      <div className="inv-panel-photo" aria-hidden="true">
        {cut.photo && <img src={cut.photo} alt="" />}
      </div>
      <h2>{cut.name}</h2>

      <label htmlFor="inv-description">Description</label>
      <textarea
        id="inv-description"
        rows={3}
        value={draft.description}
        onChange={(event) => onChange('description', event.target.value)}
      />

      <div className="inv-panel-pair">
        <div>
          <label htmlFor="inv-on-hand">On hand</label>
          <div className="inv-stepper">
            <button type="button" aria-label="Decrease on hand" disabled={!canDecrease} onClick={() => onStep(-1)}>−</button>
            <input
              id="inv-on-hand"
              inputMode="numeric"
              value={draft.onHand}
              onChange={(event) => onChange('onHand', event.target.value)}
            />
            <button type="button" aria-label="Increase on hand" onClick={() => onStep(1)}>+</button>
          </div>
          {errors.onHand && <span className="inv-error" role="alert">{errors.onHand}</span>}
        </div>
        <div>
          <span className="inv-label">Held for orders</span>
          <strong className="inv-held">{cut.held}</strong>
        </div>
      </div>

      <div className="inv-panel-pair">
        <div>
          <label htmlFor="inv-price">Price / lb</label>
          <input
            id="inv-price"
            inputMode="decimal"
            value={draft.pricePerPound}
            onChange={(event) => onChange('pricePerPound', event.target.value)}
          />
          {errors.pricePerPound && <span className="inv-error" role="alert">{errors.pricePerPound}</span>}
        </div>
        <div>
          <label htmlFor="inv-weight">Lb / pkg</label>
          <input
            id="inv-weight"
            inputMode="decimal"
            value={draft.poundsPerPackage}
            onChange={(event) => onChange('poundsPerPackage', event.target.value)}
          />
          {errors.poundsPerPackage && <span className="inv-error" role="alert">{errors.poundsPerPackage}</span>}
        </div>
      </div>

      <label className="inv-toggle">
        <span>Live on shop<small>Off = draft, hidden from shoppers</small></span>
        <input type="checkbox" checked={draft.isLive} onChange={(event) => onChange('isLive', event.target.checked)} />
      </label>
      <label className="inv-toggle">
        <span>Feature on shop<small>Appears as Farmer's pick</small></span>
        <input type="checkbox" checked={draft.isFeatured} onChange={(event) => onChange('isFeatured', event.target.checked)} />
      </label>

      {saveError && <p className="inv-error" role="alert">{saveError}</p>}

      {confirmDiscard ? (
        <div className="inv-discard" role="alertdialog" aria-label="Discard your changes?">
          <p>Discard your changes?</p>
          <button type="button" onClick={onDiscard}>Discard</button>
          <button type="button" onClick={onKeep}>Keep editing</button>
        </div>
      ) : (
        <button type="button" className="inv-save" disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      )}
    </aside>
  )
}