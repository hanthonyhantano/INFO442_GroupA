// Producer orders reserve packages through the cut_stock view until delivery or rejection.
export function availablePackages(cut, stock) {
  if (!cut.is_live) return 0
  if (stock?.on_hand == null || stock.reserved == null) throw new Error('Stock is unavailable.')
  return Math.max(0, Number(stock.on_hand) - Number(stock.reserved))
}

export async function loadStock(client, ids) {
  const distinct = [...new Set(ids)]
  if (!distinct.length) return new Map()
  const { data, error } = await client.from('cut_stock').select('id,on_hand,reserved').in('id', distinct)
  if (error) throw error
  return new Map(data.map(row => [row.id, row]))
}
