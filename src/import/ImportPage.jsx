import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  autoMap,
  CATEGORIES,
  FIELDS,
  importPlan,
  mappingComplete,
  MAX_BYTES,
  MAX_ROWS,
  parseCsv,
  reviewRows,
  TEMPLATE,
} from './csv'
import './import.css'
import { readImportSession, saveImportSession } from './session'

// Integration contract: inventory uses Selene's normalized cut shape.
// onImport(plan) resolves only after an atomic, idempotent save succeeds.
export default function ImportPage({ inventory = null, onImport, categories = CATEGORIES }) {
  const [restored] = useState(readImportSession)
  const [storageError, setStorageError] = useState(false)
  const [step, setStep] = useState(restored?.step ?? 0)
  const [file, setFile] = useState(restored?.file ?? null)
  const [mapping, setMapping] = useState(restored?.mapping ?? {})
  const [skipErrors, setSkipErrors] = useState(restored?.skipErrors ?? false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(restored?.saved ?? 0)
  const request = useRef(0)
  const saveLock = useRef(false)
  const [transaction, setTransaction] = useState(restored?.transaction ?? null)
  const rows = file ? reviewRows(file.records, mapping, inventory, categories) : []
  const ready = rows.filter((row) => !Object.keys(row.errors).length)
  const invalid = rows.length - ready.length
  const connected = inventory !== null && typeof onImport === 'function'

  useEffect(() => {
    // Report whether synchronization with browser storage succeeded.
    // eslint-disable-next-line react/set-state-in-effect
    setStorageError(!saveImportSession({ step, file, mapping, skipErrors, saved, transaction }))
  }, [step, file, mapping, skipErrors, saved, transaction])

  async function upload(selected) {
    if (!selected || saveLock.current) return
    const version = ++request.current
    setError('')
    if (!/\.csv$/i.test(selected.name)) {
      setError('Choose a CSV file.')
      setBusy(false)
      return
    }
    if (selected.size > MAX_BYTES) {
      setError('Choose a CSV file smaller than 5 MB.')
      setBusy(false)
      return
    }
    setBusy(true)
    try {
      const parsed = parseCsv(await selected.text())
      if (version !== request.current) return
      setFile({ name: selected.name, ...parsed })
      setMapping(autoMap(parsed.headers))
      setSkipErrors(false)
      setTransaction(null)
      setStep(1)
    } catch (failure) {
      if (version === request.current) setError(failure.message)
    } finally {
      if (version === request.current) setBusy(false)
    }
  }

  function edit(rowNumber, key, value) {
    setFile((current) => ({
      ...current,
      records: current.records.map((row) => {
        if (row.rowNumber !== rowNumber) return row
        const cells = [...row.cells]
        cells[Number(mapping[key])] = value
        return { ...row, cells }
      }),
    }))
    setError('')
  }

  async function save() {
    if (saveLock.current || !connected || !ready.length || (invalid && !skipErrors)) return
    saveLock.current = true
    setBusy(true)
    setError('')
    try {
      // Lock the reviewed payload after the first attempt. A retry uses the
      // same id and payload even if the server saved before its reply was lost.
      const plan = transaction ?? importPlan(ready, crypto.randomUUID())
      setTransaction(plan)
      await onImport(plan)
      setSaved(plan.cuts.length)
      setStep(3)
    } catch {
      setError('Something went wrong. Try again')
    } finally {
      saveLock.current = false
      setBusy(false)
    }
  }

  const locked = busy || transaction !== null
  return (
    <section className="csv-import" aria-label="Import inventory">
      <div className="csv-toolbar">
        <p>Import inventory from your cut sheet.</p>
        <a
          className="csv-button"
          download="catcow-inventory-template.csv"
          href={'data:text/csv;charset=utf-8,' + encodeURIComponent(TEMPLATE)}
        >
          Download template
        </a>
      </div>
      <ol className="csv-steps" aria-label="Import progress">
        {['Upload', 'Map columns', 'Review rows', 'Done'].map((label, index) => (
          <li key={label} aria-current={step === index ? 'step' : undefined}>
            {label}
          </li>
        ))}
      </ol>
      {storageError && (
        <p role="status">
          Your browser could not save this draft. Keep this page open to avoid losing changes.
        </p>
      )}
      {error && (
        <p className="csv-error" role="alert">
          {error}
        </p>
      )}
      {step < 2 && (
        <label
          className="csv-upload"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            if (event.dataTransfer.files.length !== 1) {
              setError('Choose one CSV file at a time.')
              return
            }
            upload(event.dataTransfer.files[0])
          }}
        >
          <strong>
            {busy
              ? 'Reading file…'
              : file
                ? 'Replace CSV or drop another here'
                : 'Choose a CSV or drop it here'}
          </strong>
          <span>
            First row must contain headers. Up to {MAX_ROWS.toLocaleString()} rows and 5 MB.
          </span>
          <input
            className="csv-file-input"
            aria-label="CSV file"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(event) => {
              upload(event.target.files[0])
              event.target.value = ''
            }}
          />
        </label>
      )}
      {file && step < 3 && (
        <p>
          {file.name} · {file.records.length} rows
        </p>
      )}
      {step === 1 && (
        <>
          <h2>Map columns</h2>
          <p>Match each required field to a different column.</p>
          <div className="csv-mapping">
            {FIELDS.map(({ key, label }) => (
              <label key={key}>
                {label}
                <select
                  value={mapping[key]}
                  disabled={busy}
                  onChange={(event) => setMapping({ ...mapping, [key]: event.target.value })}
                >
                  <option value="">Choose column</option>
                  {file.headers.map((header, index) => (
                    <option key={index} value={String(index)}>
                      {header} (column {index + 1})
                    </option>
                  ))}
                </select>
                {mapping[key] !== '' && (
                  <small>Example: {file.records[0].cells[Number(mapping[key])] || '(empty)'}</small>
                )}
              </label>
            ))}
          </div>
          <div className="csv-actions">
            <button
              disabled={busy || !mappingComplete(mapping)}
              onClick={() => {
                setError('')
                setStep(2)
              }}
            >
              Review rows →
            </button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <div className="csv-summary" aria-live="polite">
            <span>{ready.length} ready</span>
            <span>{invalid} need fixing</span>
          </div>
          <p>Edit cells below to fix errors. Qty is the total packages on hand.</p>
          <div className="csv-table-wrap" tabIndex={0} aria-label="Editable import rows">
            <table>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  {FIELDS.map(({ key, label }) => (
                    <th scope="col" key={key}>
                      {label}
                    </th>
                  ))}
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <th scope="row">{row.rowNumber}</th>
                    {FIELDS.map(({ key, label }) => (
                      <td key={key}>
                        <input
                          aria-label={'Row ' + row.rowNumber + ' ' + label}
                          aria-invalid={Boolean(row.errors[key])}
                          aria-describedby={
                            row.errors[key] ? 'error-' + row.rowNumber + '-' + key : undefined
                          }
                          list={key === 'part' ? 'csv-categories' : undefined}
                          value={row.values[key]}
                          disabled={locked}
                          onChange={(event) => edit(row.rowNumber, key, event.target.value)}
                        />
                        {row.errors[key] && (
                          <small
                            className="csv-field-error"
                            id={'error-' + row.rowNumber + '-' + key}
                          >
                            {row.errors[key]}
                          </small>
                        )}
                      </td>
                    ))}
                    <td>{Object.keys(row.errors).length ? 'Needs fixing' : row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="csv-categories">
            {categories.map((part) => (
              <option key={part} value={part} />
            ))}
          </datalist>
          <label className="csv-skip">
            <input
              type="checkbox"
              checked={skipErrors}
              disabled={locked}
              onChange={(event) => setSkipErrors(event.target.checked)}
            />
            Skip rows that still have errors
          </label>
          {!connected && (
            <p className="csv-notice" role="status">
              File review is available. Saving will be available when your producer inventory is
              connected.
            </p>
          )}
          {transaction && step === 2 && (
            <p role="status">
              This import is awaiting confirmation. Retry the same import to check its result.
            </p>
          )}
          <div className="csv-actions">
            <button
              disabled={locked}
              onClick={() => {
                setError('')
                setStep(1)
              }}
            >
              ← Column mapping
            </button>
            <button
              disabled={busy || !connected || !ready.length || Boolean(invalid && !skipErrors)}
              onClick={save}
            >
              {busy
                ? 'Importing…'
                : invalid && !skipErrors
                  ? 'Fix ' + invalid + ' rows to import'
                  : error && transaction
                    ? 'Try again'
                    : 'Import ' + ready.length + ' cuts'}
            </button>
          </div>
        </>
      )}
      {step === 3 && (
        <div className="csv-done" role="status">
          <h2>Import complete</h2>
          <p>{saved} cuts imported. New cuts are saved as drafts.</p>
          <Link to="/producer/inventory">View inventory →</Link>
          <button
            onClick={() => {
              setStep(0)
              setFile(null)
              setMapping({})
              setError('')
              setTransaction(null)
            }}
          >
            Import another file
          </button>
        </div>
      )}
    </section>
  )
}
