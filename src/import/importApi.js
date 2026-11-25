import { supabase } from '../lib/supabase'

export async function submitImport(farmId, plan) {
  const { data, error } = await supabase.rpc('import_farm_inventory', { farm_key: farmId, plan })
  if (error) {
    const rejected =
      error.code?.startsWith('P0') ||
      error.code === '42501' ||
      error.code === 'PGRST202' ||
      error.code?.startsWith('22') ||
      error.code?.startsWith('23')
    const message =
      error.code === 'P0001'
        ? error.message
        : error.code === 'PGRST202'
          ? 'The inventory import migration is required before you can save.'
          : 'Import was rejected. Review the rows and try again.'
    throw Object.assign(new Error(message), { rejected })
  }
  if (data !== plan.cuts.length) throw new Error('Import confirmation unavailable.')
}
