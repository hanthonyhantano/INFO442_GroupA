import { useState } from 'react'
import { days } from './profile'
import pickupImage from './assets/pickup.png'

export default function Fulfillment({ profile, field, set, errors }) {
  const delivery = field === 'zones'
  const kind = delivery ? 'zone' : 'pickup location'
  const title = delivery ? 'Delivery' : 'Pickup'
  const dayField = delivery ? 'delivery_days' : 'days'
  const enabled = delivery ? 'delivery_enabled' : 'pickup_enabled'
  const rows = profile[field]
  const [editing, setEditing] = useState(null)
  function change(i, patch) {
    set(
      field,
      rows.map((row, index) => (index === i ? { ...row, ...patch } : row)),
    )
  }
  function add() {
    const key = crypto.randomUUID()
    set(field, [
      ...rows,
      delivery
        ? { key, name: '', delivery_days: [], zips: '', fee: 0 }
        : { key, name: '', days: [], address: '', times: '' },
    ])
    setEditing(key)
  }
  return (
    <section className="fp-box">
      <div className="fp-between">
        <h2>{title}</h2>
        <button
          type="button"
          role="switch"
          aria-checked={profile[enabled]}
          aria-label={title}
          className="fp-switch"
          onClick={() => set(enabled, !profile[enabled])}
        >
          <span />
        </button>
      </div>
      {!profile[enabled] &&
        Object.keys(errors).some(
          (key) => key.startsWith(field) || (delivery && key.startsWith('delivery_')),
        ) && <p role="alert">Turn on {title.toLowerCase()} to correct its incomplete settings.</p>}
      {profile[enabled] && (
        <>
          {rows.map((row, i) => {
            const key = row.key ?? row.id ?? i
            const edit = editing === key
            return (
              <div className="fp-row" key={key}>
                <div className="fp-between">
                  {!delivery && <img className="fp-pickup" alt="" src={pickupImage} />}
                  <div className="fp-summary">
                    <strong>{row.name || 'New ' + kind}</strong>
                    <small>
                      {row[dayField].join(', ')} ·{' '}
                      {delivery ? row.zips : [row.times, row.address].filter(Boolean).join(' · ')}
                    </small>
                  </div>
                  {delivery && <small>{Number(row.fee) === 0 ? 'FREE' : '$' + row.fee}</small>}
                  <button
                    type="button"
                    aria-label={'Edit ' + (row.name || kind)}
                    aria-expanded={edit}
                    onClick={() => setEditing(edit ? null : key)}
                  >
                    •••
                  </button>
                </div>
                {edit && (
                  <fieldset className="fp-editor">
                    <legend>{delivery ? 'Delivery zone' : 'Pickup location'}</legend>
                    <label>
                      Name
                      <input value={row.name} onChange={(e) => change(i, { name: e.target.value })} />
                    </label>
                    <fieldset className="fp-days">
                      <legend>{title} days</legend>
                      {days.map((day) => (
                        <label key={day}>
                          <input
                            type="checkbox"
                            checked={row[dayField].includes(day)}
                            onChange={(e) =>
                              change(i, {
                                [dayField]: e.target.checked
                                  ? [...row[dayField], day]
                                  : row[dayField].filter((d) => d !== day),
                              })
                            }
                          />
                          {day}
                        </label>
                      ))}
                    </fieldset>
                    {(delivery
                      ? [
                          ['zips', 'ZIP codes'],
                          ['fee', 'Delivery fee ($)'],
                        ]
                      : [
                          ['address', 'Address'],
                          ['times', 'Pickup times'],
                        ]
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          type={key === 'fee' ? 'number' : 'text'}
                          step={key === 'fee' ? '0.01' : undefined}
                          value={row[key]}
                          onChange={(e) => change(i, { [key]: e.target.value })}
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        set(
                          field,
                          rows.filter((_, j) => i !== j),
                        )
                        setEditing(null)
                      }}
                    >
                      Remove {kind}
                    </button>
                    <button type="button" onClick={() => setEditing(null)}>
                      Done
                    </button>
                  </fieldset>
                )}
                {errors[field + i] && <p className="fp-error">{errors[field + i]}</p>}
              </div>
            )
          })}
          <button type="button" className="fp-add" onClick={add}>
            + Add {kind}
          </button>
          {delivery && (
            <div className="fp-pair">
              {[
                ['delivery_minimum', 'Minimum order ($)'],
                ['delivery_lead_time_days', 'Lead time (days)'],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min="0"
                    step={key === 'delivery_minimum' ? '0.01' : '1'}
                    value={profile[key]}
                    onChange={(e) => set(key, e.target.value)}
                    aria-invalid={!!errors[key]}
                  />
                  {errors[key] && <small>{errors[key]}</small>}
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
