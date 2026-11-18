// Written content for products that isn't in Supabase yet (blurbs, cook steps,
// cow region, delivery placeholders). Price, stock, farm, name and photo now
// come from the Supabase `cuts` table; see contentFor() below.
//
// PRODUCTS is still exported for pages that list products (Shop, Explore).
// Link those to `/shop/product/${p.cutId}`: the product page now uses cuts.id.

// Every image in assets/meat, keyed by filename without the extension
const meatImages = import.meta.glob("../assets/meat/*.{jpg,jpeg,png}", {
  eager: true,
  import: "default",
});

const imageBySlug = Object.fromEntries(
  Object.entries(meatImages).map(([path, url]) => [
    path.split("/").pop().replace(/\.[^.]+$/, "").toLowerCase(),
    url,
  ])
);

// "Eye of Round" -> "eyeofround"
export const slug = (name) => (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const COOK = {
  Braise: { time: "3 HR", temp: "300°F", steps: ["Salt and sear the meat.", "Add onions, stock, and herbs.", "Cover and braise until tender.", "Rest, then serve."] },
  Roast: { time: "2 HR", temp: "325°F", steps: ["Season and bring to room temperature.", "Roast on a rack.", "Cook to your target temperature.", "Rest before slicing."] },
  Smoke: { time: "6 HR", temp: "250°F", steps: ["Rub and rest overnight.", "Smoke until the bark sets.", "Wrap and continue until tender.", "Rest wrapped for an hour."] },
};

const base = {
  tags: ["Underrated"],
  blurb: "Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do.",
  underrated: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  packSizes: [2, 2.5, 3],
  nextDelivery: "Wed, Oct 22",
  deliveryZips: ["98105", "98101"],
  cowCaption: "Lorem ipsum dolor sit.",
  cook: COOK,
};

const DOLOR = { id: 2, name: "Dolor Farm", town: "Enumclaw, WA" };
const LOREM = { id: 1, name: "Lorem Ranch", town: "Ellensburg, WA" };

// cutId = cuts.id in Supabase. The five `null`s are filled in after running
// supabase_link_products.sql (it prints the new ids).
export const PRODUCTS = [
  { ...base, id: 1, cutId: null, name: "Ground Beef", cut: "chuck", tags: ["Everyday", "Ground"],
    farm: DOLOR, pricePerLb: 9.5, defaultSize: 2.5, availablePackages: 12, inStock: 12 },
  { ...base, id: 2, cutId: null, name: "Ribeye Steak", cut: "rib", tags: ["Steak", "Rib"],
    farm: DOLOR, pricePerLb: 19.5, defaultSize: 1, availablePackages: 0, inStock: 0 },
  { ...base, id: 3, cutId: 1, name: "Chuck Roast", cut: "chuck", tags: ["Underrated", "Chuck"],
    farm: LOREM, pricePerLb: 12.5, defaultSize: 3, availablePackages: 5, inStock: 5 },
  { ...base, id: 4, cutId: 5, name: "Short Ribs", cut: "plate", tags: ["Braising", "Rib"],
    farm: LOREM, pricePerLb: 11.99, defaultSize: 2, availablePackages: 8, inStock: 8 },
  { ...base, id: 5, cutId: 2, name: "Denver Steak", cut: "chuck", tags: ["Steak", "Chuck"],
    farm: LOREM, pricePerLb: 14.25, defaultSize: 1, availablePackages: 6, inStock: 6 },
  { ...base, id: 6, cutId: 3, name: "Flat Iron", cut: "chuck", tags: ["Steak", "Chuck"],
    farm: DOLOR, pricePerLb: 15.0, defaultSize: 1, availablePackages: 4, inStock: 4 },
  { ...base, id: 7, cutId: null, name: "NY Strip", cut: "loin", tags: ["Steak", "Loin"],
    farm: DOLOR, pricePerLb: 21.0, defaultSize: 1, availablePackages: 7, inStock: 7 },
  { ...base, id: 8, cutId: null, name: "Top Sirloin", cut: "sirloin", tags: ["Steak", "Sirloin"],
    farm: LOREM, pricePerLb: 13.5, defaultSize: 1.5, availablePackages: 9, inStock: 9 },
  { ...base, id: 9, cutId: null, name: "Brisket", cut: "brisket", tags: ["Smoking", "Brisket"],
    farm: LOREM, pricePerLb: 10.75, defaultSize: 3, availablePackages: 3, inStock: 3 },
  { ...base, id: 10, cutId: 6, name: "Flank Steak", cut: "flank", tags: ["Steak", "Flank"],
    farm: DOLOR, pricePerLb: 12.0, defaultSize: 1.5, availablePackages: 5, inStock: 5 },
  { ...base, id: 11, cutId: 7, name: "Eye of Round", cut: "round", tags: ["Roast", "Round"],
    farm: DOLOR, pricePerLb: 9.0, defaultSize: 2.5, availablePackages: 6, inStock: 6 },
  { ...base, id: 12, cutId: 8, name: "Beef Shank", cut: "shank", tags: ["Braising", "Shank"],
    farm: LOREM, pricePerLb: 7.5, defaultSize: 2, availablePackages: 4, inStock: 4 },
  { ...base, id: 13, cutId: 9, name: "Oxtail", cut: "tail", tags: ["Braising", "Tail"],
    farm: DOLOR, pricePerLb: 8.75, defaultSize: 2, availablePackages: 3, inStock: 3 },
  { ...base, id: 14, cutId: 10, name: "Beef Cheeks", cut: "cheek", tags: ["Braising", "Cheek"],
    farm: LOREM, pricePerLb: 9.5, defaultSize: 2, availablePackages: 5, inStock: 5 },
];

PRODUCTS.forEach((p) => {
  p.photoUrl = imageBySlug[slug(p.name)] ?? null;
});

// Supabase cut names that differ from the product names above
const ALIASES = {
  crosscutshank: "beefshank",
  beefcheek: "beefcheeks",
};

// Content for cuts that have no entry in PRODUCTS
const EXTRA = {
  skirtsteak: { cut: "plate", tags: ["Steak", "Plate"] },
};

const bySlug = Object.fromEntries(PRODUCTS.map((p) => [slug(p.name), p]));

// Written content for a Supabase cut, matched by name.
// Falls back to the placeholder copy so every cut gets a full page.
export function contentFor(cutName) {
  const s = slug(cutName);
  const key = ALIASES[s] ?? s;
  const p = bySlug[key];
  return {
    ...base,
    cut: null,
    defaultSize: base.packSizes[1],
    ...EXTRA[key],
    ...(p && {
      cut: p.cut,
      tags: p.tags,
      defaultSize: p.defaultSize,
      packSizes: p.packSizes,
    }),
    photoUrl: p?.photoUrl ?? imageBySlug[key] ?? null,
  };
}