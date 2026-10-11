# Hometown Card Shop — operations, launch gates and marketplace path

## Phase 1 — Hometown's own store

The founding merchant is an **actual seller record** (`hometown-card-shop`) and, once assigned to Supabase Auth, its owner can sign in at `/admin` for the shopkeeper console. Ownership of a shop is separate from ownership of the platform (`platform_staff`). All products, bulk updates, shipping profiles, orders, events and imports are seller-scoped by authenticated server-side membership.

The shopkeeper dashboard includes inventory search/pagination, site-only price overrides (so eBay's price remains authoritative), bulk percentage or fixed-price adjustments, hide/unhide, sport/team assignment, bin locations, weights, CSV import preview/apply, CSV export, order views and fulfillment status with tracking, shipping profile editor and a sample postage **estimate** that counts gift cards.

These admin workflows require a **dedicated Supabase project**. Code alone does not provision the database, seed the original snapshot, or create an owner login. They are disabled until that setup is complete; storefront browsing continues from the static snapshot.

### Database setup, in order

1. Create a separate Supabase project (do not reuse Find A Place Booking or Arkansas Land Pros production data).
2. Apply `supabase/schema.sql` and then `supabase/marketplace-operations.sql` using the Supabase SQL Editor or migrations.
3. Under Authentication → Users, create/invite the founding merchant login. Keep public Auth signups OFF.
4. Get that user's UUID and assign roles, replacing `YOUR-AUTH-USER-UUID`:

```sql
insert into public.platform_staff(user_id,role)
values('YOUR-AUTH-USER-UUID','owner')
on conflict(user_id) do update set role='owner';

insert into public.seller_members(seller_id,user_id,role)
select s.id,'YOUR-AUTH-USER-UUID'::uuid,'owner'
from public.sellers s where s.slug='hometown-card-shop'
on conflict (seller_id,user_id) do update set role='owner';
```

5. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel project environment settings. Service key MUST stay server-only. Redeploy.
6. From a trusted local/server environment, run `node scripts/push-catalog-to-supabase.mjs` to seed all 3,656 listings and 3,243 matched images. Do not seed repeatedly if real orders have started until merge behavior is reviewed.
7. Sign in at `/admin`, review inventory counts and missing photographs, configure shipping profiles with weighed sample packages, including 1/5/10/20 extra gift cards. Configure bonus pool counts. Do not invent USPS or UPS prices.
8. Establish authenticated seller eBay API integration and run full stock reconciliation; add API webhook/periodic sync with alerts. A Seller Hub listing generally requires the Trading API rather than relying on Inventory API-created SKUs alone.
9. Implement atomic stock reservation/release in DB, Stripe Checkout, idempotent Stripe webhook event processing, out-of-stock rollback, external eBay sales reconciliation and eBay inventory write-back for website sales. Test all race cases before enabling checkout.
10. Resolve shipping charges, tracked/untracked service eligibility, tax collection, packing workflows, refunds/returns, guest email receipts and contact policies. Public product pages must only display verified stock. Then deliberately activate store selling and indexing.

**Never set checkout live merely because the catalog loads or a Stripe key has been added.** Current `POST /api/checkout` rejects transactions by design.

### CSV imports and edits

- Download the template under `/public/hometown-card-shop-import-template.csv`.
- File maximum **1,000 products per batch / 2.5 MB** (split large files). Required: SKU, Title, Price in US dollars, Quantity.
- Always preview before applying. Invalid row or duplicate SKU in the file stops the apply. Import upserts use `(seller_id, source='csv', source_item_id=sku)`. They do NOT overwrite eBay-sourced rows accidentally.
- Price bulk edits set `price_override_cents` on the storefront, leaving eBay feed price and identifiers untouched. `price-clear` restores source pricing. eBay-sourced stock cannot be overridden by a generic admin bulk operation.
- Each bulk operation writes a job receipt; item edits write inventory audits. For very large edits, move to a transactional Supabase RPC/queue to avoid request timeouts.
- A seller may export its own catalog; never allow client-supplied seller IDs to bypass server-side membership checks.

### Shipping principles

- Sellers set their own available rate profiles, packaging weight, default card weight, maximum packed weight/card count, additional-card charge and free-shipping threshold. The calculator estimates charge and packed weight; this is **not** a carrier lookup.
- All shipped bonus cards count in package weight and item count. The promotion is funded by Hometown Card Shop's stock, not imposed on future sellers.
- When other sellers launch, the checkout must quote **per-seller shipments**. If a bonus shipment is not in the founding seller's shipment, the platform must fund its separate shipping charge explicitly.
- Don't promise a stamped letter can be tracked. eBay Standard Envelope prices are not a generic discount for the independent website. Confirm actual service and packaging constraints before setting rates.

## Phase 2 — multi-seller marketplace

1. Invite-only seller applications, moderated storefront approval and verified business policies.
2. Storefront merchant identity and seller-role permissions, separate from `platform_staff` identity.
3. Stripe Connect onboarding (identity, KYC and capabilities). Keep your own founding seller as **platform-owned settlement**, not a connected account.
4. One customer checkout can contain items from several sellers. `seller_orders`, `order_lines`, shipping quotes and settlement snapshots divide the order. For one payment to multiple sellers, evaluate Stripe Connect **separate charges and transfers**, with the platform handling processing, refunds, disputes and tax responsibilities per the finalized merchant-of-record model.
5. Idempotent payment, transfer, refund and reversal ledgers; hold funds appropriately and never re-run transfers on webhook retries.
6. Seller-managed shipping and returns, proof of shipment, dispute escalation, feedback moderation, seller fees, tax reporting, listing approval and fraud tools.
7. **Only after** these gates are working should `marketplace_settings.marketplace_mode` and seller signups be enabled. Feature flags alone do not provide payment compliance.

### Security

- `/admin/dashboard` is server gated; `/api/portal/*` checks Supabase-issued authentication token, server lookup of the user's approved seller membership, and role for changes.
- DB service-role credentials never reach the browser. All private RLS tables have no public write policies. Public can read approved sellers and published products only.
- HTTP-only, SameSite cookies hold shopkeeper session tokens. In this initial version the user signs in again after token expiry; an automatic token refresh flow should be added before regular use.
- Owner accounts should use MFA and login rate protections. Enforce CSRF/origin checks, import limits, and server-side monetary calculations. For production, add transactional bulk edits, anti-fraud checks and monitoring.
