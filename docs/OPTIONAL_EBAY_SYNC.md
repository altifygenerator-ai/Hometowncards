# Optional seller eBay linking for Hometown Card Shop

## What works after production OAuth setup

### Trading cards plus sports license plates — strict storefront gate

**The Hometown Card Shop eBay-linked storefront is now limited to trading cards
and sports-team decorative license plates.** Books, software, electronics, board
games, ordinary automotive plates and all other merchandise remain on eBay but
are hidden from this website. Manual and CSV listings are unaffected.

eBay's `GetMyeBaySelling` response often omits `PrimaryCategory.CategoryID`,
so filtering only by the category ID did not work. The new server-side
`hcs_ebay_storefront_kind` classifies using a verified eBay card category ID
**or** conservative card-title patterns such as card year, recognizable trading-card
brand and card number. Sports-themed license plates are recognized separately and
sorted as **Memorabilia / Sports License Plates**. Anything uncertain remains
hidden for review rather than exposed as a card.

Existing eBay-linked rows were reclassified in Supabase, without deleting
their historical records or updating the actual eBay listings. The
`getCatalog` query separately enforces a hard product-kind allowlist, ensuring
old/stale classified products cannot reappear on the public website.

For card organization, the importer reads eBay ItemSpecifics when available
and otherwise parses clear title details for year, set, card number and player.
Existing manual edits in `listing_overrides` are respected. Team information
is only populated if supported by a team value in eBay data or the listing title;
the system does not invent missing teams. New cards without enough evidence are
hidden for review.

The eBay feed sometimes omits `QuantityAvailable`. The importer now correctly
falls back to the listed quantity minus units sold rather than treating a missing
number as zero and falsely marking cards sold out.

### Previous card-only filter (superseded)

The eBay importer now uses eBay's own primary **CategoryID**, not guesses from an item title.
It imports physical sports trading card singles, card lots, sets and sealed packs; non-sport
trading cards in those forms; and CCG singles, mixed lots, sets and packs. The allowlist
is maintained in `lib/ebay-card-categories.ts`, with a mirrored server-side check in
`hcs_reconcile_ebay_cards_page`. It excludes books, comics, video games, consoles, controllers,
cameras, instruments, coins and card-storage accessories.

Each full **Sync cards & hide non-card imports** pass checks existing eBay-derived site products
against the active eBay listing category. It pauses an unrelated imported product in Hometown
Card Shop, but **does not end, delete or modify its eBay listing**. Manual and CSV products are
never affected. Listings without a valid eBay primary category are not newly imported or
automatically hidden; the dashboard reports these as "Unclassified" for review.

The first time after this release, run a **full** listing sync in the shopkeeper dashboard
to revisit every eBay page. Previously imported non-card products are only automatically
hidden once their eBay listing category has been confirmed; a few obviously unrelated
website imports were hidden directly. Do not manually delete other cards to re-run this.
Any legitimate trading card previously manually paused remains paused for safety until you
unpause it.


Every approved seller can use Hometown Card Shop's existing **manual products** and **CSV import** with no eBay account. eBay is optional and seller-specific. Marketplace checkout for outside dealers is **not** being enabled by this integration; Stripe Connect marketplace checkout is separate.

Connected eBay sellers can:

1. Authorize their own eBay account with the site using OAuth 2.0. Their refresh token is encrypted at rest with AES-256-GCM using `EBAY_TOKEN_ENCRYPTION_KEY`; it is never sent to the browser.
2. Import active eBay fixed-price listings in batches of 200; product identity is `seller_id + source='ebay' + itemId`. Import preserves manually curated fields and site price overrides where applicable.
3. Pull paid eBay orders using eBay's Fulfillment API and atomically apply each `orderId + lineItemId` once to matching store listings. Unknown listing IDs or website stock conflicts are flagged rather than guessed.
4. Opt into *two-way mode* after verifying the first import. A paid website sale creates an existing eBay outbox record. A follow-up job checks eBay's current available quantity and either decreases it by the exact sold amount or ends a fully sold-out legacy single-item listing. Discrepancies are **not** overwritten; they remain in Needs Review.

The founder's 3,000+ existing cards will **not** be deleted simply because eBay no longer returns an item in an active-list snapshot. Compare imported counts carefully, since some site cards may be independent inventory or previously imported in bulk. eBay listing migrations between legacy Trading and Inventory API require explicit API verification; any failed legacy revision is flagged for review rather than forcing a destructive update.

## eBay Production keyset compliance — do this FIRST

If the Production keyset says **Non Compliant** or **Your keyset is currently disabled**, eBay requires account deletion/closure notifications before it will activate your App ID. Because Hometown Card Shop stores linked seller data and inventory, the **not persisting eBay data** exemption does not apply.

On eBay Developers > Application Keys > Production > **Alerts & Notifications** > Marketplace Account Deletion:

1. Enter an alert email and save it.
2. Choose **Edit** under Marketplace Account Deletion notification endpoint.
3. Enter the exact URL **https://www.hometowncardshop.com/api/ebay/marketplace-account-deletion**.
4. Enter the exact value of Vercel Production **EBAY_DELETION_VERIFICATION_TOKEN** (32-80 chars, only letters, digits, underscores, hyphens).
5. Save. eBay will call that URL with `?challenge_code=` and the site returns the required SHA-256 response.
6. Use eBay's **Send Test Notification**, and verify the subscription is active / keyset becomes compliant before connecting OAuth.

