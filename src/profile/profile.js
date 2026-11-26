export const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const splitList = (text) => text.split(/[,\s]+/).filter(Boolean)
export function validate(p) {
  const errors = {}
  if (!p.name.trim()) errors.name = 'Enter a farm name.'
  if (!p.location.split(',')[0].trim()) errors.location = 'Enter a farm location.'
  if (p.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.contact_email))
    errors.contact_email = 'Enter a valid email address.'
  if (
    p.contact_phone &&
    (!/^[\d ()+.-]+$/.test(p.contact_phone) || p.contact_phone.replace(/\D/g, '').length !== 10)
  )
    errors.contact_phone = 'Enter a 10-digit phone number.'
  if (!p.delivery_enabled && !p.pickup_enabled)
    errors.methods = 'Turn on delivery or pickup so shoppers can get their order.'
  if (p.photos.length > 4) errors.photos = 'Choose up to four gallery photos.'
  for (const key of ['delivery_minimum', 'delivery_lead_time_days']) {
    if (!Number.isFinite(Number(p[key])) || Number(p[key]) < 0)
      errors[key] = 'Enter a nonnegative number.'
  }
  if (!Number.isInteger(Number(p.delivery_lead_time_days)))
    errors.delivery_lead_time_days = 'Enter whole days.'
  for (const [i, z] of p.zones.entries()) {
    if (
      !z.name.trim() ||
      !z.delivery_days.length ||
      !z.delivery_days.every((day) => days.includes(day)) ||
      !splitList(z.zips).length ||
      !splitList(z.zips).every((zip) => /^\d{5}$/.test(zip)) ||
      z.fee === '' ||
      !Number.isFinite(Number(z.fee)) ||
      Number(z.fee) < 0
    )
      errors['zones' + i] =
        'Enter a zone name, delivery days, five-digit ZIP codes and a nonnegative fee.'
  }
  for (const [i, l] of p.pickups.entries()) {
    if (
      ![l.name, l.address, l.times].every((v) => v.trim()) ||
      !l.days.length ||
      !l.days.every((day) => days.includes(day))
    )
      errors['pickups' + i] = 'Enter a pickup name, address, days and times.'
  }
  return errors
}
function normalizeDays(values) {
  return [
    ...new Set(
      (values ?? []).map(
        (value) =>
          days.find((day) => day.toLowerCase() === String(value).trim().slice(0, 3).toLowerCase()) ??
          value,
      ),
    ),
  ]
}
export function fromRow(row) {
  return {
    id: row.id,
    version: row.profile_version ?? 0,
    name: row.name ?? '',
    location: [row.town, row.state].filter(Boolean).join(', '),
    story: row.story ?? row.short_description ?? '',
    practices: row.practices ?? [],
    cover_photo: row.cover_photo ?? '',
    photos: [...(row.farm_photos ?? [])].sort((a, b) => a.position - b.position).map((p) => p.image),
    delivery_enabled: !!row.delivery_enabled,
    pickup_enabled: !!row.pickup_enabled,
    delivery_minimum: row.delivery_minimum ?? '',
    delivery_lead_time_days: row.delivery_lead_time_days ?? '',
    contact_email: row.contact_email ?? '',
    contact_phone: row.contact_phone ?? '',
    zones: (row.delivery_zones ?? []).map((z) => ({
      id: z.id,
      name: z.name ?? '',
      fee: z.fee ?? 0,
      delivery_days: normalizeDays(z.delivery_days),
      zips: (z.zip_codes ?? []).join(', '),
    })),
    pickups: (row.pickup_locations ?? []).map((p) => ({
      id: p.id,
      name: p.name ?? '',
      days: normalizeDays(p.days),
      address: p.address ?? '',
      times: p.times ?? '',
    })),
  }
}
export function toRow(p) {
  const [town, ...state] = p.location.split(',')
  return {
    id: p.id,
    name: p.name.trim(),
    town: town.trim(),
    state: state.join(',').trim(),
    story: p.story.trim(),
    practices: p.practices,
    cover_photo: p.cover_photo || null,
    farm_photos: p.photos.map((image, position) => ({ image, position })),
    pickup_enabled: p.pickup_enabled,
    delivery_enabled: p.delivery_enabled,
    delivery_minimum: p.delivery_minimum === '' ? null : Number(p.delivery_minimum),
    delivery_lead_time_days: p.delivery_lead_time_days === '' ? null : Number(p.delivery_lead_time_days),
    contact_email: p.contact_email.trim(),
    contact_phone: p.contact_phone.trim(),
    delivery_zones: p.zones.map(({ id, name, fee, delivery_days, zips }) => ({
      id,
      name: name.trim(),
      fee: Number(fee),
      delivery_days,
      zip_codes: [...new Set(splitList(zips))],
    })),
    pickup_locations: p.pickups.map(({ id, name, address, days, times }) => ({
      id,
      name: name.trim(),
      address: address.trim(),
      days,
      times: times.trim(),
    })),
  }
}
export async function readPhoto(file) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('Choose a JPG or PNG photo.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose a photo of 5 MB or less.')
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const signature = file.type === 'image/png' ? [137, 80, 78, 71, 13, 10, 26, 10] : [255, 216, 255]
  if (!signature.every((byte, i) => byte === header[i]))
    throw new Error('Choose a valid JPG or PNG photo.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8)
  } finally {
    URL.revokeObjectURL(url)
  }
}
