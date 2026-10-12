# Hometown Card Shop: Owner Setup & Email Routing

## Cost checkpoint
The currently connected Supabase organization "Find A Place Booking" is Pro.
The Supabase cost estimator reports **$10/month** for another project. Owner
approval is required before provisioning it. Don't apply any migrations to the
Find A Place Booking or Arkansas Land Pros databases.

## Provisioning order
1. Create the dedicated Hometown Card Shop Supabase project after price approval.
2. Apply `supabase/schema.sql` then `supabase/marketplace-operations.sql`.
3. In Supabase Authentication > Users, **invite** `altifygenerator@gmail.com`.
   The account owner must accept the invite and set their own password;
   do not put passwords or invite links in source control.
4. After email confirmation, apply `supabase/bootstrap-founder.sql`.
   It grants that verified Auth user BOTH seller-owner and platform-owner roles.
5. Disable public seller sign-ups in the application. Restrict Auth settings
   as necessary, and enforce MFA for the founder once provisioned.
6. Configure required Vercel variables listed in `.env.example`.
7. Deploy, then test login, logout, access denial for non-member accounts, and
   unauthorized seller scopes BEFORE enabling inventory writes.
8. Import and verify eBay inventory. Direct checkout MUST remain disabled
   until stock, shipping, order webhooks, payment reconciliation, and eBay
   writeback tests pass.

## Cloudflare Turnstile
1. Cloudflare dashboard > Turnstile > Add widget.
2. Add both the final store hostname and current Vercel preview hostname.
3. Copy the SITE KEY into `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
4. Copy the SECRET KEY into `TURNSTILE_SECRET_KEY` (Vercel encrypted).
5. Login requires a server-verified, single-use token with action
   `admin-login` and matching hostname. Without keys, login is BLOCKED.
6. Never publish the secret, bypass security verification in production, or
   let frontend code decide authentication.

## Shop email routing
- Founder login: `SHOP_ADMIN_EMAIL=altifygenerator@gmail.com`.
- Private alerts: `STORE_ALERT_EMAIL=altifygenerator@gmail.com`.
- Visible contact link: `STORE_CONTACT_EMAIL=altifygenerator@gmail.com`
  (footer currently links directly to this address).
- Configured sender: `Hometown Card Shop <orders@hometownwebservicesar.cc>`.
  This requires `hometownwebservicesar.cc` to be verified in Resend.
- Reply-to: `altifygenerator@gmail.com` via `RESEND_REPLY_TO_EMAIL`.
- To actually send automated order or support emails, verify the sender domain
  in Resend and configure `RESEND_API_KEY`.
  The central alert helper is implemented but NOT yet connected to order events.
- Email forwarding from a branded `@yourdomain` inbox requires separate
  domain/DNS routing; changing app variables alone cannot do email forwarding.

## Stripe and future Connect
First-party sales use the shop's primary Stripe account.
Outside sellers will require restricted Connect onboarding and an
explicitly implemented settlement model. Keep `SELLER_SIGNUPS_ENABLED=false`
until seller payments, tax, refunds, holds and disputes are tested.

## New Supabase API keys (October 2026)
- Supabase Project URL: `https://wqzidxudbwornpwgnsbj.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_URL` is the same project API URL, **not** the card shop website URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the new `sb_publishable_...` key.
- `SUPABASE_SECRET_KEY` is the new `sb_secret_...` key; set it as a **Sensitive** or encrypted Vercel variable.
- The server uses only `apikey` for new secret keys. Never place a secret into `NEXT_PUBLIC_...` variables or `Authorization: Bearer`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are supported legacy fallbacks; do not put any private value into the anon key.
- Database API keys do not provision a founder Auth user: the invitation and verified-email owner bootstrap still apply.

