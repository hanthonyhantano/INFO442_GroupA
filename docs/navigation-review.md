# Sprint 1 navigation review

Branch: `feat/shopper-producer-navigation`. No page content or database changes.

## Implemented

- Shopper: Figma logo and cart asset, Shop / Explore Cuts / Farms / Our Mission / For Producers links, Cart link, parent-section active states (including Shop on Cart), home announcement, responsive menu.
- ZIP: open/edit/save/cancel/clear, five-digit validation, leading-zero preservation, localStorage persistence with session-only fallback, shared selected ZIP, Escape and outside-click dismissal.
- Producer: 256px sidebar, farm-profile link, Today / Orders / Inventory / Batches / Import groups, active state, route-aware header, `/producer` redirect to Today, mobile collapse/open/close-on-selection.
- Account: drop-up, toggle/outside-click/Escape/navigation dismissal, disabled logout until connected; supplied sign-out callback is awaited, errors stay visible, success redirects to sign-in.
- Accessibility: semantic navigation landmarks, current-page links, labelled inputs, expanded states, focus outlines, skip links, keyboard controls.

## Acceptance criteria

- H1–H2: home announcement above navigation; wording emphasizes Washington ranches and whole-animal value.
- EC2 / OM2 / SN1: active sections, including Shop on Cart.
- SN2–SN3: ZIP selector and working editor.
- PN2–PN13 and FP1: producer destinations, farm-profile link, selected section.
- PN18–PN19: account drop-up and logout option (disabled without auth integration).
- PN30–PN32 and corresponding reach criteria: mobile menu, all links, close after selection.
- PN reach dismissal/toggle criteria: implemented.
- PN1, PN14–PN17, PN20–PN29, SN4: UI/integration hooks tested with fixtures; end-to-end acceptance awaits actual auth, producer records, cart, and counts. PN29 hides zero/unknown producer badges now.

## Integration contract

`src/main.jsx` mounts `NavigationProvider`. Future auth/cart/data owners can supply:

```jsx
<NavigationProvider
  session={session}
  producer={{ farmName, farmLocation, name, role }}
  counts={{ tasks, orders, lowStock }}
  cartPackageCount={packageCount}
  onSignOut={signOut}
>
  <App />
</NavigationProvider>
```

- `useNavigation()` exposes these values plus `zip` and `setDeliveryZip`. Product/farm pages can consume the ZIP later; this change does not filter/query inventory.
- Count values must be nonnegative integers. Unknown cart count is hidden; known zero displays zero. Producer badges display only positive counts and update when props change. Inventory threshold/count calculation belongs to the data owner (requirements specify 1–3 available packages).
- `session === undefined` means auth has not been integrated: navigation remains reviewable. `session === null` means confirmed signed out and redirects producer routes to `/sign-in`. A real session allows producer navigation. This is not a security boundary: Supabase RLS/authorization remains the backend's responsibility. The auth owner must hold a loading screen outside the provider until initial session resolution, then supply null or the real session.
- `onSignOut` must return a Promise that rejects on failure. A Supabase adapter must check the returned `error` and throw it, rather than treating a resolved `{ error }` as success.
- Missing identity renders only generic “Farm Profile” / “Account” labels, not fictitious farm or owner data.

## Local setup

Navigation, ZIP persistence, lint, build, and component tests work without `.env.local`.
Before testing Supabase-backed identity, sessions, inventory counts, or cart data, configure repository-root `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the team's project, then restart Vite. The existing ignore rules cover this file. Never put a service-role key in Vite. Environment configuration alone does not connect the unfinished features above.

## Visual review notes

References: Figma marketplace-nav `25:2269`, producer-nav `25:1844`, producer-header `77:4721` in `ZrKIXijSUhp6zyhfn6sZJD`.
The logo and cart SVG are local Figma assets. Typography uses Inter and IBM Plex via Google Fonts, with system fallbacks. The producer icon squares match the placeholders in Figma. ZIP location/chevron use temporary text glyphs because the Figma tool quota prevented exporting the remaining connected icons; Ellie should review these small visual differences. Search and decorative user avatar in the producer header are deferred because no search/account destination exists. No fake counts, ranch names, ZIP default, or dates are shown. The existing page placeholders still show headings beneath the shared producer header.

## Verification and Ellie review checklist

Run `npm test`, `npm run lint`, `npm run build`, then `npm run dev`.
Automated tests cover all navigation destinations, nested active sections, default redirect, ZIP validation/persistence/clear/cancel, shared ZIP consumption, storage failure, badges, confirmed signed-out redirects, logout success/failure, and menu dismissal. Test-only identities and counts are fixtures, never runtime defaults.

Browser-checked at 1440px desktop and 390px mobile: layout, active link, ZIP save/reload, producer redirect, both mobile menus and close-after-selection. Check all links with keyboard and browser back/forward; confirm unknown badges are absent. Compare the shared navigation against Figma, leaving page content to its assigned owners.
