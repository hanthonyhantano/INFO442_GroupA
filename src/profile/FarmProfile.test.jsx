// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import FarmProfile from '../pages/producer/FarmProfile'
import { loadProfile, saveProfile } from './profileApi'
import { fromRow, readPhoto, toRow, validate } from './profile'

vi.mock('./profileApi', () => ({ loadProfile: vi.fn(), saveProfile: vi.fn() }))

const profile = fromRow({
  id: 8,
  name: 'River Ranch',
  town: 'Yakima',
  state: 'WA',
  pickup_enabled: true,
  pickup_locations: [
    { id: 4, name: 'Front gate', address: '1 Gate St', days: ['Saturday'], times: '9–12' },
  ],
})
beforeEach(() => {
  vi.resetAllMocks()
  loadProfile.mockResolvedValue({ profile, demo: false })
})
afterEach(cleanup)

async function open() {
  render(<FarmProfile />)
  return screen.findByRole('textbox', { name: 'Farm name' })
}

it('keeps the draft after a failed save and retries with the latest values', async () => {
  saveProfile
    .mockRejectedValueOnce(new Error('Could not save.'))
    .mockImplementation(async (draft) => ({ ...draft, version: 1 }))
  const name = await open()
  fireEvent.change(name, { target: { value: 'First draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Could not save.')
  expect(name.value).toBe('First draft')
  fireEvent.change(name, { target: { value: 'River Farm' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText('Farm profile saved.')
  expect(saveProfile.mock.lastCall[0].name).toBe('River Farm')
  expect(screen.getByRole('button', { name: 'Save' }).disabled).toBe(true)
  expect(screen.getByRole('link', { name: /Preview/ }).getAttribute('href')).toBe('/farms/8')
})

it('prevents invalid saves and lets the producer keep or discard edits', async () => {
  const name = await open()
  fireEvent.change(name, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText('Enter a farm name.')
  expect(saveProfile).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
  expect(name.value).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  fireEvent.click(screen.getByRole('button', { name: 'Discard', exact: true }))
  expect(name.value).toBe('River Ranch')
})

it('recovers from load failure and opens the sample farm preview', async () => {
  loadProfile.mockRejectedValueOnce(new Error()).mockResolvedValueOnce({ profile, demo: true })
  render(<FarmProfile />)
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
  await waitFor(() =>
    expect(screen.getByRole('link', { name: /Preview/ }).getAttribute('href')).toBe(
      '/farms/8?profilePreview=demo',
    ),
  )
})

it('preserves location IDs, photo order, delivery fields and ZIPs on round trip', () => {
  const draft = {
    ...profile,
    delivery_enabled: true,
    photos: ['first', 'second'],
    delivery_minimum: '40',
    delivery_lead_time_days: '1',
    zones: [{ id: 7, name: 'Local', fee: '2.50', delivery_days: ['Mon'], zips: '00501, 00501 98901' }],
  }
  expect(validate(draft)).toEqual({})
  const row = toRow(draft)
  expect(row.delivery_zones[0]).toEqual({
    id: 7,
    name: 'Local',
    fee: 2.5,
    delivery_days: ['Mon'],
    zip_codes: ['00501', '98901'],
  })
  expect(fromRow(row).pickups[0]).toMatchObject({ id: 4, days: ['Sat'] })
  expect(fromRow(row).photos).toEqual(['first', 'second'])
})

it('rejects invalid contact, ZIP, fees, fulfillment methods and image uploads', async () => {
  expect(
    Object.keys(
      validate({
        ...profile,
        contact_phone: '123',
        contact_email: 'bad',
        pickup_enabled: false,
        delivery_lead_time_days: -1,
        zones: [{ name: 'Local', fee: -10, delivery_days: ['Tue'], zips: '123' }],
      }),
    ),
  ).toEqual(
    expect.arrayContaining([
      'contact_phone',
      'contact_email',
      'methods',
      'delivery_lead_time_days',
      'zones0',
    ]),
  )
  await expect(readPhoto({ type: 'image/gif' })).rejects.toThrow(/JPG or PNG/)
  await expect(readPhoto({ type: 'image/png', size: 6 * 1024 * 1024 })).rejects.toThrow(/5 MB/)
  await expect(readPhoto(new Blob(['not an image'], { type: 'image/jpeg' }))).rejects.toThrow(
    /valid JPG or PNG/,
  )
})
