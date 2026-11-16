# Guest checkout integration

This branch is based on Hannah's `cart` branch. Keep its CartProvider when merging.

Before testing real orders, have the database owner review and apply
`supabase/migrations/20261115_guest_checkout.sql` in a development Supabase project.
The function uses the observed orders/order_items column names; table types,
constraints, and existing stock triggers still need verification in that project.
It assumes numeric cart/cut/location IDs, writable cuts.held, status `new`, and
text delivery addresses/order numbers. Do not apply blindly to production.

Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in ignored .env.local. Enable
anonymous sign-in for Hannah's cart. Never put a service-role key in Vite.

Test with disposable inventory: add items, choose a fulfillment method for each
farm, submit, and verify one order per farm plus its order_items. Retry the same
request ID and confirm no duplicate orders. Verify insufficient stock rolls back
all orders and that another user cannot submit this user's cart. Confirm held
stock and cart clearing match the team's existing triggers.

Until the SQL is installed, submitting shows a setup error and never a successful
confirmation. No payments or confirmation emails are implemented. Confirmation
means the request was saved, not that a producer accepted it.
