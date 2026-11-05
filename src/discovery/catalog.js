// Preview IDs, names and prices match the farm pages on the farmpages branch.
const farms = [
  [1, "Lorem Ranch", "Ellensburg", 47.003, -120.5478, true, ["98105", "98101"]],
  [2, "Dolor Farm", "Enumclaw", 47.2043, -121.9915, true, ["98105", "98101"]],
  [3, "Ipsum Grazing", "Walla Walla", 46.0646, -118.343, false, []],
  [4, "Amet Cattle Co.", "Sequim", 48.0795, -123.1012, false, ["98105"]],
].map(([id, name, town, lat, lng, pickup, delivery_zips]) => ({
  id,
  name,
  town,
  lat,
  lng,
  pickup,
  delivery_zips,
}));
const previewDetails = [
  [
    "Lorem & Ipsum Dolor",
    "A family-owned Ellensburg ranch focused on rotational grazing.",
    ["Rotational grazing", "Grass-finished"],
  ],
  [
    "Jane & Tom Dolor",
    "Pasture-raised beef from Enumclaw.",
    ["Grass-fed", "Pasture raised"],
  ],
  [
    null,
    "Grass-finished cattle from southeastern Washington.",
    ["Grass-finished"],
  ],
  [null, "Locally raised beef from the Olympic Peninsula.", []],
];
for (const [i, farm] of farms.entries()) {
  const [operator, description, tags] = previewDetails[i];
  Object.assign(farm, { operator, description, tags });
}
const products = [
  [1, 2, "Ground Beef", 9.5, 2.5, 12, "Chuck", "Skillet", false, 60],
  [2, 2, "Ribeye Steak", 19.5, 1, 0, "Rib", "Grill", false, 70],
  [3, 1, "Chuck Roast", 12.5, 3, 5, "Chuck", "Braise", true, 30],
  [4, 1, "Short Ribs", 11.99, 2, 8, "Plate", "Braise", true, 35],
].map(
  ([
    id,
    farm_id,
    name,
    price_per_lb,
    approx_weight_lb,
    available_packages,
    cut_category,
    cooking_tag,
    featured,
    batch_percent_sold,
  ]) => ({
    id,
    farm_id,
    name,
    price_per_lb,
    approx_weight_lb,
    available_packages,
    cut_category,
    cooking_tag,
    featured,
    batch_percent_sold,
    status: "Live",
    in_stock: available_packages > 0,
  }),
);
const centers = { 98105: [47.661, -122.29], 98101: [47.61, -122.334] };
export const preview =
  !import.meta.env.VITE_SUPABASE_URL && !import.meta.env.VITE_SUPABASE_ANON_KEY;
export async function loadCatalog(zip) {
  if (preview) return { farms, products, center: centers[zip] };
  const { supabase } = await import("../lib/supabase");
  const [f, p, z] = await Promise.all([
    supabase.from("farms").select("*"),
    supabase.from("products").select("*").eq("in_stock", true),
    zip
      ? supabase
          .from("zip_centers")
          .select("lat,lng")
          .eq("zip", zip)
          .maybeSingle()
      : { data: null },
  ]);
  for (const result of [f, p, z]) if (result.error) throw result.error;
  return {
    farms: f.data,
    products: p.data,
    center: z.data && [z.data.lat, z.data.lng],
  };
}
function miles(center, farm) {
  if (!center || farm.lat == null || farm.lng == null) return Infinity;
  const rad = Math.PI / 180;
  const a =
    Math.sin(((farm.lat - center[0]) * rad) / 2) ** 2 +
    Math.cos(center[0] * rad) *
      Math.cos(farm.lat * rad) *
      Math.sin(((farm.lng - center[1]) * rad) / 2) ** 2;
  return 7918 * Math.asin(Math.sqrt(Math.min(1, a)));
}
export function visibleCatalog(data, zip) {
  const nearest = data.farms
    .map((f) => ({ ...f, miles: miles(data.center, f) }))
    .sort((a, b) => a.miles - b.miles);
  const byId = new Map(nearest.map((f) => [String(f.id), f]));
  const items = data.products
    .map((p) => ({ ...p, farm: byId.get(String(p.farm_id)) }))
    .filter(
      (p) =>
        p.farm &&
        p.in_stock &&
        (p.status == null || p.status.toLowerCase() === "live") &&
        (p.available_packages == null || p.available_packages > 0) &&
        (!zip ||
          p.farm.delivery_zips?.includes(zip) ||
          (p.farm.pickup && p.farm.miles <= 100)),
    );
  const featured = items
    .filter((p) => p.featured === true)
    .sort(
      (a, b) =>
        (a.batch_percent_sold ?? Infinity) -
          (b.batch_percent_sold ?? Infinity) ||
        (b.available_packages ?? 0) - (a.available_packages ?? 0),
    )
    .slice(0, 4);
  return { farms: nearest, items, featured };
}
