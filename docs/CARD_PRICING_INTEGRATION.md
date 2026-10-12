# Hometown Card Shop — Card pricing integration handoff (October 2026)

## Current operational state
- Front/back photo management, manual listing creation, seller edit pages, and manual card approval are available.
- `/admin/listings/[id]` has a **Card pricing research** panel. `Prepare price research` creates a private seller-owned record only; it does not call paid APIs or change inventory.
- Up to 25 preparation requests per seller/day; duplicate open requests reused within 24 hours.
- Manual comparable records can be added to organize research. They are ALWAYS labeled `unverified` and are NEVER counted as confirmed sales.
- No provider adapter has been connected. No verified sold-price results have been ingested, no AI pricing request has been made, and no price has been automatically updated.

## Implemented private tables and access isolation
- `public.card_price_research`: card identity snapshot, requested-by user, request status, source summary, historical recommendation, confidence, low/high range, and algorithm version.
- `public.card_price_comparables`: source, receipt URL and ID, observation kind (sold vs guide/asking), transaction date, currency, grade, variant, match score, shipping exclusion, verification provenance and calculation-eligibility flag.
- Each record is dealer scoped, with foreign keys linking comparables to the matching research seller and research to that seller's own listing. RLS enabled. No public/anonymous access policies.
- Research queue/security RPCs: `hcs_prepare_card_price_research` (daily rate-limited) and `hcs_record_card_price_recommendation` (only accepts supported counted verified sales), granted service-role only.
- `inventory_audit` tracks price changes (when activation later occurs). Do not store third-party data API keys inside research rows or in the client.

## Implemented code paths
- `GET/POST /api/portal/products/[id]/pricing`: scoped research history, evidence, provider readiness; preparation of research record.
- `POST /api/portal/products/[id]/pricing/comparables`: optional hand-added unverified research references.
- `POST /api/portal/products/[id]/pricing/recalculate`: strict recomputation from already stored, verified receipts.
- `POST /api/portal/products/[id]/pricing/apply`: explicit dealer confirmation, current-price concurrency check, freshly recalculated evidence, 30-day staleness guard, audit; fail closed unless `CARD_PRICING_APPLY_ENABLED=true`. Modifies **website price override only**, never eBay.
- `lib/server/card-pricing.ts`: provider status and recent verified USD sold comparison algorithm; at least three recent highly matched confirmed sales, outlier filter, median/25th–75th percentiles and nearest-dollar suggested site price.
- `lib/server/card-pricing-providers.ts`: provider interface and disabled slots for eBay Marketplace Insights, SportsCardsPro, CollX, Cardmarket and OpenAI web research.
- `lib/server/card-pricing-ingest.ts`: server-only ingest with provider-host allowlist, transaction-completion evidence, source IDs, date/price/currency validation, and automatic recalculation; refuses unconnected providers.
- `lib/server/card-pricing-workflow.ts`: calculate a proposed price. It never writes a price onto a listing.

## Complete later, after provider/owner approvals
1. Obtain authorized provider data access and confirm licenses permit displaying/computing pricing in a marketplace.
2. Implement a real `PricingSourceAdapter` for each approved source. An eBay seller OAuth grant does **not** automatically grant Marketplace Insights sold-price data. Do not scrape restricted private research pages.
3. Normalize verified closed sales and match exact card year, set, number, variation, grading company/grade and condition. Never treat source-page search snippets, guide prices, unsold listings or self-reported manual references as verified completed transactions.
4. Wire the adapter's `fetchVerifiedObservations` result into `ingestLicensedCardPricingBatch`, with source provenance, provider receipts, request backoff, quota monitoring, retries, and data retention/licensing compliance.
5. Unit/integration-test incorrect variants, relists, refunds, bundled lots, slabs vs raw cards, fake sales, stale quotes, exotic currencies, shipping-inclusive figures, missing receipt IDs, outliers and concurrent admin edits.
6. Add approved keys as **server-only** Vercel secrets. Test with a few representative cards using non-production traffic before enabling `CARD_PRICING_LIVE_LOOKUPS_ENABLED`. Never expose keys through `NEXT_PUBLIC_...`.
7. Separately activate `CARD_PRICING_APPLY_ENABLED` only after reviewing price safety. Application must always require an owner/dealer click; never default to automatic repricing.
8. The existing optional OpenAI picture identification also requires `OPENAI_API_KEY`, `AI_CARD_IDENTIFICATION_ENABLED` and `NEXT_PUBLIC_AI_CARD_TOOLS_ENABLED`. Identification results are proposals, not proof of value.
9. Keep general store checkout and external seller signups independently disabled until their own release checks pass.

## Practical priorities
Focus paid price research first on potential high-value cards and variation candidates; most sub-$1 bulk commons do not justify expensive queries. Show evidence URLs, date, match confidence and seller confirmation before offering any suggested price.
