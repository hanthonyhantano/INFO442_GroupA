import { expect, it, vi, beforeEach } from 'vitest'
import { supabase } from '../lib/supabase'
import { loadProfile, saveProfile } from './profileApi'
import { fromRow } from './profile'
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() }, from: vi.fn(), rpc: vi.fn() },
}))
beforeEach(() => vi.resetAllMocks())

const row = {
  id: 4,
  profile_version: 3,
  name: 'River Ranch',
  town: 'Yakima',
  state: 'WA',
  pickup_enabled: true,
}
it('loads only the assigned farm with its related records', async () => {
  supabase.auth.getSession.mockResolvedValue({
    data: { session: { user: { app_metadata: { farm_id: 4 }, user_metadata: { farm_id: 99 } } } },
  })
  const single = vi.fn().mockResolvedValue({ data: row })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  supabase.from.mockReturnValue({ select })
  expect(await loadProfile()).toMatchObject({ demo: false, profile: { id: 4, version: 3 } })
  expect(supabase.from).toHaveBeenCalledWith('farms')
  expect(eq).toHaveBeenCalledWith('id', 4)
})
it('keeps a database failure distinct from the sample farm', async () => {
  supabase.auth.getSession.mockResolvedValue({ error: new Error('Session unavailable') })
  await expect(loadProfile()).rejects.toThrow('Session unavailable')
})
it('submits the edited profile and loaded revision together and reports a conflict', async () => {
  const draft = { ...fromRow(row), name: 'Updated Farm' }
  supabase.rpc
    .mockResolvedValueOnce({ data: { ...row, name: draft.name, profile_version: 4 } })
    .mockResolvedValueOnce({ error: { code: '40001' } })
  expect(await saveProfile(draft, false)).toMatchObject({ name: 'Updated Farm', version: 4 })
  expect(supabase.rpc).toHaveBeenCalledWith(
    'save_farm_profile',
    expect.objectContaining({
      profile: expect.objectContaining({ name: 'Updated Farm', id: 4 }),
      expected_version: 3,
    }),
  )
  await expect(saveProfile(draft, false)).rejects.toThrow(/Reload/)
})

it('identifies an unmapped signed-in account instead of saving its edits to the demo', async () => {
  supabase.auth.getSession.mockResolvedValue({data:{session:{user:{app_metadata:{}, is_anonymous:false}}}})
  await expect(loadProfile()).rejects.toMatchObject({code:'NO_FARM'})
  expect(supabase.from).not.toHaveBeenCalled()
})
