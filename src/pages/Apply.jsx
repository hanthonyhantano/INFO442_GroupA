import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useNavigation } from '../navigation/useNavigation'
import { supabase } from '../lib/supabase'

const MIN_PASSWORD = 8

// Creates the signed-in user's farm and records its id in their trusted
// app_metadata.farm_id (see supabase/migrations/20261126_producer_signup.sql).
// The database function returns the existing farm if they already have one.
// Refreshing the session puts the new farm_id into the user's token, which is
// what LiveNavigation and the producer pages read.
async function setUpRanch(name, farmName) {
  const { error: rpcFailure } = await supabase.rpc('create_my_farm', {
    farm_name: farmName,
    producer_name: name || null,
  })
  if (rpcFailure) throw rpcFailure
  const { error: refreshFailure } = await supabase.auth.refreshSession()
  if (refreshFailure) throw refreshFailure
}

// Turns Supabase errors into something a person can act on.
function friendlyError(err) {
  const msg = String(err?.message ?? '').toLowerCase()
  if (msg.includes('registered') || msg.includes('already')) {
    return 'An account with that email already exists. Try signing in.'
  }
  if (msg.includes('invalid') && msg.includes('email')) {
    return "Supabase won't accept that email address. Use a real inbox you can check."
  }
  if (msg.includes('password')) return err.message
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many sign-up attempts. Wait a few minutes and try again.'
  }
  return `Could not create your account: ${err?.message ?? 'unknown error'}`
}

// /apply: producers create their account and ranch here.
// Signed in with no ranch yet (e.g. Google sign-in, or confirmed their
// email after signing up)? It shows a short "Add your ranch" form instead.
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
          // Saved on the account so "Add your ranch" can prefill it later
          data: { name, farm_name: farmName },
          emailRedirectTo: `${window.location.origin}/producer/profile`,
        },
      })
      if (failure) throw failure

      if (data.session) {
        // Signed in right away (Confirm email is off): create the ranch now.
        try {
          await setUpRanch(name, farmName)
        } catch (err) {
          // Account exists; they'll finish on the "Add your ranch" form.
          console.error('Ranch setup failed:', err)
        }
        navigate('/producer/profile', { replace: true })
      } else {
        // Confirm email is on. After they click the link and land on
        // /producer/profile, RequireProducer sends them to /apply, where
        // "Add your ranch" is already filled in.
        setCheckEmail(email)
      }
    } catch (err) {
      console.error('Sign up failed:', err)
      setError(friendlyError(err))
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

// Signed in, no ranch yet. This page never redirects signed-in users on
// its own, which prevents a loop with RequireProducer (which sends users
// without app_metadata.farm_id here).
function AddRanch({ user }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await setUpRanch(String(fields.get('name')).trim(), String(fields.get('farm_name')).trim())
      navigate('/producer/profile', { replace: true })
    } catch (err) {
      console.error('Adding ranch failed:', err)
      setError(`Could not save your ranch: ${err?.message ?? 'unknown error'}`)
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