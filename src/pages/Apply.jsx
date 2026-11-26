import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useNavigation } from '../navigation/useNavigation'
import { supabase } from '../lib/supabase'

const MIN_PASSWORD = 8

// "Lorem Ranch" -> "lorem-ranch-3f9a1c" (same format as the sign-up trigger;
// the random suffix keeps slugs unique)
function makeSlug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'farm'
  return `${base}-${Math.random().toString(16).slice(2, 8)}`
}

// /apply: producers create their account (and ranch) here.
// If someone is already signed in but has no ranch yet (for example they
// signed in with Google), it shows a short "add your ranch" form instead.
export default function Apply() {
  const { session } = useNavigation()
  const signedIn = session?.user?.id && !session.user.is_anonymous
  return signedIn ? <AddRanch user={session.user} /> : <CreateAccount />
}

function CreateAccount() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checkEmail, setCheckEmail] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const fields = new FormData(event.currentTarget)
    const name = String(fields.get('name')).trim()
    const farmName = String(fields.get('farm_name')).trim()
    const email = String(fields.get('email')).trim().toLowerCase()
    const password = String(fields.get('password'))

    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`)
      return
    }
    if (password !== fields.get('confirm')) {
      setError("Those passwords don't match.")
      return
    }

    setBusy(true)
    setError('')
    try {
      const { data, error: failure } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Read by the database trigger to create the profile and farm
          data: { name, farm_name: farmName },
          // Where the confirmation email link sends them
          emailRedirectTo: `${window.location.origin}/producer/profile`,
        },
      })
      if (failure) throw failure

      if (data.session) {
        navigate('/producer/profile', { replace: true }) // confirmation off
      } else {
        setCheckEmail(email) // confirmation on: they must click the link
      }
    } catch (err) {
      console.error('Sign up failed:', err)
      setError(
        err?.message?.toLowerCase().includes('registered')
          ? 'An account with that email already exists. Try signing in.'
          : 'Could not create your account. Please try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  if (checkEmail) {
    return (
      <section className="dc">
        <h1>Check your email</h1>
        <p>
          We sent a confirmation link to <strong>{checkEmail}</strong>. Click it to finish
          setting up your producer account.
        </p>
        <p>
          <Link to="/sign-in">Back to sign in</Link>
        </p>
      </section>
    )
  }

  return (
    <section className="dc">
      <small>For producers</small>
      <h1>Apply to sell on Cat Cow</h1>
      <p>Create your producer account to start listing cuts.</p>
      <form onSubmit={submit}>
        <p>
          <label>
            Your name <input name="name" autoComplete="name" required />
          </label>
        </p>
        <p>
          <label>
            Ranch name <input name="farm_name" autoComplete="organization" required />
          </label>
        </p>
        <p>
          <label>
            Email <input name="email" type="email" autoComplete="username" required />
          </label>
        </p>
        <p>
          <label>
            Password{' '}
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              required
            />
          </label>
        </p>
        <p>
          <label>
            Confirm password{' '}
            <input name="confirm" type="password" autoComplete="new-password" required />
          </label>
        </p>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p>
        Already have an account? <Link to="/sign-in">Sign in</Link>
      </p>
    </section>
  )
}

// Signed in, no ranch yet. Also what stops a redirect loop:
// RequireProducer sends farm-less users here, and this page never
// redirects them back.
function AddRanch({ user }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const fields = new FormData(event.currentTarget)
    const farmName = String(fields.get('farm_name')).trim()
    const name = String(fields.get('name')).trim()

    setBusy(true)
    setError('')
    try {
      // Already has a ranch? Go straight to the dashboard.
      const { data: existing, error: readFailure } = await supabase
        .from('profiles')
        .select('farm_id')
        .eq('id', user.id)
        .maybeSingle()
      if (readFailure) throw readFailure
      if (existing?.farm_id) {
        navigate('/producer/profile', { replace: true })
        return
      }

      const { data: farm, error: farmFailure } = await supabase
        .from('farms')
        .insert({ name: farmName, slug: makeSlug(farmName), contact_email: user.email })
        .select('id')
        .single()
      if (farmFailure) throw farmFailure

      const { error: profileFailure } = await supabase
        .from('profiles')
        .upsert({ id: user.id, name: name || null, farm_id: farm.id })
      if (profileFailure) throw profileFailure

      navigate('/producer/profile', { replace: true })
    } catch (err) {
      console.error('Adding ranch failed:', err)
      setError('Could not save your ranch. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dc">
      <small>For producers</small>
      <h1>Add your ranch</h1>
      <p>
        You're signed in as <strong>{user.email}</strong>. Tell us your ranch name to finish
        setting up.
      </p>
      <form onSubmit={submit}>
        <p>
          <label>
            Your name{' '}
            <input
              name="name"
              autoComplete="name"
              defaultValue={user.user_metadata?.name ?? user.user_metadata?.full_name ?? ''}
            />
          </label>
        </p>
        <p>
          <label>
            Ranch name{' '}
            <input
              name="farm_name"
              autoComplete="organization"
              defaultValue={user.user_metadata?.farm_name ?? ''}
              required
            />
          </label>
        </p>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy}>{busy ? 'Saving…' : 'Continue'}</button>
      </form>
      <p>
        Already set up? <Link to="/producer/profile">Go to your dashboard</Link>
      </p>
    </section>
  )
}