## Stripe integration foundation (October 2026)
- Founder payments charge the MAIN Hometown Card Shop Stripe account, not Connect.
- Server: `STRIPE_SECRET_KEY` and webhook signing `STRIPE_WEBHOOK_SECRET`.
- Set `STRIPE_AUTOMATIC_TAX=true` only after registering and enabling tax collection in Stripe.
- `STRIPE_CHECKOUT_ENABLED`, `NEXT_PUBLIC_CHECKOUT_ENABLED`, and `NEXT_PUBLIC_STORE_LIVE` stay **false** pending owner-controlled launch.
- Database switch `marketplace_settings.checkout_enabled` stays **false** separately.
- New webhook endpoint: `https://www.hometowncardshop.com/api/stripe/webhook` (only after DNS points to Vercel), or the working Vercel hostname beforehand.
- Listen to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`.
- Apply `supabase/stripe-checkout.sql` prior to deployment (already applied to dedicated project).
- Founder must define shipping_profiles and stock the bonus_card_pools; reward_policies.is_active must be true when packing stock is ready.
- eBay API reconciliation is still one-way and NOT configured; the database will reject direct checkout without a recent successful authorized eBay sync.
- Test/verify secure webhook fulfillment, refunds, payments, accounting and inventory reconciliation before accepting charges. Live keys are not needed for the preview.
- Future multi-seller payments use Stripe Connect; do NOT add transfers to founder-owned Stripe sessions.

- Stripe merchant identity is pinned to `acct_1UPWHsDy1ZySXGQN` via `STRIPE_EXPECTED_ACCOUNT_ID`; checkout refuses an API key belonging to any other Stripe account.
- Live event destination `we_1UPWRYDy1ZySXGQNMy9v6Ivt` is configured for https://hometowncardshop.vercel.app/api/stripe/webhook and `STRIPE_WEBHOOK_SECRET` has been saved in Vercel Production.
- Do not create a second webhook destination. No real charges were made.

## Seller membership monetization
- Default approved outside seller: 2% platform commission on merchandise subtotal only (exclude shipping and sales tax).
- Starter Member: $5.99/month, Stripe Billing price `price_1UPWydDy1ZySXGQNAUMz6MQh`, 0% marketplace sales commission while subscription is active and paid through its current period end.
- Founding Hometown Card Shop seller: permanent 0% house exemption; no subscription.
- Pricing policies and fee snapshots: `supabase/seller-pricing.sql`; seller billing ownership binding: `supabase/seller-billing-customers.sql` (applied).
- Membership lifecycle via verified `customer.subscription.created/updated/deleted` webhooks, not a client-submitted paid flag.
- Seller records cannot be cross-connected to another Stripe billing customer ID.
- Signup flag `SELLER_MEMBERSHIP_SIGNUPS_ENABLED=false` and Stripe Billing automatic-tax readiness `STRIPE_MEMBERSHIP_TAX_READY=false` until Connect, terms and tax setup complete.
- Use seller-specific Billing portal sessions for cancellation/payment method changes when enabled.
- Seller plan affects NEW order fee snapshots. Past sales are not repriced after cancellation.
- Stripe processing fees and Billing fees are additional; 2% of $299.50 equals $5.99 before payment fees.

## Connect event infrastructure (future dealer expansion)
- Dedicated signed Stripe connected-account webhook: `/api/stripe/connect/webhook`.
- Separate `STRIPE_CONNECT_WEBHOOK_SECRET` (NEVER reuse the main checkout webhook secret).
- Connected account event records and onboarding capability status persisted through the private `hcs_record_connect_event` SQL RPC.
- Events monitored: `account.updated`, `account.application.deauthorized`, `charge.dispute.created`, `charge.refunded`, `payout.failed`.
- Disputes and refunds are LOGGED for review, not automatically processed or paid out; this requires full financial reconciliation before onboarding other sellers.
- No seller Connect account is created automatically from an interest submission.
- `STRIPE_CONNECT_ONBOARDING_ENABLED=false` keeps onboarding disabled until payout liability, tax, support and refunds are implemented.

## Dealer interest / onboarding
- `/sell` accepts protected interest submissions, writes private `seller_interest_leads` records and emails `STORE_ALERT_EMAIL` through Resend.
- Owner-only `/api/portal/dealer-interest` and Dealer interest dashboard show the latest inquiries.
- An inquiry creates NO seller account, subscription, Connect account, or charge.
- `/api/portal/connect` GET/POST supports Stripe Express creation and account links ONLY for already-approved outside seller owners and only when `STRIPE_CONNECT_ONBOARDING_ENABLED=true`, `SELLER_SIGNUPS_ENABLED=true` and DB `seller_signup_enabled=true`.
- Separate classic Connect webhooks recorded in `connect_webhook_events`; disputed charges, returns and payouts still require detailed financial handling before anyone sells.
- Stripe Connect webhook secret must be set in `STRIPE_CONNECT_WEBHOOK_SECRET`; never share with the main payment webhook.

## Cheapest practical labels without paying for a shipping SaaS
- Low-value flexible eligible mail: USPS letter postage (no USPS Tracking). It is NOT eBay Standard Envelope; that service is limited to eBay transactions.
- Tracked parcels: compare USPS Ground Advantage and UPS discounted labels (for example with free Pirate Ship); exact commercial postage depends on package and destination.
- High-value: tracked with extra insurance as needed. The buyer-visible rate comes from a selected seller-owned shipping template.
- Dealer portal: export `/api/portal/orders/shipping-export` CSV of PAID / PACKING orders with addresses, seller-specific parcel estimates, service and shipping charge.
- Label costs are not automatically purchased or tracked in the app; users must map CSV columns, confirm addresses/weights and paste carrier/tracking in the order dashboard.
- Seller-specific shipping templates are inactive pending real postage charges and packing weight checks.

## Real card listing and picture management (Oct 2026)
- Owner and dealer managers: Inventory → card photo, title, or "Edit / photos" → `/admin/listings/{product-uuid}`. Seller ownership is verified on every request.
- Create a direct listing via "Add card directly to shop" → `/admin/listings/new`; this uses `source='manual'`, no eBay connection, and stays hidden from shoppers until reviewed.
- Photos: Supabase Storage public bucket `card-listing-photos`; upload authorization is server-only through existing verified Supabase Auth cookies and strict seller scoping. JPG, PNG, WebP only, max 7 MB, up to 10 image slots (front/back + eight extras).
- Uploaded front/back photos are held in `products.manual_image_url` and `products.manual_back_image_url`; seller images table records storage keys; atomic SQL RPCs commit the pointer updates. eBay images remain as fallback.
- Photo gallery on `/cards/{listing}`: thumbnails and accessible full-screen view. New images may take ~90 seconds to propagate through the catalog cache.
- eBay sync preserves manual listing field overrides (`listing_overrides`) and does NOT overwrite seller-uploaded photo fields; eBay product quantity remains controlled by eBay.
- Images are stored in Supabase and count toward Supabase storage/egress quotas. There is no paid image enhancement service.
- Photo-review flags for missing images must be cleared by a shopkeeper after checking the uploaded front picture.
- AI assistance is OFF by default. To enable, add server-only `OPENAI_API_KEY` and set BOTH `AI_CARD_IDENTIFICATION_ENABLED=true` and `NEXT_PUBLIC_AI_CARD_TOOLS_ENABLED=true` in Vercel, then redeploy. This is an optional paid OpenAI API usage, not included in ChatGPT.
- AI sends the card's selected public front picture to the model, returns proposed identification fields, confidence and sold-comp search terms, stores an audit record, and caps use at 20 per shop/day. It never auto-publishes, authenticates autographs, grades a card, or invents/sets a market price.
- Accurate AI-assisted pricing later requires actual recent SOLD transaction comparables matched on year, set, variant, condition, card number, grade and shipping; eBay seller OAuth alone does not automatically provide comprehensive sold-price access.