When an eBay account deletion request is received, the site validates eBay's official `X-EBAY-SIGNATURE` using eBay's notification public-key API before removing any data. It removes stored refresh tokens and seller-account linkage and pauses eBay-linked products. Only legitimate Stripe orders needed for legal financial retention remain; the app does not import eBay buyer contact information.

Official docs: https://developer.ebay.com/develop/guides/sell/marketplace-user-account-deletion

## Production app setup — mandatory before linking

In the eBay Developers Program, obtain the **Production** (not Sandbox) application:

- **App ID / Client ID:** `EBAY_CLIENT_ID`
- **Cert ID / Client Secret:** `EBAY_CLIENT_SECRET`
- **RuName / Redirect URI name:** `EBAY_RUNAME` (it is **not** the HTTPS callback URL)
- Under the OAuth-enabled RuName settings, configure the Accepted Auth URL as:
  `https://www.hometowncardshop.com/api/portal/ebay/callback`
- Request eBay consent scopes `api_scope`, `sell.inventory`, `sell.fulfillment` (the Trading API uses `api_scope`).

Set these Vercel **Production environment variables** under the `hometowncardshop` project:

```text
EBAY_CLIENT_ID=<Production App ID>
EBAY_CLIENT_SECRET=<Production Cert ID>
EBAY_RUNAME=<Production RuName>
EBAY_TOKEN_ENCRYPTION_KEY=<random 32 bytes encoded as 64 hex characters or base64>
EBAY_SYNC_SECRET=<long random independent sync bearer secret>
```

Do not put these in `NEXT_PUBLIC_` keys, GitHub commits, or customer-visible UI. Generate an encryption key locally with `openssl rand -hex 32`. Keep a secure backup: changing it makes existing encrypted refresh tokens unreadable, requiring each seller to reconnect.

Redeploy Vercel after setting the environment variables.

## Seller setup

1. Sign in to `/admin/dashboard` as the approved seller owner. Open **eBay sync (optional)**.
2. Choose **Connect my eBay seller account**, log in to eBay and approve the requested OAuth scopes.
3. Click **Sync eBay listings and sales now**. The dashboard repeats small pages until the import is complete. Leave **import-only** on initially, verify several cards, prices, images, quantities and the total active eBay listings.
4. Only after confirming identity/stock, enable **two-way sales updates**. The backend uses safe quantity comparisons to avoid overwriting outside changes. A problematic eBay revision stays in the review queue.

## Automatic refresh every 15 minutes

A GitHub Actions scheduled workflow has been installed at `.github/workflows/ebay-sync.yml`. To activate it:

1. Create a GitHub Actions repository secret **`HCS_EBAY_SYNC_SECRET`** with exactly the same value as Vercel's server-only `EBAY_SYNC_SECRET`.
2. Enable GitHub Actions schedules for the repository. It polls `https://www.hometowncardshop.com/api/ebay-sync` every ~15 minutes (GitHub schedule is best effort, not real-time).
3. Cron works only for connected sellers and only after OAuth credentials and sync secret exist. A manual dashboard Sync Now is always available.

The sync is **eventual consistency**, not an instantaneous inventory lock across eBay and the website. Two shoppers can buy the last unit on separate channels during a polling gap. The DB detects a subset of conflicts and pauses affected products for review. Do not treat this as a zero-oversell guarantee. Faster eBay Notifications API events and Webhooks can be added if needed, subject to permissions.

## Notes for developer maintenance

- eBay Trading calls GetMyeBaySelling/GetItem/ReviseInventoryStatus/EndFixedPriceItem are used for legacy listings, and eBay Fulfillment API for paid orders.
- eBay Inventory API-managed listings may reject Trading revisions. Preserve outbox entries with `needs_review` until Inventory API handling and SKU mappings are added.
- OAuth username comes from eBay GetUser; no credentials are shared between unrelated seller records. Accounts can disconnect without deleting their local inventory.
- No listing is automatically published **to eBay** from a website-only merchant account. Website-only new cards stay on the website; publishing to eBay would require full eBay listing policies, category specifics, images and per-seller account verification.
- OAuth and sync handlers require the same site owner cookie / auth as the admin dashboard. Scheduled imports require a separate bearer secret.
- The on-site fulfillment process continues to handle website orders through Stripe webhooks; eBay marketplace orders are processed on eBay and their inventory changes are reflected on the site.

eBay API docs:
- https://developer.ebay.com/develop/guides/sell/authorization
- https://developer.ebay.com/develop/api/sell/fulfillment_api/order/getOrders
- https://developer.ebay.com/Devzone/XML/docs/Reference/eBay/GetMyeBaySelling.html
- https://developer.ebay.com/Devzone/XML/docs/Reference/eBay/ReviseInventoryStatus.html
- https://developer.ebay.com/Devzone/XML/docs/Reference/eBay/EndFixedPriceItem.html
