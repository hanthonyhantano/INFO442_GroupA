import { supabase } from "./supabase.js";

const LIST_COLUMNS =
  "id, name, map_label, town, photo_url, lat, lng, delivery_zips, delivery_radius_miles, pickup, tags";

// Database columns are snake_case; the pages use camelCase.
function toFarm(row) {
  return {
    id: row.id,
    name: row.name,
    mapLabel: row.map_label,
    town: row.town,
    photo: row.photo_url,
    lat: row.lat,
    lng: row.lng,
    deliveryZips: row.delivery_zips ?? [],
    deliveryRadiusMiles: row.delivery_radius_miles,
    pickup: row.pickup,
    tags: row.tags ?? [],
  };
}

/** All farms, for the Farms page. */
export async function fetchFarms() {
  const { data, error } = await supabase.from("farms").select(LIST_COLUMNS);
  if (error) throw error;
  return data.map(toFarm);
}

/** [lat, lng] of a ZIP code's center, or null if the ZIP isn't in the table. */
export async function fetchZipCenter(zip) {
  const { data, error } = await supabase
    .from("zip_centers")
    .select("lat, lng")
    .eq("zip", zip)
    .maybeSingle();
  if (error) throw error;
  return data ? [data.lat, data.lng] : null;
}

/** One farm with its pickup locations, for the Farm page. Returns null if it doesn't exist. */
export async function fetchFarm(id) {
  const { data, error } = await supabase
    .from("farms")
    .select("*, pickup_locations(id, name, when_text, photo_url, sort_order)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    ...toFarm(data),
    operator: data.operator,
    sinceYear: data.since_year,
    breed: data.breed,
    description: data.description,
    heroUrl: data.hero_url,
    logoUrl: data.logo_url,
    gallery: data.gallery_urls ?? [],
    deliveryFee: data.delivery_fee,
    deliveryMinimum: data.delivery_minimum,
    nextDelivery: data.next_delivery, // "YYYY-MM-DD"
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
    pickupLocations: [...(data.pickup_locations ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({ id: p.id, name: p.name, when: p.when_text, photo: p.photo_url })),
  };
}

/** In-stock products for a farm (first `limit`) plus the total in-stock count. */
export async function fetchProducts(farmId, limit = 4) {
  const { data, error, count } = await supabase
    .from("products")
    .select("id, name, price_per_lb, approx_weight_lb, photo_url", { count: "exact" })
    .eq("farm_id", farmId)
    .eq("in_stock", true)
    .order("name")
    .limit(limit);
  if (error) throw error;
  return {
    total: count ?? data.length,
    products: data.map((p) => ({
      id: p.id,
      name: p.name,
      pricePerLb: Number(p.price_per_lb),
      approxWeightLb: p.approx_weight_lb == null ? null : Number(p.approx_weight_lb),
      photo: p.photo_url,
    })),
  };
}
