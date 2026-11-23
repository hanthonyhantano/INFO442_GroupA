import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadProfile, saveProfile } from '../../profile/profileApi'
import { readPhoto, validate, splitList } from '../../profile/profile'
import Fulfillment from '../../profile/Fulfillment'
import cover from '../../profile/assets/cover.png'
import gallery from '../../profile/assets/gallery.png'
import '../../profile/profile.css'

export default function FarmProfile() {
  const [saved, setSaved] = useState(null)
  const [draft, setDraft] = useState(null)
  const [demo, setDemo] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, retry] = useState(0)
  const [practice, setPractice] = useState(null)
  const [confirm, setConfirm] = useState(false)
  const [tried, setTried] = useState(false)
  const lock = useRef(false)
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)
  useEffect(() => {
    let current = true
    loadProfile()
      .then((result) => {
        if (current) {
          setSaved(result.profile)
          setDraft(result.profile)
          setDemo(result.demo)
          setError('')
        }
      })
      .catch(() => {
        if (current) setError('Could not load the farm profile.')
      })
    return () => {
      current = false
    }
  }, [attempt])
  useEffect(() => {
    if (!dirty) return
    const unload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const leave = (e) => {
      const a = e.target.closest?.('a[href]')
      if (
        a &&
        a.target !== '_blank' &&
        !e.metaKey &&
        !e.ctrlKey &&
        a.pathname !== window.location.pathname &&
        !window.confirm('Discard your changes?')
      ) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', unload)
    document.addEventListener('click', leave, true)
    return () => {
      window.removeEventListener('beforeunload', unload)
      document.removeEventListener('click', leave, true)
    }
  }, [dirty])
  if (!draft)
    return error ? (
      <p role="alert">
        {error}{' '}
        <button
          onClick={() => {
            setError('')
            retry(attempt + 1)
          }}
        >
          Retry
        </button>
      </p>
    ) : (
      <p role="status">Loading farm profile…</p>
    )
  const errors = validate(draft)
  function set(key, value) {
    setDraft((p) => ({ ...p, [key]: value }))
    setError('')
    setStatus('')
  }
  async function save(e) {
    e.preventDefault()
    if (lock.current) return
    setTried(true)
    setStatus('')
    setError('')
    if (Object.keys(errors).length) {
      setError('Review the highlighted fields before saving.')
      return
    }
    lock.current = true
    setBusy(true)
    try {
      const next = await saveProfile(draft, demo)
      setSaved(next)
      setDraft(next)
      setTried(false)
      setConfirm(false)
      setStatus('Farm profile saved.')
    } catch (err) {
      setError(err.message || 'Save failed. Your changes are still here.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  async function upload(e, isCover) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file || lock.current) return
    lock.current = true
    setBusy(true)
    try {
      const image = await readPhoto(file)
      if (isCover) set('cover_photo', image)
      else if (draft.photos.length < 4) set('photos', [...draft.photos, image])
    } catch (err) {
      setError(err.message || 'Could not read this photo.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  function input(key, label, type = 'text') {
    const invalid = errors[key] && (tried || !dirty)
    return (
      <label>
        {label}
        <input
          type={type}
          value={draft[key]}
          onChange={(e) => set(key, e.target.value)}
          aria-invalid={!!invalid}
          aria-describedby={invalid ? 'fp-' + key : undefined}
        />
        {invalid && (
          <small className="fp-error" id={'fp-' + key}>
            {errors[key]}
          </small>
        )}
      </label>
    )
  }
  const actions = (
    <div className="fp-actions">
      <a
        href={'/farms/' + saved.id + (demo ? '?profilePreview=demo' : '')}
        target="_blank"
        rel="noreferrer"
      >
        Preview ↗
      </a>
      <button type="submit" form="farm-profile" disabled={busy || !dirty} className="fp-save">
        {busy ? 'Working…' : 'Save'}
      </button>
    </div>
  )
  const host = document.getElementById('farm-profile-actions')
  const zips = draft.zones.flatMap((z) => [...new Set(splitList(z.zips))])
  return (
    <form className="fp" id="farm-profile" onSubmit={save} noValidate>
      {host ? createPortal(actions, host) : actions}
      <fieldset className="fp-grid" disabled={busy}>
        <div>
          <section className="fp-box">
            <h2>Story</h2>
            <label className="fp-upload fp-cover">
              <img src={draft.cover_photo || cover} alt="Farm cover" />
              <span>Change cover photo</span>
              <input
                aria-label="Upload cover photo"
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => upload(e, true)}
              />
            </label>
            <div className="fp-pair">
              {input('name', 'Farm name')}
              {input('location', 'Location')}
            </div>
            <label>
              About the farm
              <textarea rows="5" value={draft.story} onChange={(e) => set('story', e.target.value)} />
            </label>
            <div className="fp-label">Grazing practices</div>
            <div className="fp-tags">
              {draft.practices.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  aria-label={'Remove ' + tag}
                  onClick={() =>
                    set(
                      'practices',
                      draft.practices.filter((t) => t !== tag),
                    )
                  }
                >
                  {tag} ×
                </button>
              ))}
              <button type="button" onClick={() => setPractice('')}>
                + Add
              </button>
            </div>
            {practice !== null && (
              <div className="fp-practice">
                <label>
                  Practice
                  <input
                    list="fp-practices"
                    value={practice}
                    onChange={(e) => setPractice(e.target.value)}
                  />
                </label>
                <datalist id="fp-practices">
                  {['Rotational grazing', 'Grass-finished', 'Grass-fed', 'Pasture raised'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </datalist>
                <button
                  type="button"
                  disabled={!practice.trim()}
                  onClick={() => {
                    set('practices', [...new Set([...draft.practices, practice.trim()])])
                    setPractice(null)
                  }}
                >
                  Add practice
                </button>
              </div>
            )}
          </section>
          <section className="fp-box">
            <h2>Photos</h2>
            <div className="fp-photos">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i}>
                  <img
                    src={draft.photos[i] || gallery}
                    alt={draft.photos[i] ? 'Farm photo ' + (i + 1) : ''}
                  />
                  {draft.photos[i] && (
                    <button
                      type="button"
                      aria-label={'Remove photo ' + (i + 1)}
                      onClick={() =>
                        set(
                          'photos',
                          draft.photos.filter((_, j) => j !== i),
                        )
                      }
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {draft.photos.length < 4 && (
                <label className="fp-upload">
                  + Upload
                  <input
                    aria-label="Upload farm photo"
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => upload(e, false)}
                  />
                </label>
              )}
            </div>
          </section>
        </div>
        <div>
          <Fulfillment profile={draft} field="zones" set={set} errors={tried ? errors : {}} />
          <Fulfillment profile={draft} field="pickups" set={set} errors={tried ? errors : {}} />
          {errors.methods && <p className="fp-error">{errors.methods}</p>}
          {new Set(zips).size < zips.length && (
            <p role="status">A ZIP appears in more than one delivery zone.</p>
          )}
          <section className="fp-box">
            <h2>Contact</h2>
            <div className="fp-pair">
              {input('contact_email', 'Email', 'email')}
              {input('contact_phone', 'Phone', 'tel')}
            </div>
          </section>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="fp-error">
          {error}
        </p>
      )}
      <div className="fp-footer">
        <span role="status">
          {status ||
            (dirty ? 'Unsaved changes' : demo ? 'Demo farm · changes save in this browser' : '')}
        </span>
        {dirty && !confirm && (
          <button type="button" disabled={busy} onClick={() => setConfirm(true)}>
            Discard changes
          </button>
        )}
        {confirm && (
          <span>
            Discard your changes?{' '}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(saved)
                setConfirm(false)
                setError('')
                setTried(false)
                setPractice(null)
                setStatus('Changes discarded.')
              }}
            >
              Discard
            </button>{' '}
            <button type="button" onClick={() => setConfirm(false)}>
              Keep editing
            </button>
          </span>
        )}
      </div>
    </form>
  )
}
