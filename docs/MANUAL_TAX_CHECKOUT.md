# Hometown Card Shop: address-based Arkansas tax at checkout

## Architecture

- The shopper enters a full U.S. delivery address and selects a shipping service on the cart page.
- `POST /api/tax/quote` gets the delivery-address rate from ZipTax v6 (`X-API-KEY`, server only), showing a **preview** of state, county and city tax.
- No price, shipping, or tax values supplied by the browser are trusted at payment time. `POST /api/checkout` reserves live stock at current server prices, recomputes tax using the reserved subtotal and shipping charge, and saves that amount together with the delivery address through `hcs_apply_manual_checkout_tax`.
- Stripe Checkout uses `automatic_tax=false`. Merchandise, shipping and Arkansas sales tax appear as separate line items. Stripe still processes the payment securely.
- Signed payment webhooks compare Stripe's amount paid with the exact database total and retain the delivery address collected on our site. Paid orders appear in the shopkeeper shipping export.

## Required before accepting Arkansas payments

1. **Register with Arkansas DFA** for a sales-tax permit. Being a physical Arkansas seller generally triggers registration even with low sales volume. Configuring a standalone tax calculation does not waive the legal obligation. Do not set the compliance flag without an actual registration.
2. Obtain a `ZIPTAX_API_KEY` from https://platform.zip.tax and store it **server-side only** in Vercel. The rate engine rejects undetermined addresses and API failures rather than charging a guessed flat rate. Validate representative ZIP+4, city-limit and unincorporated addresses against the Arkansas DFA official lookup before production.
3. Set Vercel production values `ARKANSAS_SALES_TAX_REGISTERED=true`, `NEXT_PUBLIC_STORE_LIVE=true`, `NEXT_PUBLIC_CHECKOUT_ENABLED=true`, `STRIPE_CHECKOUT_ENABLED=true` after legal and technical verification. Other existing secrets required: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_EXPECTED_ACCOUNT_ID`, `SUPABASE_SECRET_KEY`, Turnstile site+secret keys.
4. After a controlled test checkout, update the dedicated Supabase `public.marketplace_settings.checkout_enabled=true` with `marketplace_mode=false`; keep `manual_inventory_mode=true` until eBay OAuth and end-listing writeback is tested.
5. Verify test paid, expired, canceled and duplicate webhook paths, exact cents and tax on shipping, actual shipping label export, refunds, stock reservations, manual eBay removal queue and alerts.

## Important

- This is not Stripe Tax: nothing was added to the Stripe Tax registrations list.
- For addresses outside Arkansas, the current founder-only store assumes **no other state nexus / active registration**, and does not assess Arkansas tax. Review economic nexus in other states as sales increase; do not treat the zero-tax policy as universal.
- Arkansas shipping fees on ordinary taxable goods are part of the taxable base. Source: https://codeofarrules.arkansas.gov/Rules/Rule?chapterID=33&levelType=section&partID=971&sectionID=62999&subChapterID=241&subPartID=9367&titleID=26
- Rates depend on the **delivery address**, not just five-digit ZIP: https://www.dfa.arkansas.gov/office/taxes/excise-tax-administration/sales-use-tax/streamlined-tax-lookup/
- Do not enable paid checkout solely because a page builds. Keep production flags disabled until the rate provider and necessary tax registration are ready.
