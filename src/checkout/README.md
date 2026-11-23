# Guest checkout setup

Use a development Supabase project with the cart and producer order schema installed.
Set `VITE_SUPABASE_URL` and the project's publishable key
(`VITE_SUPABASE_ANON_KEY`) in the ignored `.env.local`, and enable anonymous sign-in.
The browser uses the guest's Supabase session. Keep administrative keys out of Vite.

Before applying SQL, confirm the cart has its guest ownership policies, the
producer schema includes `order_items.reserved_quantity`, and the `cut_stock`
view counts new orders' reserved quantities. Check the deployed definitions:

```sql
select indexdef from pg_indexes
where schemaname = 'public' and tablename in ('cart_items', 'order_items');

select pg_get_viewdef('public.cut_stock'::regclass, true);

select to_regprocedure('public.submit_guest_checkout(jsonb)')
  as installed_checkout_function;
```

Order items must allow separate lines for the same cut within one order.
Confirm that the order number and delivery address columns accept text of the
length used by checkout, and check the existing order triggers and producer
order functions. Public read access confirmed `pack_size_lb` exists, but did
not establish the installed indexes, triggers, or checkout function.

Apply these files in this order in the development project:

1. `supabase/migrations/20261114_cart_package_sizes.sql` backfills legacy cart
   rows from their cut's default weight, removes legacy uniqueness on
   `(cart_id, cut_id)`, and installs the three-column unique key.
2. `supabase/migrations/20261115_guest_checkout.sql` creates the private
   request journal and installs the package-size-aware checkout function.
   If the earlier draft was applied manually, run this updated file to replace
   that function. The function retains receipts for existing request IDs.

Test two sizes of one cut, with less stock available than the raw on-hand count.
The cart and checkout subtract the larger of `cuts.held` and
`cut_stock.reserved`, treating the two fields as overlapping counters.
This avoids double-subtracting when they represent the same holds.
The shared project showed differences between these counts on five cuts.
Confirm their meaning with the database owner before rolling out to shared
Supabase, especially if the two fields track independent reservations.

With disposable inventory, verify both lines and the selected weight on each
saved order item, confirm `cut_stock.reserved` increases, and check that a
new request is visible to the producer. Try a rejected delivery or pickup
choice and submit a correction. Retrying the same request ID should return
the same receipt without writing more orders. A second shopper competing for
the last packages should be rejected when there is insufficient stock.

The flow requests orders. The confirmation shows estimated prices and does
not collect payments or send email.
