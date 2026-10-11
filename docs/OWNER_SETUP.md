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
