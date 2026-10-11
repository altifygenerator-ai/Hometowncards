-- Apply AFTER schema.sql to a dedicated Hometown Card Shop project.
-- Do not install on a database hosting another business.
-- Founder seller is first-class for inventory/orders, separate from platform finance.

create table if not exists public.platform_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','support')),
  created_at timestamptz not null default now()
);
create table if not exists public.marketplace_settings (
  id boolean primary key default true check (id=true),
  seller_applications_open boolean not null default false,
  seller_signup_enabled boolean not null default false,
  marketplace_mode boolean not null default false,
  checkout_enabled boolean not null default false,
  default_platform_fee_bps integer not null default 0 check(default_platform_fee_bps between 0 and 3000),
  updated_at timestamptz not null default now()
);
insert into public.marketplace_settings(id) values(true) on conflict do nothing;

alter table public.sellers add column if not exists is_founding_seller boolean not null default false;
alter table public.sellers add column if not exists public_email text;
alter table public.sellers add column if not exists customer_service_policy text not null default '';
alter table public.sellers add column if not exists returns_policy text not null default '';
alter table public.sellers add column if not exists handling_days integer not null default 3 check (handling_days between 0 and 30);
update public.sellers set is_founding_seller=true where slug='hometown-card-shop';

alter table public.products add column if not exists price_override_cents integer check(price_override_cents is null or price_override_cents>=0);
alter table public.products add column if not exists manual_paused boolean not null default false;
alter table public.products add column if not exists cost_cents integer check(cost_cents is null or cost_cents>=0);
alter table public.products add column if not exists inventory_location text not null default '';
alter table public.products add column if not exists weight_oz numeric(8,3) check(weight_oz is null or weight_oz>0);
alter table public.products add column if not exists shipping_profile_id uuid;
alter table public.products add column if not exists seller_notes text not null default '';
alter table public.products add column if not exists last_edited_by uuid references auth.users(id);
create index if not exists products_review_idx on public.products(seller_id,needs_review,manual_paused);

-- All estimates are SELLER-OWNED; no implied USPS or carrier rates.
-- Each profile applies to one shipment from one seller. Free gift weight must be included.
create table if not exists public.shipping_profiles (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete cascade,
  name text not null,
  service_label text not null default 'Standard shipping',
  active boolean not null default true,
  base_cents integer not null check(base_cents>=0),
  additional_item_cents integer not null default 0 check(additional_item_cents>=0),
  max_weight_oz numeric(8,3) not null check(max_weight_oz>0),
  max_items integer not null default 100 check(max_items>0),
  packaging_weight_oz numeric(8,3) not null default 0.6 check(packaging_weight_oz>=0),
  default_item_weight_oz numeric(8,3) not null default 0.15 check(default_item_weight_oz>0),
  allows_bonus_cards boolean not null default true,
  free_shipping_threshold_cents integer check(free_shipping_threshold_cents is null or free_shipping_threshold_cents>=0),
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(seller_id,name),
  unique(id,seller_id)
);
alter table public.products add constraint products_shipping_profile_seller_fk foreign key(shipping_profile_id,seller_id) references public.shipping_profiles(id,seller_id);
-- This is a rate TEMPLATE, not a claim that actual carrier postage is $0.
-- No initial shipping profiles are inserted: founding seller chooses rates after weighing sample packages.

create table if not exists public.shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  seller_id uuid not null references public.sellers(id),
  shipping_profile_id uuid references public.shipping_profiles(id),
  quantity integer not null check(quantity>0),
  gift_cards integer not null default 0 check(gift_cards>=0),
  estimated_weight_oz numeric(9,3) not null check(estimated_weight_oz>0),
  charged_cents integer not null check(charged_cents>=0),
  service_label_snapshot text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.bulk_jobs (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id),
  actor_user_id uuid references auth.users(id),
  operation text not null check(operation in ('csv_import','bulk_edit','export','recount')),
  status text not null check(status in ('completed','failed','rejected')),
  rows_received integer not null default 0,
  rows_changed integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now()
);
create index if not exists bulk_jobs_seller_idx on public.bulk_jobs(seller_id,created_at desc);
create table if not exists public.inventory_audit (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id),
  product_id uuid references public.products(id) on delete set null,
  actor_user_id uuid references auth.users(id),
  action text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);
