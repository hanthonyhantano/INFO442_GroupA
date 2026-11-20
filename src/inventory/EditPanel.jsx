export default function EditPanel({
  cut, isNew, draft, errors, saving, saveError, confirmDiscard, partOptions, batchOptions,
  onChange, onStep, onSave, onClose, onDiscard, onKeep,
}) {
  const held = cut?.held ?? 0
  // "-" stops at 0 and at the held count, so it can't push on hand below held.
  const canDecrease = Number(draft.onHand) > held

  return (
    <aside className="inv-panel" aria-label={isNew ? 'Add cut' : 'Edit cut'}>
      <div className="inv-panel-top">
        <span className="inv-panel-label">{isNew ? 'NEW CUT' : 'SELECTED'}</span>
        <button type="button" className="inv-panel-close" aria-label="Close panel" onClick={onClose}>×</button>
      </div>

      <div className="inv-panel-photo" aria-hidden="true">
        {cut?.photo && <img src={cut.photo} alt="" />}
      </div>

      {isNew ? (
        <>
          <label htmlFor="inv-new-name">Name</label>
          <input
            id="inv-new-name"
            className="inv-text"
            value={draft.name}
            onChange={(event) => onChange('name', event.target.value)}
          />
          {errors.name && <span className="inv-error" role="alert">{errors.name}</span>}

          <label htmlFor="inv-part">Part of the cow</label>
          <select id="inv-part" value={draft.partId} onChange={(event) => onChange('partId', event.target.value)}>
            <option value="">Choose a part</option>
            {partOptions.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}
          </select>
          {errors.partId && <span className="inv-error" role="alert">{errors.partId}</span>}

          <label htmlFor="inv-batch">Batch</label>
          <select id="inv-batch" value={draft.batchId} onChange={(event) => onChange('batchId', event.target.value)}>
            <option value="">Choose a batch</option>
            {batchOptions.map((batch) => <option key={batch.id} value={batch.id}>{batch.label}</option>)}
          </select>
          {errors.batchId && <span className="inv-error" role="alert">{errors.batchId}</span>}
        </>
      ) : (
        <h2>{cut.name}</h2>
      )}

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
        {!isNew && (
          <div>
            <span className="inv-label">Held for orders</span>
            <strong className="inv-held">{cut.held}</strong>
          </div>
        )}
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