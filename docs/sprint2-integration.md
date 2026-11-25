# Sprint 2 integration review

Issue #31 connects the shopper cart badge, signed-in producer identity, CSV import and producer inventory. The checkout PR aligns shopper inventory with the producer order stock view. The profile and Ground changes have their own PRs.

## Verified in the shared project on November 24

The cart has owner policies, anonymous sign-in is on, and the non-null package-size column and unique key already exist. The stock view exposes on-hand and reserved package counts. The app subtracts the reserved count when displaying availability. The existing order functions reserve quantities on new, confirmed, and packed orders and deduct delivered packages from on-hand stock. No user-defined order or order-item triggers were present. Ground was absent, as were the checkout and profile save functions. Zero non-guest accounts had a valid farm assignment.

## Prepare an isolated review database

1. Start with the team's existing Supabase schema, including its order functions, stock view and order number sequence. Set the URL and publishable key in the ignored local environment. Restart Vite when changing projects.
2. For an older cart schema, apply the package-size migration from #49 first. The audited shared project already meets that prerequisite. Then apply the guest checkout SQL from #49, the Ground SQL from #54, the profile SQL from #55 and the inventory import SQL in this PR. Ground precedes any imports using that category.
3. An Auth admin must map an existing non-guest producer to their own farm using trusted app metadata under `farm_id`. Preserve other metadata. Sign in again after provisioning. The application uses the session from Supabase Auth. Dashboard membership alone does not establish a producer identity.
4. Verify with disposable records. Open For producers → Sign in. Upload a CSV, select a batch for new rows, review, and save. Reopen Inventory and check that new rows are drafts. Publish a disposable cut, add two sizes to a guest cart, and compare the badge, marketplace availability and confirmation. Save a farm profile, reopen it, then preview as a shopper. Rejected imports should preserve edits. An ambiguous response should retry the same request.

## Shared rollout

Shared writes need team approval. The existing shared database allows anonymous table access to cuts, orders, and order items with RLS disabled. Coordinate producer-scoped access and public stock reads with the database and producer feature owners before storing real customer details. Preserve access to the aggregate stock view for the catalog and cart. The existing Orders and Batches routes also contain fixed farm identifiers; their owners should verify account scoping independently. Historical batch counters are not rewritten by this integration.