create index if not exists inventory_audit_seller_idx on public.inventory_audit(seller_id,created_at desc);
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  seller_order_id uuid not null references public.seller_orders(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
-- Separate marketplace fee/payment split ledger; do not calculate money owed from live seller settings.
create table if not exists public.seller_settlements (
  id uuid primary key default gen_random_uuid(),
  seller_order_id uuid not null unique references public.seller_orders(id),
  seller_id uuid not null references public.sellers(id),
  funding_model text not null check(funding_model in ('platform_owned','connect_transfer','connect_direct_charge')),
  gross_cents integer not null check(gross_cents>=0),
  platform_fee_cents integer not null default 0 check(platform_fee_cents>=0),
  refund_cents integer not null default 0 check(refund_cents>=0),
  transfer_cents integer not null default 0 check(transfer_cents>=0),
  stripe_transfer_id text unique,
  status text not null default 'pending' check(status in ('pending','available','paid','reversed','on_hold')),
  created_at timestamptz not null default now()
);
-- Future seller applications are PRIVATE and manually approved. No public insert policy.
create table if not exists public.seller_applications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id),
 shop_name text not null,
 contact_email text not null,
 status text not null default 'received' check(status in ('received','review','approved','declined')),
 created_at timestamptz not null default now()
);

alter table public.platform_staff enable row level security;
alter table public.marketplace_settings enable row level security;
alter table public.shipping_profiles enable row level security;
alter table public.shipping_quotes enable row level security;
alter table public.bulk_jobs enable row level security;
alter table public.inventory_audit enable row level security;
alter table public.order_events enable row level security;
alter table public.seller_settlements enable row level security;
alter table public.seller_applications enable row level security;
-- Access to private tables is service-role only, after server-side token + seller membership checks.
-- Visitor read access to profiles only; the policies never expose seller financials.
create policy "Read active shipping options from approved sellers" on public.shipping_profiles
 for select to anon,authenticated using (active and exists(select 1 from public.sellers s where s.id=seller_id and s.status='approved'));

-- Existing public inventory RLS should also respect manual storefront pauses.
drop policy if exists "Read published inventory" on public.products;
create policy "Read published inventory" on public.products for select to anon,authenticated
 using(status='published' and stock>0 and needs_review=false and manual_paused=false and exists(select 1 from public.sellers s where s.id=seller_id and s.status='approved'));
-- Orders and stock reservations will get transactional RPCs before any checkout is enabled.

