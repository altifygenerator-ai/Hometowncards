-- Hometown Card Shop marketplace-ready schema (v2)
-- Use a NEW, dedicated Supabase project. Never run against an unrelated production database.
-- One founding seller now; later vendors share these same tables WITHOUT a data migration.
-- This schema has NO customer payment activation or public writes.
create extension if not exists pgcrypto;

create table if not exists public.sellers (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 display_name text not null,
 status text not null default 'pending' check(status in ('pending','approved','suspended','closed')),
 bio text not null default '',
 contact_email text,
 logo_url text,
 region text,
 approval_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.seller_members (
 seller_id uuid not null references public.sellers(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','manager','staff')),
 created_at timestamptz not null default now(),
 primary key(seller_id,user_id)
);
-- Secret connection metadata only; eBay OAuth secrets must be kept in a server-only secret store.
create table if not exists public.seller_integrations (
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references public.sellers(id) on delete cascade,
 provider text not null check(provider in ('ebay','other')),
 external_account_id text,
 status text not null default 'disconnected' check(status in ('disconnected','connected','error','disabled')),
 last_successful_sync timestamptz,
 last_error text,
 configuration jsonb not null default '{}'::jsonb,
 unique(seller_id,provider)
);
create table if not exists public.seller_payout_accounts (
 seller_id uuid primary key references public.sellers(id) on delete cascade,
 provider text not null default 'stripe_connect',
 provider_account_id text unique,
 onboarding_status text not null default 'not_started' check(onboarding_status in ('not_started','pending','restricted','active')),
 charges_enabled boolean not null default false,
 payouts_enabled boolean not null default false,
 updated_at timestamptz not null default now()
);

create table if not exists public.categories (
 slug text primary key,
 display_name text not null,
 parent_slug text references public.categories(slug),
 sort_order integer not null default 0,
 active boolean not null default false,
 created_at timestamptz not null default now()
);

create table if not exists public.products (
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references public.sellers(id),
 source text not null default 'manual' check(source in ('ebay','manual','csv')),
 source_item_id text not null default gen_random_uuid()::text,
 sku text not null,
 title text not null,
 description text not null default '',
 price_cents integer not null check(price_cents>=0),
 stock integer not null default 0 check(stock>=0),
 status text not null default 'draft' check(status in ('draft','published','paused','sold_out','archived')),
 sport text not null default 'Other Cards',
 team text not null default '',
 player text not null default '',
 card_year text not null default '',
 card_set text not null default '',
 card_number text not null default '',
 category text not null default '',
 condition text not null default '',
 image_url text,
 back_image_url text,
 ebay_url text,
 needs_review boolean not null default false,
 last_source_sync timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(seller_id,source,source_item_id)
);
create index if not exists products_seller_status_idx on public.products(seller_id,status);
create index if not exists products_sport_team_idx on public.products(sport,team);
create index if not exists products_title_search_idx on public.products using gin(to_tsvector('english',title));
create index if not exists products_source_lookup_idx on public.products(seller_id,source,source_item_id);

create table if not exists public.product_categories (
 product_id uuid not null references public.products(id) on delete cascade,
 category_slug text not null references public.categories(slug),
 primary key(product_id,category_slug)
);

-- Order owns the buyer/payment; seller_orders divide one checkout into shipments/settlement.
create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 stripe_session_id text unique,
 stripe_payment_intent_id text unique,
 status text not null default 'pending' check(status in ('pending','held','paid','cancelled','partially_refunded','refunded','fulfilled','needs_review')),
 subtotal_cents integer not null check(subtotal_cents>=0),
 shipping_cents integer not null default 0 check(shipping_cents>=0),
 tax_cents integer not null default 0 check(tax_cents>=0),
 total_cents integer not null check(total_cents>=0),
 currency text not null default 'usd' check(currency='usd'),
 customer_email text,
 shipping_name text,
 shipping_address jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.seller_orders (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 seller_id uuid not null references public.sellers(id),
 subtotal_cents integer not null check(subtotal_cents>=0),
 shipping_cents integer not null default 0 check(shipping_cents>=0),
 platform_fee_cents integer not null default 0 check(platform_fee_cents>=0),
 status text not null default 'pending' check(status in ('pending','paid','packing','shipped','delivered','cancelled','refunded','needs_review')),
 tracking_number text,
 carrier text,
 shipped_at timestamptz,
 created_at timestamptz not null default now(),
 unique(order_id,seller_id),
 unique(id,seller_id)
);
create table if not exists public.order_lines (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 seller_order_id uuid not null,
 seller_id uuid not null references public.sellers(id),
 product_id uuid not null references public.products(id),
 product_title_snapshot text not null,
 sku_snapshot text not null,
 quantity integer not null check(quantity>0),
 unit_price_cents integer not null check(unit_price_cents>=0),
 foreign key(seller_order_id,seller_id) references public.seller_orders(id,seller_id),
 unique(order_id,product_id)
);
create index if not exists order_lines_seller_idx on public.order_lines(seller_id,order_id);
create table if not exists public.inventory_reservations (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid not null references public.products(id),
 quantity integer not null check(quantity>0),
 state text not null default 'held' check(state in ('held','consumed','expired','cancelled')),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 unique(order_id,product_id)
);
create index if not exists reservations_held_idx on public.inventory_reservations(product_id,expires_at) where state='held';

-- Rewards are funded BY THE SHOP, not by future outside sellers. Never base rewards on chance.
create table if not exists public.reward_policies (
 id text primary key,
 funding_seller_id uuid not null references public.sellers(id),
 is_active boolean not null default false,
 label text not null,
 tiers jsonb not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.order_bonus_cards (
 order_id uuid primary key references public.orders(id) on delete cascade,
 reward_policy_id text not null references public.reward_policies(id),
 funding_seller_id uuid not null references public.sellers(id),
 free_card_count integer not null check(free_card_count between 0 and 1000),
 preferred_sport text,
 fulfillment_status text not null default 'pending' check(fulfillment_status in ('pending','packed','shipped','cancelled')),
 created_at timestamptz not null default now()
);
-- House-owned bulk card pool; seller inventory stays separate from bonus stock.
create table if not exists public.bonus_card_pools (
 id uuid primary key default gen_random_uuid(),
 funding_seller_id uuid not null references public.sellers(id),
 sport text not null,
 available_count integer not null default 0 check(available_count>=0),
 reserved_count integer not null default 0 check(reserved_count>=0),
 updated_at timestamptz not null default now(),
 unique(funding_seller_id,sport)
);
create table if not exists public.bonus_stock_movements (
 id uuid primary key default gen_random_uuid(),
 pool_id uuid not null references public.bonus_card_pools(id),
 order_id uuid references public.orders(id),
 delta integer not null check(delta<>0),
 reason text not null check(reason in ('add_bulk','bonus_order','return','recount')),
 created_at timestamptz not null default now()
);
-- Inventory outflows (seller sales, website sales, manual corrections, freebies) are auditable.
create table if not exists public.stock_movements (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id),
 seller_id uuid not null references public.sellers(id),
 delta integer not null check(delta<>0),
 reason text not null check(reason in ('ebay_sale','site_sale','reservation_release','recount','free_bonus','return','import')),
 reference_id text,
 created_at timestamptz not null default now()
);
create table if not exists public.sync_runs (
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references public.sellers(id),
 provider text not null,
 status text not null default 'running' check(status in ('running','success','failed','needs_review')),
 message text,
 imported_count integer default 0,
 deactivated_count integer default 0,
 started_at timestamptz not null default now(),
 finished_at timestamptz
);

-- Founding seller exists from day one. Later sellers can be approved through a gated flow.
insert into public.sellers(slug,display_name,status,bio,region,approval_at)
 values('hometown-card-shop','Hometown Card Shop','approved','A collector-run card shop with Arkansas roots.','Amity, Arkansas',now())
 on conflict(slug) do nothing;
insert into public.reward_policies(id,funding_seller_id,label,is_active,tiers)
 select 'hometown-bonus-cards-v1',id,'Free common cards with any merchandise purchase',false,
 '[{"minimum_cents":1,"cards":1},{"minimum_cents":1000,"cards":5},{"minimum_cents":2500,"cards":10},{"minimum_cents":5000,"cards":20}]'::jsonb
 from public.sellers where slug='hometown-card-shop' on conflict(id) do nothing;
-- The policy stays inactive until packing supplies and checkout are ready.

alter table public.sellers enable row level security;
alter table public.seller_members enable row level security;
alter table public.seller_integrations enable row level security;
alter table public.seller_payout_accounts enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.orders enable row level security;
alter table public.seller_orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.reward_policies enable row level security;
alter table public.order_bonus_cards enable row level security;
alter table public.stock_movements enable row level security;
alter table public.bonus_card_pools enable row level security;
alter table public.bonus_stock_movements enable row level security;
alter table public.sync_runs enable row level security;

-- Safe public READ policies only. Staff/owner writes and Stripe actions remain service-role-only
-- until account security, seller onboarding, dispute handling and Connect are implemented.
create policy "Read approved shops" on public.sellers for select to anon,authenticated using (status='approved');
create policy "Read published inventory" on public.products for select to anon,authenticated
 using (status='published' and stock>0 and needs_review=false and exists(select 1 from public.sellers s where s.id=seller_id and s.status='approved'));
create policy "Read category directory" on public.categories for select to anon,authenticated using (true);
create policy "Read public category mappings" on public.product_categories for select to anon,authenticated using (exists(select 1 from public.products p where p.id=product_id and p.status='published' and p.stock>0));
-- No public read/write access to financial, integration, customer, or seller member tables.
