# Hometown Card Shop — simple state-base sales-tax checkout

## Founding shop

The site computes a **single statewide base rate** using the customer's two-letter delivery-state code. There are **no ZIP+4, city, county or district lookups**. A five-digit ZIP is still required for delivery, but does not affect the tax rate.

- Arkansas deliveries (AR): **6.5%** statewide rate regardless of city or ZIP.
- AK, DE, MT, NH and OR: **0% statewide** (Alaska cities can levy separate local taxes).
- All other states and DC: base rates in `lib/server/state-base-tax.ts` and `public.state_sales_tax_rates`.
- The shopping cart automatically shows cards, shipping, state tax and total whenever state or shipping choice changes. There's no tax button.
- Server checkout recalculates actual tax using the reserved product and shipping prices, not trusting the browser's tax preview.
- The saved order records the selected state/shipping address, rate, tax source `state-base-2026-07`, tax cents, and exact total. The Stripe session has `automatic_tax=false` and a separate fixed tax line. The signed webhook checks the total before marking an order paid.
- For continuity with the prior system, the taxable base is **merchandise + shipping** for every state. Shipping taxability actually varies by state; this is a simplified model, not a legally complete calculator.

## Rate source and maintenance

Statewide base rates as of July 1, 2026: https://taxfoundation.org/data/all/state/2026-sales-tax-rates-midyear/

They must be reviewed and updated when rates change. Some states have special rules and mandatory local add-ons (included in the published statewide base rate), gross receipts taxes, exemptions, and variable local rates **not represented here**.

## Registration and liability

Showing/charging a state tax rate is not proof of a permit or registration. A seller may need to collect different amounts, including local tax, or not collect tax at all in a particular state depending on actual nexus and registration. **Do not assume a blanket 50-state tax rate is automatically compliant or remittable.** Arkansas registration/remittance requirements remain relevant to the founder. https://atap.arkansas.gov/

## Payment and eBay reconciliation

Hometown Card Shop payment switches (Vercel `NEXT_PUBLIC_CHECKOUT_ENABLED`, `STRIPE_CHECKOUT_ENABLED`, `NEXT_PUBLIC_STORE_LIVE`, and Supabase `marketplace_settings.checkout_enabled`) are managed independently of the rate table. Seller marketplace mode stays off unless the full Connect funds flow and tax responsibilities have been verified. Manual eBay listing reconciliation remains required until eBay OAuth and delisting writeback are connected.

## Other sellers

The `seller_tax_profiles` table and seller dashboard tax preferences remain separate. Stripe Connect by itself does **not** calculate, register, collect, remit, or file seller sales taxes. Marketplace checkout for outside sellers is not enabled by this change.