-- Atomic, seller-scoped bulk editor. Service-role-only; the Next.js API authenticates
-- the seller membership before passing these server-only arguments.
create or replace function public.portal_bulk_edit(
 p_seller_id uuid, p_actor uuid, p_ids uuid[], p_action text, p_value text default null
) returns integer language plpgsql security definer set search_path=public as $$
declare n integer; val numeric;
begin
 n := coalesce(array_length(p_ids,1),0);
 if n<1 or n>200 or n<> (select count(distinct v) from unnest(p_ids) v) then
  raise exception 'Select between 1 and 200 unique products.';
 end if;
 if n <> (select count(*) from public.products where seller_id=p_seller_id and id=any(p_ids)) then
  raise exception 'One or more products do not belong to the selected seller.';
 end if;
 if p_action not in ('price-set','price-adjust-percent','price-adjust-dollars','price-clear','pause','unpause','stock-set','sport','team','location','weight','review-complete') then
  raise exception 'Unsupported bulk action.';
 end if;
 if p_action in ('price-set','price-adjust-percent','price-adjust-dollars','stock-set','weight') then
  begin val := trim(p_value)::numeric; exception when others then raise exception 'Invalid numeric value.'; end;
  if val is null or val <> val then raise exception 'Invalid numeric value.'; end if;
 end if;
 if p_action='stock-set' and exists(select 1 from public.products where seller_id=p_seller_id and id=any(p_ids) and source='ebay') then
  raise exception 'eBay quantities cannot be manually overwritten here.';
 end if;
 if p_action='stock-set' and (val<0 or val>100000 or val<>trunc(val)) then raise exception 'Invalid stock quantity.';end if;
 if p_action='weight' and (val<=0 or val>500) then raise exception 'Invalid weight.';end if;
 if p_action='price-set' and (val<0.01 or val>100000) then raise exception 'Invalid price.';end if;
 if p_action='price-adjust-percent' and (val<-99 or val>100000) then raise exception 'Invalid percent.';end if;
 if p_action='price-adjust-dollars' and (val< -100000 or val>100000) then raise exception 'Invalid adjustment.';end if;
 if p_action in ('price-set','price-adjust-percent','price-adjust-dollars') and exists (
 select 1 from public.products where seller_id=p_seller_id and id=any(p_ids) and (
 case p_action
 when 'price-set' then round(val*100)
 when 'price-adjust-percent' then round(coalesce(price_override_cents,price_cents)*(1+val/100))
 else coalesce(price_override_cents,price_cents)+round(val*100)
 end < 1 or case p_action
 when 'price-set' then round(val*100)
 when 'price-adjust-percent' then round(coalesce(price_override_cents,price_cents)*(1+val/100))
 else coalesce(price_override_cents,price_cents)+round(val*100)
 end >100000000
 )) then raise exception 'The change would result in an invalid product price.';end if;
 insert into public.inventory_audit(seller_id,product_id,actor_user_id,action,before_value,after_value)
 select p_seller_id,id,p_actor,p_action,
 jsonb_build_object('price_cents',price_cents,'price_override_cents',price_override_cents,'stock',stock,'status',status,'manual_paused',manual_paused,'sport',sport,'team',team,'inventory_location',inventory_location,'weight_oz',weight_oz),
 jsonb_build_object('action',p_action,'value',p_value)
 from public.products where seller_id=p_seller_id and id=any(p_ids);
 update public.products p set
 price_override_cents=case p_action
  when 'price-set' then round(val*100)::integer
  when 'price-adjust-percent' then round(coalesce(p.price_override_cents,p.price_cents)*(1+val/100))::integer
  when 'price-adjust-dollars' then (coalesce(p.price_override_cents,p.price_cents)+round(val*100))::integer
  when 'price-clear' then null
  else p.price_override_cents end,
 manual_paused=case p_action when 'pause' then true when 'unpause' then false else p.manual_paused end,
 stock=case when p_action='stock-set' then val::integer else p.stock end,
 status=case when p_action='stock-set' then (case when val>0 then 'published' else 'sold_out' end) else p.status end,
 sport=case when p_action='sport' then left(coalesce(nullif(trim(p_value),''),'Other Cards'),60) else p.sport end,
 team=case when p_action='team' then left(coalesce(trim(p_value),''),100) else p.team end,
 inventory_location=case when p_action='location' then left(coalesce(trim(p_value),''),100) else p.inventory_location end,
 weight_oz=case when p_action='weight' then val else p.weight_oz end,
 needs_review=case when p_action='review-complete' then false else p.needs_review end,
 last_edited_by=p_actor,updated_at=now()
 where seller_id=p_seller_id and id=any(p_ids);
 insert into public.bulk_jobs(seller_id,actor_user_id,operation,status,rows_received,rows_changed)
 values(p_seller_id,p_actor,'bulk_edit','completed',n,n);
 return n;
end;$$;
revoke execute on function public.portal_bulk_edit(uuid,uuid,uuid[],text,text) from public,anon,authenticated;
grant execute on function public.portal_bulk_edit(uuid,uuid,uuid[],text,text) to service_role;
