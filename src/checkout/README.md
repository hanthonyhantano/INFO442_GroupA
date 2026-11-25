# Guest checkout setup

The Nov 24 shared-project audit confirmed anonymous sign-in is enabled, cart ownership policies are present, and the required non-null package size and unique (cart_id, cut_id, pack_size_lb) already exist. Skip the cart migration on this project. Older development databases can run 20261114_cart_package_sizes.sql first.

The deployed cut_stock view reports packages_on_hand and sums reserved_quantity for new, confirmed, and packed orders. place_order uses this view. advance_order deducts shipped packages on delivery. cuts.held is a separate batch field and the order functions do not maintain it. There are no user-defined order or order-item triggers. Both the shopper and producer order flows use on_hand minus reserved.

The shared project still needs supabase/migrations/20261115_guest_checkout.sql. The submit function and request journal were absent. The baseline must include order_number_seq, the existing order tables, cut_stock and cart ownership policies. Run the migration in an isolated test project first. Test two sizes, a rejected submission, a successful checkout, an identical retry, and the producer's order allocation. The confirmation is an estimate, with no payment or email.

Before accepting real orders, coordinate appropriate order and inventory access policies with the owners of producer features. The shared audit found broad public access and disabled row-level security on orders, order_items and cuts. The checkout migration does not modify those existing permissions.
