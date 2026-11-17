import { supabase } from "./supabase.js";
import farm1 from "../assets/farm/farm1.jpg";
import farm2 from "../assets/farm/farm2.jpg";
import farm3 from "../assets/farm/farm3.jpg";
import farm4 from "../assets/farm/farm4.jpg";

const LIST_COLUMNS =
  "id, name, map_label, town, photo_url, lat, lng, delivery_zips, delivery_radius_miles, pickup, tags";

const LOCAL_FARM_IMAGES = { 1: farm1, 2: farm2, 3: farm3, 4: farm4 };
const LIVE_SELECT = "*, delivery_zones(*), pickup_locations(*), farm_photos(*)";
const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };


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

/** "98926-1234" / 98926 / " 98926 " -> "98926", or null if it isn't a ZIP. */
export function normalizeZip(zip) {
  const match = String(zip ?? "").trim().match(/^(\d{5})/);
  return match ? match[1] : null;
}

/** Ask Google for a ZIP's center. Needs the Maps script loaded (window.google). */
function geocodeZip(zip) {
  if (!window.google?.maps?.Geocoder) {
    return Promise.reject(new Error("Google Maps isn't loaded yet"));
  }

  return new window.google.maps.Geocoder()
    .geocode({ componentRestrictions: { country: "US", postalCode: zip } })
    .then(({ results }) => {
      const loc = results?.[0]?.geometry?.location;
      return loc ? [loc.lat(), loc.lng()] : null;
    });
}

/**
 * [lat, lng] of a ZIP code's center, or null if it can't be found.
 * Uses the zip_centers table first, then falls back to Google geocoding,
 * so no ZIP has to be added by hand.
 */
export async function fetchZipCenter(zip) {
  const clean = normalizeZip(zip);
  if (!clean) return null;

  const { data, error } = await supabase
    .from("zip_centers")
    .select("lat, lng")
    .eq("zip", clean)
    .maybeSingle();

  if (error) console.warn("zip_centers lookup failed, trying Google:", error);
  if (data?.lat != null && data?.lng != null) return [data.lat, data.lng];

  return geocodeZip(clean);
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

// Next date (after the lead time) that falls on one of the delivery weekdays
function nextDeliveryDate(zones, leadDays = 0) {
  const wanted = zones
    .flatMap((z) => z.delivery_days ?? [])
    .map((d) => DAY_INDEX[String(d).slice(0, 3).toLowerCase()])
    .filter((n) => n !== undefined);
  if (wanted.length === 0) return null;

  const d = new Date();
  d.setDate(d.getDate() + Math.max(1, leadDays));
  for (let i = 0; i < 7 && !wanted.includes(d.getDay()); i++) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function toLiveFarm(row) {
  const zones = row.delivery_zones ?? [];
  const photo = row.logo ?? row.cover_photo ?? LOCAL_FARM_IMAGES[row.id] ?? null;
  const next = nextDeliveryDate(zones, row.delivery_lead_time_days ?? 0);

  return {
    // list fields
    id: row.id,
    name: row.name,
    mapLabel: row.name,
    town: [row.town, row.state].filter(Boolean).join(", "),
    photo,
    lat: row.latitude,
    lng: row.longitude,
    deliveryZips: zones.flatMap((z) => z.zip_codes ?? []),
    deliveryRadiusMiles: row.delivery_radius_miles ?? null,
    pickup: Boolean(row.pickup_enabled) || (row.pickup_locations ?? []).length > 0,
    tags: row.practices ?? [],

    // detail fields
    operator: row.owner_names,
    sinceYear: row.year_founded,
    description: row.story ?? row.short_description ?? "",
    heroUrl: row.cover_photo ?? photo,
    logoUrl: row.logo ?? photo,
    gallery: [...(row.farm_photos ?? [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((p) => p.image),
    deliveryFee: zones[0]?.fee ?? null,
    deliveryMinimum: row.delivery_minimum,
    nextDelivery: next ? next.toLocaleDateString("en-CA") : null, // "YYYY-MM-DD"
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    pickupLocations: (row.pickup_locations ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      when: [(p.days ?? []).join(", "), p.times].filter(Boolean).join(" · "),
      photo: null,
    })),
  };
}

/** All farms (live schema), for the Farms page. */
export async function fetchFarmList() {
  const { data, error } = await supabase
    .from("farms")
    .select(LIVE_SELECT)
    .order("id");
  if (error) throw error;
  return data.map(toLiveFarm);
}

/** One farm (live schema), for the Farm page. Returns null if it doesn't exist. */
export async function fetchFarmDetail(id) {
  const { data, error } = await supabase
    .from("farms")
    .select(LIVE_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toLiveFarm(data) : null;
}