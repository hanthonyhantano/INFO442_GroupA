# Consumer Feature Validation

Validated by Amani on Nov 7, 2026, against the final requirements for the shopper pages. I checked commit `836b51d` on main, which includes PR #36 (farm pages) and PR #37 (homepage, Explore Cuts, Mission, Shop).

## What I did

I went through the code for each page and checked it against every requirement. I also ran the tests (all 17 pass), the build (works) and the linter (2 small warnings).

## Results

| Page | Requirements | Pass | Partly works | Fail | Still need to check in browser |
| --- | --- | --- | --- | --- | --- |
| Home | 69 | 59 | 5 | 2 | 3 |
| Explore Cuts | 51 | 43 | 2 | 1 | 5 |
| Our Mission | 19 | 17 | 0 | 0 | 2 |
| Farms | 40 | 24 | 1 | 8 | 7 |
| Farm Page | 39 | 36 | 2 | 1 | 0 |
| Total | 218 | 179 | 10 | 12 | 17 |

## Biggest problems

1. **Product links on the Farm Page are broken.** They go to `/products/1`, but the app's route is `/shop/1`. That's the blank page Ellie found. Changing the link in `FarmPage.jsx` fixes it.
2. **The product detail page isn't built yet.** It's still a placeholder, and we don't have written requirements for it or for the Shop page.
3. **Distances on the Farms page are hardcoded.** They don't come from your ZIP and don't change when you change it.
4. **The map doesn't load.** We need a Google Maps API key in `.env` with billing turned on. There's also no message when the map fails.
5. **Farm data is copied in three places** (`catalog.js`, `Farms.jsx`, `FarmPage.jsx`), and the copies already don't match.

## What needs fixing

### Home (Owen)
- **H60 (fail):** Farm cards show tags instead of "100% grass-fed."
- **H68 (fail):** The mission points aren't numbered 1, 2, 3.
- **H2 (partial):** The announcement bar doesn't mention buying a whole animal.
- **H30 (partial):** While loading, it shows the text "Loading listings…" instead of gray placeholder cards.
- **H34 (partial):** With no photo, it shows the words "Photo unavailable" instead of an image icon.
- **H42, H43 (partial):** Cards link to the product page, but that page isn't built.

### Explore Cuts (Owen)
- **EC36 (fail):** The In Stock list doesn't show product photos.
- **EC41 (partial):** The product name links to a page that isn't built.
- **EC45 (partial):** While loading, it shows text instead of placeholders.
- **Small bug:** After you click Add, "Added ✓" shows up twice.

### Our Mission (Owen)
Nothing to fix.

### Farms (Hannah)
- **FM5 (fail):** Farm cards show a gray box instead of a photo.
- **FM8, FM9, FM35 (fail):** Distances are hardcoded instead of calculated from the ZIP.
- **FM21 (fail):** Hovering a farm card doesn't highlight its map pin.
- **FM29 (fail):** There's no message when the map can't load.
- **FM37, FM40 (fail):** There's no loading or error state.
- **FM34 (partial):** Changing the ZIP updates the delivery count but not the distances.
- **Cleanup:**
  - Each farm card still has a gray placeholder bar inside it.
  - There's a leftover `console.log` when a map pin is clicked.
  - `FarmsMap.jsx` and `farmsApi.js` aren't being used.

### Farm Page (Hannah)
- **FD20 (fail):** Product links go to `/products/` instead of `/shop/`.
- **FD25 (partial):** Delivery dates are hardcoded and already in the past.
- **FD28 (partial):** It says "Pickup is available below" even for farms that have no pickup locations.

## Still need to check in the browser

The code looks right for these, but I need to confirm them by clicking through:

- **Home:**
  - H12: whether the hero image counts as the CATCOW logo.
  - H69, H70: the mobile layout.
- **Explore Cuts:** the hover and selected colors (EC9, EC10, EC12, EC16, EC19).
- **Our Mission:**
  - OM6: whether the photo sits next to the headline.
  - OM14: the mobile layout.
- **Farms:**
  - FM20, FM22–FM24: the map pins and the delivery outline. These can't be checked until the map loads.
  - FM31–FM33: the mobile Map/List toggle.

## Everything that passed

- **Home:** H1, H3–H11, H13–H29, H31–H33, H35–H41, H44–H59, H61, H63–H67
- **Explore Cuts:** EC1–EC8, EC11, EC13–EC15, EC17, EC18, EC21–EC35, EC37–EC40, EC42–EC44, EC46–EC52. The Tab and Enter stretch goals also work.
- **Our Mission:** OM1–OM5, OM7–OM13, OM15–OM19
- **Farms:** FM1–FM4, FM6, FM7, FM10–FM19, FM25–FM28, FM30, FM36, FM38, FM39
- **Farm Page:** FD1–FD19, FD21–FD24, FD26, FD27, FD29–FD39

## Not checked

- **Cart and For Producers:** not part of this sprint.
- **Shop and Product Detail:** no requirements written yet.

## Notes on the requirements doc

- H62 and EC20 are missing.
- EC-reach1 and EC-reach2 are each used twice.
- There are typos in FD36 ("Cat Cow.wen") and FD39 (a missing quote mark).
