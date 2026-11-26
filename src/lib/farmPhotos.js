import { supabase } from "./supabase";

// Public Supabase Storage bucket that holds farm1.jpg … farm7.jpg
export const FARM_PHOTOS_BUCKET = "farm_photos";

// Turns an image value into a URL the browser can load.
// - Full URLs (https:, data:, blob:) are used as-is.
// - Anything else ("farm3.jpg", "/farm3.jpg", "farm_photos/farm3.jpg") is treated
//   as a file in the farm_photos bucket and turned into its public URL.
// Returns null for empty / non-string values.
export function storageUrl(value, bucket = FARM_PHOTOS_BUCKET) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (/^(https?:|data:|blob:)/.test(v)) return v;

  const path = v.replace(/^\/+/, "").replace(new RegExp(`^${bucket}/`), "");
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Fallbacks for farms whose row has no logo / cover_photo.
// (Same mapping as the old local imports, now pointing at the bucket.)
const FALLBACK_LOGOS = { 1: "farm1.jpg", 2: "farm2.jpg", 3: "farm3.jpg", 4: "farm4.jpg" };
const FALLBACK_COVER = "farm7.jpg";

export const fallbackFarmLogo = (farmId) =>
  FALLBACK_LOGOS[farmId] ? storageUrl(FALLBACK_LOGOS[farmId]) : null;

export const fallbackFarmCover = () => storageUrl(FALLBACK_COVER);