# Hometown Card Shop — marketplace-ready from day one

## Launch principles

- **Brand**: Hometown Card Shop. Original Arkansas logo is retained as a heritage emblem; the visible name is the new store name.
- **Current shop**: one founding seller, `hometown-card-shop`. No public seller registration yet.
- **Later**: each product, imported listing, sale, shipment, stock movement, payout identity, and refund has a seller owner from the beginning.
- **Rewards**: an order-wide **shop-funded promotion**, not a requirement on future sellers. One common free card with *any* paid merchandise order; five at $10; ten at $25; twenty at $50. Non-stacking, merchandise subtotal before taxes and shipping. Free common cards are a guaranteed gift, not a paid chance-based prize.
- **No false availability**: all categories exist in the navigation directory but shelves without inventory say **Not stocked yet**. Products only appear in populated groups.

## Database design

The schema in `supabase/schema.sql` defines:

- `sellers`, `seller_members`, `seller_integrations`, `seller_payout_accounts` — future identity, roles, seller status, integrations and Stripe Connect onboarding readiness.
- `products` — UUID primary key and `(seller_id, source, source_item_id)` unique mapping, so two future sellers can list the same card or even the same external numeric SKU safely.
- `categories`, `product_categories` — flexible catalogue taxonomy separate from eBay category strings. The front-end `lib/categories.ts` displays both active and upcoming shelves today.
- `orders` and `seller_orders` — one buyer checkout can later contain multiple seller shipments; each seller has a separate settlement/fulfillment record.
- `order_lines` — seller ID and immutable price/title snapshots to avoid seller mixups after listings change.
- `inventory_reservations` and `stock_movements` — prepare atomic quantity reservation, reconciliation and durable audit trails.
- `reward_policies`, `order_bonus_cards`, `bonus_card_pools` and `bonus_stock_movements` — reward quantities tied to the house/funding seller and dedicated bulk inventory, not charged to another seller. After marketplace launch, shipping a funded gift in a separate parcel would need explicit cost and fulfillment rules.

No public client-side database writes are allowed. Shop signup/payout tables are included but seller signups intentionally remain disabled until proper account moderation, tax compliance and payout onboarding exist. Only a dedicated server may act with the service-role key.

## Seller onboarding, later (not active)

1. Approved application / account creation, Supabase authentication and membership role.
2. Marketplace seller terms, identity/verification, dispute/return/shipping policies, tax requirements.
3. Stripe Connect onboarding, verified capabilities and settlement logic; do NOT insert vendor payout data into frontend fields.
4. Seller listing import / manual entry; seller-scoped SKUs and categories, photo hosting.
5. Admin product review, anti-counterfeit policies, safety controls and moderation.
6. Per-seller shipping and fulfillment, refunds, tax nexus, multi-seller tax allocation and customer support.
7. Seller fees configured prospectively and recorded in seller_order snapshots. Never infer merchant/processor fees at payout time.

## Current preview vs production

**Preview only.** `lib/products.json` is a snapshot of 3,656 October 11 eBay listings; 3,243 have CollX image URLs. The store uses a localStorage cart, with seller-scoped line keys. Payment is disabled and SEO is noindex in preview. Do not make the site live until:

- A *dedicated* Supabase project is provisioned and seeded with v2 schema.
- The founding seller's eBay account is authorized, and all active listings/quantities reconciled with a complete authenticated report.
- Orders from eBay and website are ingested with idempotent callbacks/reconciliation.
- Stripe Checkout + signed, idempotent webhooks + server-priced shipping/tax + **transactional stock reservations** are implemented and tested.
- Website sales end/reduce eBay inventory and handle failures; no double-sale guarantees while there is network/API delay.
- Packaging, shipping price, handling time, returns and refunds reflect the bonus cards' extra weight.
- Legal terms, privacy notices and contact details are verified before launch.

Keep `NEXT_PUBLIC_STORE_LIVE=false` until **all** points are satisfied. v2 schema is a new design; do not apply over an existing production database without a migration plan.
