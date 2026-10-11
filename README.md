# Hometown Card Shop

An old-school **Arkansas neighborhood card shop** built to become a multi-seller card marketplace without replacing its core product/order schema. The founding seller is the only seller at launch. Future seller onboarding is deliberately OFF.

## The experience today

- Vintage storefront inspired by a real shop counter: cream paper, blue signage, hand-lettered-style headings, clean product grids, no made-up card photos.
- **3,656** actual active eBay snapshot listings imported, **3,243** with matched CollX item front photos. The store shows real source links, quantities and item details; product availability is a **snapshot**, not live stock.
- Player, team, sport, year and set search, sorting, pagination, product pages and mobile cart.
- **All the card shop's category shelves** are defined upfront. Only categories with actual inventory can be browsed; empty categories are clearly marked **Not stocked yet**.
- **1 free common card with ANY order**, even a single 89¢ card; **5 at $10**, **10 at $25**, **20 at $50**. Each order receives ONE tier, based on merchandise subtotal excluding shipping and tax. Rewards are guaranteed free common cards, not gambling or a sweepstakes. House-funded and house-fulfilled, not automatically imposed on future outside sellers.
- Seller-specific cart line keys, product ownership, payouts identities and per-seller fulfillment tables designed in from the beginning. Seller signups are NOT open.
- FAQ, shipping preview, about, categories, metadata and sitemap safeguards.

## Running locally

```bash
npm install
npm run dev
# or run: npm run build
```

Node.js 22+. The `.env.example` file documents the configuration. Do not put secret keys in the browser or commit them to GitHub. `NEXT_PUBLIC_STORE_LIVE=false` keeps the preview **noindex** and payments disabled. We recommend a new Vercel project for this storefront rather than changing unrelated projects.

## Inventory source

`lib/products.json` is generated from the October 11 eBay active-listings CSV and the user's CollX inventory tracker. To reprocess a refreshed CSV snapshot:

```bash
python scripts/build_catalog.py /path/to/ebay-active.csv /path/to/collx-inventory.csv
```

To seed a dedicated new Supabase database, run `supabase/schema.sql`, then set server-only environment variables and run:

```bash
node scripts/push-catalog-to-supabase.mjs
```

Seller eBay API authorization and the one-way poll/reconcile starter are in `scripts/sync-ebay.mjs`. **It is not active.** Please read `docs/MARKETPLACE_ARCHITECTURE.md` for the future multi-seller implementation and mandatory payment safeguards.

## Launch status

**Not accepting direct payments yet.** We have not provisioned a dedicated Supabase DB, connected the eBay seller account, connected checkout or authorized payouts. Stripe order processing, live carrier rates, idempotent webhooks, atomic reservations, eBay writeback, disputes, seller onboarding, Connect payouts and buyer support are production work still required. Private seller dashboard screens and shipping estimators have been implemented, but require a new Supabase instance and user roles to function. The `POST /api/checkout` route intentionally responds `503`. Seller onboarding remains disabled until Stripe Connect, moderation, seller tax and settlement are designed and tested. The store never quietly takes orders against a stale imported eBay snapshot.

## Source layout

- `app/` Next.js App Router site, browsing UI and locked-safe backend routes.
- `components/` cart, cards, rewards and branded navigation.
- `lib/shop-config.ts` brand identity, founding seller and rewards config.
- `lib/categories.ts` whole-platform categories with stock-aware display.
- `lib/catalog.ts` static inventory adapter (seller ownership added).
- `lib/catalog-db.ts` future dedicated Supabase catalog adapter.
- `supabase/schema.sql` marketplace-first seller, product, order, shipment, reward and stock schema.
- `scripts/` snapshot import and disabled until-authorized eBay feed integration.
- `docs/MARKETPLACE_ARCHITECTURE.md` production and future platform rollout.

## Shopkeeper dashboard (Phase 1 management build)

Open `/admin` and sign in with a Supabase Auth user assigned to an approved seller. The private `/admin/dashboard` includes seller-scoped inventory, CSV import preview/upsert/export, bulk site price overrides and categorization, order packing/fulfillment and editable shipping rules with bonus-card weight calculations. The founding seller can also have `platform_staff` owner access, separate from `seller_members` shop-owner access.

Read **`docs/OPERATIONS_AND_ROLLOUT.md`** for the sequence: create a dedicated Supabase project, apply both SQL migrations, create the owner login, seed the catalog, configure shipping, and test eBay synchronization before any payment is turned on. All new private endpoints enforce seller authorization on the server; `SELLER_SIGNUPS_ENABLED=false` remains off.
