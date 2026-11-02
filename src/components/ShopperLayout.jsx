import { useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useNavigation } from '../navigation/useNavigation'
import { shopperLinks } from '../navigation/navigation'
import ZipControl from './ZipControl'
import logo from '../assets/navigation/catcow.png'
import cart from '../assets/navigation/cart.svg'

export default function ShopperLayout() {
  const { pathname } = useLocation()
  const [menuPath, setMenuPath] = useState(null)
  const [previousPath, setPreviousPath] = useState(pathname)
  if (previousPath !== pathname) {
    setPreviousPath(pathname)
    setMenuPath(null)
  }
  const menuOpen = menuPath === pathname
  const menuButton = useRef(null)
  const { cartPackageCount } = useNavigation()
  return <div className="shopper-layout">
    <a className="skip-link" href="#main-content">Skip to content</a>
    {pathname === '/' && <div className="announcement">Washington ranches · Make the whole cow valuable</div>}
    <header className="shopper-header" onKeyDown={event => {
      if (event.key === 'Escape' && menuOpen) { setMenuPath(null); menuButton.current?.focus() }
    }}>
      <Link to="/" aria-label="Cat Cow home" className="brand"><img src={logo} alt="CATCOW" width="129" height="24" /></Link>
      <button ref={menuButton} className="mobile-toggle" aria-expanded={menuOpen} aria-controls="shopper-navigation"
        onClick={() => setMenuPath(menuOpen ? null : pathname)}>{menuOpen ? 'Close menu' : 'Menu'}</button>
      <nav id="shopper-navigation" aria-label="Shopper" className={menuOpen ? 'shopper-nav is-open' : 'shopper-nav'}>
        {shopperLinks.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => isActive || (to === '/shop' && ['/cart', '/checkout', '/request-sent'].includes(pathname)) ? 'active' : ''} onClick={() => setMenuPath(null)}>{label}</NavLink>)}
      </nav>
      <div className="shopper-tools"><ZipControl key={pathname} />
        <NavLink to="/cart" className="shopper-pill" aria-label={Number.isInteger(cartPackageCount) && cartPackageCount >= 0 ? `Cart, ${cartPackageCount} packages` : 'Cart'}>
          <img src={cart} alt="" /><span>Cart</span>
          {Number.isInteger(cartPackageCount) && cartPackageCount >= 0 && <span className="cart-count">{cartPackageCount}</span>}
        </NavLink>
      </div>
    </header>
    <main className="navigation-main" id="main-content" tabIndex={-1}><Outlet /></main>
  </div>
}
