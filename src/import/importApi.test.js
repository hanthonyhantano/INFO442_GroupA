import { beforeEach, it, expect, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { submitImport } from './importApi'
vi.mock('../lib/supabase', () => ({supabase:{rpc:vi.fn()}}))
const plan={requestId:'request',cuts:[{}],batchId:2}
beforeEach(() => vi.resetAllMocks())
it('requires the server to confirm every row for the assigned farm', async () => {
  supabase.rpc.mockResolvedValueOnce({data:1}).mockResolvedValueOnce({data:0})
  await submitImport(3,plan)
  expect(supabase.rpc).toHaveBeenCalledWith('import_farm_inventory',{farm_key:3,plan})
  await expect(submitImport(3,plan)).rejects.toThrow(/confirmation/)
})
it('allows editing a rejected import while preserving uncertain requests for replay', async () => {
  supabase.rpc.mockResolvedValueOnce({error:{code:'P0001',message:'Inventory changed.'}})
    .mockResolvedValueOnce({error:{code:'08007',message:'Disconnected'}})
  await expect(submitImport(3,plan)).rejects.toMatchObject({rejected:true})
  await expect(submitImport(3,plan)).rejects.toMatchObject({rejected:false})
})
