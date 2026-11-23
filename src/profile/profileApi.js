import { supabase } from '../lib/supabase'
import { previewRanch } from '../discovery/catalog'
import { fromRow, toRow, validate } from './profile'

const seed = {
  id: previewRanch.id,
  name: previewRanch.name,
  town: previewRanch.town,
  state: 'WA',
  story: previewRanch.description,
  practices: previewRanch.tags,
  pickup_enabled: true,
  delivery_enabled: true,
  delivery_minimum: 75,
  delivery_lead_time_days: 3,
  contact_email: 'farm@example.test',
  contact_phone: '5095550100',
  delivery_zones: [
    { id: 1, name: 'Kittitas County', delivery_days: ['Tue', 'Fri'], zip_codes: ['98926'], fee: 0 },
    {
      id: 2,
      name: 'Seattle metro',
      delivery_days: ['Thu'],
      zip_codes: previewRanch.delivery_zips,
      fee: 15,
    },
  ],
  pickup_locations: [
    { id: 1, name: 'Farm stand', address: '1200 Lorem Rd', days: ['Sat'], times: '9–12' },
    { id: 2, name: 'Ellensburg Farmers Market', address: 'Booth 14', days: ['Sat'], times: '9–1' },
  ],
}
// One transactional record in IndexedDB keeps review edits across page reloads.
function demoRecord(update) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('catcow-profile-demo', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('profiles')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const db = open.result
      const tx = db.transaction('profiles', update ? 'readwrite' : 'readonly')
      const store = tx.objectStore('profiles')
      let result, failure
      const read = store.get(seed.id)
      read.onsuccess = () => {
        result = read.result ?? seed
        if (update) {
          if (update.version !== (result.profile_version ?? 0)) {
            failure = new Error('This profile changed in another tab. Reload before saving.')
            tx.abort()
          } else {
            result = { ...toRow(update), profile_version: update.version + 1 }
            for (const rows of [result.delivery_zones, result.pickup_locations]) {
              for (const row of rows) row.id ??= crypto.randomUUID()
            }
            store.put(result, seed.id)
          }
        }
      }
      tx.oncomplete = () => {
        db.close()
        resolve(result)
      }
      tx.onabort = () => {
        db.close()
        reject(failure ?? tx.error)
      }
    }
  })
}
export const readDemoFarm = () => demoRecord()
export async function loadProfile() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const id = data.session?.user.app_metadata?.farm_id
  if (!id) return { demo: true, profile: fromRow(await readDemoFarm()) }
  const response = await supabase
    .from('farms')
    .select('*, delivery_zones(*), pickup_locations(*), farm_photos(*)')
    .eq('id', id)
    .single()
  if (response.error) throw response.error
  return { demo: false, profile: fromRow(response.data) }
}
export async function saveProfile(p, demo) {
  if (Object.keys(validate(p)).length) throw new Error('Correct the highlighted fields.')
  if (demo) return fromRow(await demoRecord(p))
  const { data, error } = await supabase.rpc('save_farm_profile', {
    profile: toRow(p),
    expected_version: p.version,
  })
  if (error) {
    if (error.code === '40001') throw new Error('This profile changed. Reload before saving.')
    if (error.message === 'This pickup location is used by an order')
      throw new Error('An existing order uses this pickup location. Keep it in the profile.')
    throw new Error('Save failed. Your changes are still here.')
  }
  return fromRow(data)
}
