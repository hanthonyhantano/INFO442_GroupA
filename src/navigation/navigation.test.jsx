// @vitest-environment jsdom
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import App from '../App'
import { NavigationProvider } from './NavigationProvider'
import { useNavigation } from './useNavigation'
import { readZip, saveZip, visibleCount } from './navigation'

afterEach(cleanup)
beforeEach(() => localStorage.clear())
function mount(path = '/', props = {}) {
  return render(<MemoryRouter initialEntries={[path]}><NavigationProvider {...props}><App /></NavigationProvider></MemoryRouter>)
}
function ZipConsumer() { const { zip } = useNavigation(); return <output aria-label="Selected ZIP">{zip}</output> }

describe('shopper navigation', () => {
  it('links to each existing destination and marks only the selected section', async () => {
    const user = userEvent.setup(); mount()
    for (const [label, heading] of [['Shop','Shop beef'], ['Explore Cuts','Pick a part of the cow.'], ['Farms',/^Farms/], ['Our Mission','Make the whole cow valuable.'], ['For Producers','ForProducers']]) {
      await user.click(screen.getByRole('link', { name: label, exact: true }))
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
      expect(screen.getByRole('link', { name: label, exact: true }).getAttribute('aria-current')).toBe('page')
    }
    await user.click(screen.getByRole('link', { name: 'Cart', exact: true }))
    expect(screen.getByRole('heading', { name: 'Cart' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Shop', exact: true }).className).toBe('active')
    await user.click(screen.getByRole('link', { name: 'Cat Cow home' }))
    expect(screen.getByRole('heading', { name: /Good beef/ })).toBeTruthy()
  })
  it.each([['/shop/example','Shop'], ['/farms/example','Farms']])('keeps parent active at %s', (path, label) => {
    mount(path); expect(screen.getByRole('link', { name: label, exact: true }).getAttribute('aria-current')).toBe('page')
  })
  it('validates, shares, persists, cancels and clears a ZIP, preserving leading zeros', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><NavigationProvider><App /><ZipConsumer /></NavigationProvider></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: /Set ZIP/ }))
    const input = screen.getByRole('textbox', { name: 'Delivery ZIP code' })
    await user.type(input, 'abc'); await user.click(screen.getByRole('button', { name: 'Save ZIP' }))
    expect(screen.getByRole('alert').textContent).toContain('5-digit')
    await user.clear(input); await user.type(input, '02108'); await user.click(screen.getByRole('button', { name: 'Save ZIP' }))
    expect(localStorage.getItem('catcow.deliveryZip')).toBe('02108')
    expect(screen.getByLabelText('Selected ZIP').textContent).toBe('02108')
    await user.click(screen.getByRole('button', { name: /02108/ }))
    await user.clear(screen.getByRole('textbox')); await user.type(screen.getByRole('textbox'), '98105')
    await user.keyboard('{Escape}')
    expect(localStorage.getItem('catcow.deliveryZip')).toBe('02108')
    await user.click(screen.getByRole('button', { name: /02108/ }))
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(localStorage.getItem('catcow.deliveryZip')).toBeNull()
  })
  it('shows supplied cart packages and closes the mobile menu after navigation', async () => {
    const user = userEvent.setup(); mount('/', { cartPackageCount: 3 })
    expect(screen.getByRole('link', { name: 'Cart, 3 packages' })).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Menu' })
    await user.click(button); expect(button.getAttribute('aria-expanded')).toBe('true')
    await user.click(screen.getByRole('link', { name: 'Shop', exact: true }))
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe('false')
  })
})
describe('producer navigation', () => {
  it('redirects the index, navigates all links, and opens farm profile', async () => {
    const user = userEvent.setup(); mount('/producer')
    await waitFor(() => expect(screen.getByRole('link', { name: 'Today' }).getAttribute('aria-current')).toBe('page'))
    for (const label of ['Orders','Inventory','Batches','Import','Today','Farm Profile']) {
      await user.click(screen.getByRole('link', { name: label }))
      expect(screen.getByRole('link', { name: label }).getAttribute('aria-current')).toBe('page')
    }
  })
  it('accepts real identity and badge values, omitting zero or unknown counts', () => {
    mount('/producer/today', { producer: { farmName: 'Test farm', farmLocation: 'Test location', name: 'Test owner', role: 'Owner' }, counts: { tasks: 4, orders: 0, lowStock: 2 } })
    expect(screen.getByRole('link', { name: /Test farm Test location/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Today 4' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Orders' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Inventory 2 low' })).toBeTruthy()
  })
  it('redirects a confirmed signed-out session', () => {
    mount('/producer/orders', { session: null })
    expect(screen.getByRole('heading', { name: 'SignIn' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Producer' })).toBeNull()
  })
  it('closes account options on Escape, outside click, and navigation', async () => {
    const user = userEvent.setup(); mount('/producer/today')
    const button = screen.getByRole('button', { name: 'Account' })
    await user.click(button); expect(screen.getByRole('button', { name: 'Log out' }).disabled).toBe(true)
    await user.keyboard('{Escape}'); expect(button.getAttribute('aria-expanded')).toBe('false')
    await user.click(button); await user.click(screen.getAllByRole('heading', { name: 'Today' })[0])
    expect(button.getAttribute('aria-expanded')).toBe('false')
    await user.click(button); await user.click(screen.getByRole('link', { name: 'Orders' }))
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })
  it('awaits sign-out before redirecting and preserves the page on failure', async () => {
    const user = userEvent.setup(); const signOut = vi.fn().mockRejectedValueOnce(new Error()).mockResolvedValueOnce(undefined)
    mount('/producer/today', { session: { user: {} }, onSignOut: signOut })
    await user.click(screen.getByRole('button', { name: 'Account' }))
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(screen.getByRole('alert').textContent).toContain('Could not log out')
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'SignIn' })).toBeTruthy())
    expect(signOut).toHaveBeenCalledTimes(2)
  })
  it('closes the mobile menu after a selection', async () => {
    const user = userEvent.setup(); mount('/producer/today')
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.click(screen.getByRole('link', { name: 'Orders' }))
    expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe('false')
  })
})
it('tolerates disabled storage and rejects corrupted ZIP/count values', () => {
  const storage = { getItem() { throw new Error() }, setItem() { throw new Error() }, removeItem() { throw new Error() } }
  expect(readZip(storage)).toBe(''); expect(() => saveZip(storage, '98105')).not.toThrow()
  expect(readZip({ getItem: () => 'bad' })).toBe('')
  for (const count of [0, -1, null, undefined, 1.2, '3']) expect(visibleCount(count)).toBeNull()
})

function HistoryControls() {
  const navigate = useNavigate()
  return <><button onClick={() => navigate('/mission')}>Navigate away</button><button onClick={() => navigate(-1)}>Go back</button></>
}
it.each(['/', '/producer/today'])('does not reopen a dismissed menu after browser history navigation from %s', async path => {
  const user = userEvent.setup()
  render(<MemoryRouter initialEntries={[path]}><NavigationProvider><App /><HistoryControls /></NavigationProvider></MemoryRouter>)
  await user.click(screen.getByRole('button', { name: 'Menu', exact: true }))
  await user.click(screen.getByRole('button', { name: 'Navigate away' }))
  await user.click(screen.getByRole('button', { name: 'Go back' }))
  expect(screen.getByRole('button', { name: 'Menu', exact: true }).getAttribute('aria-expanded')).toBe('false')
})
