import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProducer } from '../../components/RequireProducer'

// /producer/profile: the signed-in producer's own details and their farm.
// useProducer() comes from RequireProducer: { id, name, role, farm_id }.
const FARM_COLUMNS =
  'id, name, slug, town, state, story, contact_email, contact_phone, logo, cover_photo'

const PHOTO_BUCKET = 'farm-photos'
const MAX_PHOTO_MB = 5

// Uploads one image to Storage under the farm's folder, saves its public
// URL in the given farms column, and returns the updated farm row.
async function uploadFarmPhoto(farmId, column, file) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
    throw new Error(`Please choose an image under ${MAX_PHOTO_MB} MB.`)
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  // New file name every time, so browsers never show an old cached photo
  const path = `${farmId}/${column}-${Date.now()}.${ext}`

  const { error: uploadFailure } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type })
  if (uploadFailure) throw uploadFailure

  const { data: urlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)

  const { data, error: saveFailure } = await supabase
    .from('farms')
    .update({ [column]: urlData.publicUrl })
    .eq('id', farmId)
    .select(FARM_COLUMNS)
    .single()
  if (saveFailure) throw saveFailure
  return data
}

function PhotoField({ label, hint, farm, column, shape, onSaved }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const url = farm[column]

  async function choose(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // lets them pick the same file again later
    if (!file) return
    setBusy(true)
    setError('')
    try {
      onSaved(await uploadFarmPhoto(farm.id, column, file))
    } catch (err) {
      console.error('Photo upload failed:', err)
      setError(err?.message ?? 'Could not upload that photo.')
    } finally {
      setBusy(false)
    }
  }

  const box =
    shape === 'circle'
      ? { width: 96, height: 96, borderRadius: '50%' }
      : { width: '100%', maxWidth: 480, aspectRatio: '16 / 7', borderRadius: 8 }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3>{label}</h3>
      {url ? (
        <img src={url} alt={`${label} for ${farm.name}`} style={{ ...box, objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ ...box, background: '#f0f0ec' }} aria-hidden="true" />
      )}
      <p>
        <label>
          {busy ? 'Uploading…' : url ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}{' '}
          <input type="file" accept="image/*" onChange={choose} disabled={busy} />
        </label>
      </p>
      <small>{hint}</small>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export default function FarmProfile() {
  const navigate = useNavigate()
  const profile = useProducer()

  const [farm, setFarm] = useState(undefined) // undefined = loading, null = failed
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [displayName, setDisplayName] = useState(profile.name ?? '')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('farms')
      .select(FARM_COLUMNS)
      .eq('id', profile.farm_id)
      .maybeSingle()
      .then(({ data, error: failure }) => {
        if (cancelled) return
        if (failure) console.error('Loading farm failed:', failure)
        setFarm(data ?? null)
      })
    return () => { cancelled = true }
  }, [profile.farm_id])

  // Clear "Saved" after a few seconds
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(t)
  }, [message])

  async function save(event) {
    event.preventDefault()
    if (busy) return
    const fields = new FormData(event.currentTarget)
    const text = (key) => String(fields.get(key) ?? '').trim()

    const farmChanges = {
      name: text('farm_name'),
      town: text('town') || null,
      state: text('state').toUpperCase() || null,
      story: text('story') || null,
      contact_email: text('contact_email') || null,
      contact_phone: text('contact_phone') || null,
    }
    const newName = text('your_name') || null

    setBusy(true)
    setError('')
    try {
      const { data, error: farmFailure } = await supabase
        .from('farms')
        .update(farmChanges)
        .eq('id', farm.id)
        .select(FARM_COLUMNS)
        .single()
      if (farmFailure) throw farmFailure

      const { error: profileFailure } = await supabase
        .from('profiles')
        .update({ name: newName })
        .eq('id', profile.id)
      if (profileFailure) throw profileFailure

      setFarm(data)
      setDisplayName(newName ?? '')
      setEditing(false)
      setMessage('Saved ✓')
    } catch (err) {
      console.error('Saving profile failed:', err)
      setError(`Could not save: ${err?.message ?? 'unknown error'}`)
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/producers', { replace: true })
  }

  if (farm === undefined) return <p className="dc">Loading…</p>

  if (farm === null) {
    return (
      <section className="dc">
        <h1>We couldn't load your farm</h1>
        <p>Refresh the page to try again.</p>
      </section>
    )
  }

  const place = [farm.town, farm.state].filter(Boolean).join(', ')

  return (
    <section className="dc">
      <h1>{farm.name}</h1>
      <p>
        {displayName ? `${displayName} · ` : ''}
        {profile.role ?? 'Owner'}
        {place && ` · ${place}`}
      </p>
      <p>
        <Link to={`/farms/${farm.id}`}>View your public farm page →</Link>
      </p>

      {message && <p role="status">{message}</p>}

      <h2>Photos</h2>
      <PhotoField
        label="Logo"
        hint="A square photo or logo works best. Shows next to your farm name."
        farm={farm}
        column="logo"
        shape="circle"
        onSaved={(updated) => { setFarm(updated); setMessage('Photo saved ✓') }}
      />
      <PhotoField
        label="Cover photo"
        hint="A wide photo of your land or herd. Shows at the top of your farm page."
        farm={farm}
        column="cover_photo"
        shape="wide"
        onSaved={(updated) => { setFarm(updated); setMessage('Photo saved ✓') }}
      />

      {!editing ? (
        <>
          <h2>About the farm</h2>
          <p>{farm.story || 'No story yet. Tell shoppers how you raise your cattle.'}</p>

          <h2>Contact</h2>
          <p>
            {farm.contact_email || 'No email yet'}
            <br />
            {farm.contact_phone || 'No phone yet'}
          </p>

          <p>
            <button type="button" onClick={() => setEditing(true)}>
              Edit profile
            </button>{' '}
            <button type="button" onClick={signOut}>
              Sign out
            </button>
          </p>
        </>
      ) : (
        <form onSubmit={save}>
          <h2>You</h2>
          <p>
            <label>
              Your name <input name="your_name" defaultValue={displayName} autoComplete="name" />
            </label>
          </p>

          <h2>Your farm</h2>
          <p>
            <label>
              Farm name <input name="farm_name" defaultValue={farm.name} required />
            </label>
          </p>
          <p>
            <label>
              Town <input name="town" defaultValue={farm.town ?? ''} />
            </label>
          </p>
          <p>
            <label>
              State <input name="state" defaultValue={farm.state ?? ''} maxLength={2} placeholder="WA" />
            </label>
          </p>
          <p>
            <label>
              Story
              <textarea
                name="story"
                rows={5}
                defaultValue={farm.story ?? ''}
                placeholder="How long you've ranched, how your cattle are raised, what makes your beef different."
              />
            </label>
          </p>
          <p>
            <label>
              Contact email{' '}
              <input name="contact_email" type="email" defaultValue={farm.contact_email ?? ''} />
            </label>
          </p>
          <p>
            <label>
              Contact phone{' '}
              <input name="contact_phone" type="tel" defaultValue={farm.contact_phone ?? ''} />
            </label>
          </p>

          {error && <p role="alert">{error}</p>}
          <p>
            <button disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>{' '}
            <button type="button" onClick={() => { setEditing(false); setError('') }} disabled={busy}>
              Cancel
            </button>
          </p>
        </form>
      )}
    </section>
  )
}