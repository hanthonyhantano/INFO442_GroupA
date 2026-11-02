import { useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useNavigation } from '../navigation/useNavigation'
import { producerLinks, producerTitle, visibleCount } from '../navigation/navigation'

export default function ProducerLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { session, producer, counts, onSignOut } = useNavigation()
  const [menuPath, setMenuPath] = useState(null)
  const [accountPath, setAccountPath] = useState(null)
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  const account = useRef(null)
  const accountButton = useRef(null)
  const logoutButton = useRef(null)
  const mobileButton = useRef(null)
  const [previousPath, setPreviousPath] = useState(pathname)
  if (previousPath !== pathname) {
    setPreviousPath(pathname)
    setMenuPath(null)
    setAccountPath(null)
  }
  const menuOpen = menuPath === pathname
  const accountOpen = accountPath === pathname
  useEffect(() => {
    if (!accountOpen) return
    logoutButton.current?.focus()
    function outside(event) { if (!account.current?.contains(event.target)) setAccountPath(null) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [accountOpen])
  if (session === null) return <Navigate to="/sign-in" replace state={{ from: pathname }} />
  async function signOut() {
    if (!onSignOut) return
    setSigningOut(true); setError('')
    try { await onSignOut(); navigate('/sign-in', { replace: true }) }
    catch { setError('Could not log out. Please try again.') }
    finally { setSigningOut(false) }
  }
  function closeMenus() { setMenuPath(null); setAccountPath(null) }
  function item(index, count, low = false) {
    const [to, label] = producerLinks[index]
    const badge = visibleCount(count)
    return <NavLink to={to} key={to} onClick={closeMenus}>
      <span className="producer-icon" aria-hidden="true" /><span>{label}</span>{' '}
      {badge !== null && <span className={`producer-badge${low ? ' low' : ''}`}>{badge}{low ? ' low' : ''}</span>}
    </NavLink>
  }
  return <div className="producer-layout" onKeyDown={event => {
    if (event.key !== 'Escape') return
    if (accountOpen) { setAccountPath(null); accountButton.current?.focus() }
    else if (menuOpen) { setMenuPath(null); mobileButton.current?.focus() }
  }}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="producer-mobile-bar"><span>Producer</span><button ref={mobileButton} aria-expanded={menuOpen}
      aria-controls="producer-sidebar" onClick={() => { setMenuPath(menuOpen ? null : pathname); setAccountPath(null) }}>{menuOpen ? 'Close menu' : 'Menu'}</button></div>
    <aside id="producer-sidebar" className={menuOpen ? 'producer-sidebar is-open' : 'producer-sidebar'}>
      <nav aria-label="Producer">
        <NavLink to="/producer/profile" className="farm-card" onClick={closeMenus}>
          <span className="farm-avatar" aria-hidden="true" /><span className="identity"><strong>{producer?.farmName || 'Farm Profile'}</strong>{' '}
            {producer?.farmLocation && <small>{producer.farmLocation}</small>}</span><span aria-hidden="true">▾</span>
        </NavLink>
        <div className="today-link">{item(0, counts.tasks)}</div>
        <p className="nav-group">Sell</p>{item(1, counts.orders)}
        <p className="nav-group">Stock</p>{item(2, counts.lowStock, true)}{item(3)}{item(4)}
      </nav>
      <div className="producer-account" ref={account}>
        {accountOpen && <div className="account-panel" aria-label="Account options">
          <button ref={logoutButton} onClick={signOut} disabled={!onSignOut || signingOut}>{signingOut ? 'Logging out…' : 'Log out'}</button>
          {!onSignOut && <p>Sign-in integration is not available yet.</p>}
          {error && <p role="alert">{error}</p>}
        </div>}
        <button className="account-trigger" ref={accountButton} aria-expanded={accountOpen} onClick={() => setAccountPath(accountOpen ? null : pathname)}>
          <span className="account-avatar" aria-hidden="true" /><span className="identity"><strong>{producer?.name || 'Account'}</strong>{' '}
            {producer?.role && <small>{producer.role}</small>}</span>
        </button>
      </div>
    </aside>
    <div className="producer-content"><header className="producer-header"><h1>{producerTitle(pathname)}</h1>
      {producer?.farmName && <span>{producer.farmName}</span>}</header>
      <main className="navigation-main" id="main-content" tabIndex={-1}><Outlet /></main>
    </div>
  </div>
}
