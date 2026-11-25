import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useNavigation } from '../navigation/useNavigation'
import { supabase } from '../lib/supabase'

export default function SignIn() {
  const navigate = useNavigate()
  const { session } = useNavigation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const { error: failure } = await supabase.auth.signInWithPassword({
        email: fields.get('email').trim(),
        password: fields.get('password'),
      })
      if (failure) throw failure
      navigate('/producer/profile', { replace: true })
    } catch {
      setError('Could not sign in. Check your email and password and try again.')
    } finally {
      setBusy(false)
    }
  }
  if (session?.user?.id && !session.user.is_anonymous) return <Navigate to="/producer/profile" replace />
  return (
    <section className="dc">
      <h1>Producer sign in</h1>
      <form onSubmit={submit}>
        <p>
          <label>
            Email <input name="email" type="email" autoComplete="username" required />
          </label>
        </p>
        <p>
          <label>
            Password <input name="password" type="password" autoComplete="current-password" required />
          </label>
        </p>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </section>
  )
}
