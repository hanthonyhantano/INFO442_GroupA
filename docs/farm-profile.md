# Producer farm profile

Open `/producer/profile`. The team can review the editor without an assigned producer account. The sample uses the existing Lorem Ranch catalog entry and saves in IndexedDB in the current browser and origin. Preview opens the shopper page for the saved version. Other shoppers do not see local sample edits.

## Connecting an assigned producer

1. Use an isolated Supabase project first. The baseline tables are `farms`, `delivery_zones`, `pickup_locations`, `farm_photos` and `orders`. The function uses the existing `orders.pickup_location_id` relationship to protect pickup locations referenced by orders.
2. Apply [the profile migration](../supabase/migrations/20261123_farm_profile.sql) after those tables exist. It adds `farms.profile_version` and grants the authenticated role access to `save_farm_profile(jsonb, integer)`. One call saves the farm and its related records in a single transaction. A stale version requires reloading. New photos are resized and saved in the existing image text columns.
3. Have an administrator assign the existing farm's numeric ID to the producer's Supabase Auth **app metadata** under `farm_id`, preserving any other metadata. Sign in again to refresh the token. The function checks the signed-in user and this trusted claim. Check the project's existing row-level security policies and table grants so producer writes cannot bypass farm ownership through direct table updates.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the ignored local environment and restart Vite. With an assigned producer session, save a change, reopen the editor and open Preview. Verify that another producer cannot edit the same farm. The shared project requires team approval before applying the migration or testing writes.

For a local sample-only run with no credentials, use `VITE_SUPABASE_URL=http://127.0.0.1:9 VITE_SUPABASE_ANON_KEY=local-demo npm run dev`. Other routes that need Supabase require the team's normal environment.
