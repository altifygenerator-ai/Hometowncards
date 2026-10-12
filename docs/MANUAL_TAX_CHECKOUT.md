# Hometown Card Shop — Arkansas taxes calculated by the site

## Founding seller checkout

The site calculates tax independently of Stripe Tax and requires no paid tax API key.

- Arkansans: use official Q4 2026 Streamlined Sales Tax rate and boundary data, sourced from Arkansas's published jurisdiction data at https://www.streamlinedsalestax.org/ratesandboundry/.
- Source CSV: https://www.streamlinedsalestax.org/ratesandboundry/Rates/ARR2026Q4AUG28.csv
- Boundary ZIP: https://www.streamlinedsalestax.org/ratesandboundry/Boundary/ARB2026Q4SEP17.zip
- ZIP+4 is used where needed to distinguish local tax boundaries. If a five-digit ZIP crosses multiple rates the checkout asks for the full nine-digit ZIP. The file contains the state, county, municipality and special district FIPS jurisdiction codes.
- The site calculates the tax on physical cards and taxable shipping. Shopping-cart tax quotes are estimates; payment checkout recomputes from reserved inventory and server-configured shipping rates.
- The checkout records the tax rate, origin, tax amount, delivery address and final amount in Supabase. Stripe Checkout sets `automatic_tax=false` and receives merchandise, shipping and local tax as separate line items. Verified webhooks settle only a matching total.
- For customers outside Arkansas, no other state sales tax is collected until the business has established registration/nexus and added that jurisdiction. Re-evaluate this policy with professional advice as sales grow.

## Data freshness

- `lib/server/arkansas-sst.ts` uses the **official 2026 Q4** file pair, validates the 6.5% Arkansas base rate, file structure and effective date, and caches results for 20 hours.
- On 2027-01-01, quotes intentionally stop until the quarter's source filenames and files have been updated and tested. No outdated rate is silently used.
- Check current Arkansas files at https://www.streamlinedsalestax.org/ratesandboundry/Rates/ and https://www.streamlinedsalestax.org/ratesandboundry/Boundary/ before each quarter change. File naming is not guessed.
- The GitHub Actions verifier fetches the official files and tests that they have the expected format. It must be green before activating payments.
- This is ZIP/ZIP+4 **jurisdiction boundary data**, not street-level address validation or USPS deliverability verification; do not claim USPS address verification.

## Real-payment launch checklist

1. Obtain the relevant **Arkansas sales tax permit** from Arkansas DFA. Rate calculation does not substitute for sales-tax registration. Keep `ARKANSAS_SALES_TAX_REGISTERED` unset/false until the permit exists. https://atap.arkansas.gov/
2. Verify the rate for actual example ZIP+4 delivery addresses against Arkansas DFA's lookup: https://www.dfa.arkansas.gov/office/taxes/excise-tax-administration/sales-use-tax/streamlined-tax-lookup/
3. Confirm official source fetches, current quarter, backup provider behavior, availability, shipping price correctness, and required Turnstile/Supabase/Stripe webhook keys.
4. Test a purchase, canceled payment, expiration, refund, shipping-export address, stock reservation and eBay pending-delisting records.
5. Only then set Vercel `STRIPE_CHECKOUT_ENABLED=true`, `NEXT_PUBLIC_CHECKOUT_ENABLED=true`, `ARKANSAS_SALES_TAX_REGISTERED=true` (only if registration actually exists). Ensure `NEXT_PUBLIC_STORE_LIVE=true` and Supabase `marketplace_settings.checkout_enabled=true`, `marketplace_mode=false`.
6. While eBay remains disconnected, manually remove cards sold through either channel to avoid overselling. eBay sale outbox records pending sales but **does not end listings automatically** until verified eBay OAuth/writeback is implemented.

## Future sellers & Stripe Connect

- Seller-specific tax configuration lives in `seller_tax_profiles` and is editable by authorized seller managers through **Taxes & Connect**.
- Each seller can record states where it actually has sales-tax registration and declare its responsibilities. Connected sellers may request the `connect_stripe_tax` calculation mode once Stripe Connect charges are enabled, but this is **a configuration setting only**, not live Stripe Tax activation.
- **Stripe Connect handles payment routing; it does not by itself calculate, collect, remit, or file sales taxes.** Connected-account Stripe Tax requires actual registration and a tax-enabled checkout/payment route on the correct connected account.
- The platform's legal status as a marketplace facilitator and merchant of record must be assessed; a platform cannot automatically transfer all marketplace tax obligations to sellers through an agreement.
- Mixed-seller carts need separate seller shipment/tax snapshots and a verified Stripe Connect payment/settlement model. Marketplace checkout remains disabled until tests for all these functions pass.

## Source links

- Arkansas DFA Streamlined Tax Lookup: https://www.dfa.arkansas.gov/office/taxes/excise-tax-administration/sales-use-tax/streamlined-tax-lookup/
- SST downloadable file index: https://www.streamlinedsalestax.org/Shared-Pages/rate-and-boundary-files
- Arkansas Department of Finance & Administration: https://www.dfa.arkansas.gov/
