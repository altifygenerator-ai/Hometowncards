-- Hometown Card Shop seller monetization.
-- The founding shop never pays its own platform a commission or subscription.
-- Future seller enrollments are closed until Connect onboarding is production-ready.
create table if not exists public.seller_pricing_tiers (
  code text primary key,
  display_name text not null,
  monthly_fee_cents integer not null check(monthly_fee_cents>=0),
  sales_commission_bps integer not null check(sales_commission_bps between 0 and 3000),
  stripe_price_id text unique,
  active boolean not null default false,
  signup_open boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.seller_pricing_tiers(code,display_name,monthly_fee_cents,sales_commission_bps,active,signup_open)
values ('payg','Pay As You Sell',0,200,true,false)
on conflict(code) do update set display_name=excluded.display_name,monthly_fee_cents=excluded.monthly_fee_cents,sales_commission_bps=excluded.sales_commission_bps;
insert into public.seller_pricing_tiers(code,display_name,monthly_fee_cents,sales_commission_bps,stripe_price_id,active,signup_open)
values ('starter','Starter Member',599,0,'price_1UPWydDy1ZySXGQNAUMz6MQh',true,false)
on conflict(code) do update set display_name=excluded.display_name,monthly_fee_cents=excluded.monthly_fee_cents,
sales_commission_bps=excluded.sales_commission_bps,stripe_price_id=excluded.stripe_price_id;
alter table public.seller_pricing_tiers enable row level security;
-- Pricing is public information, no public writes.
create policy "View current seller pricing" on public.seller_pricing_tiers for select to anon,authenticated using(active);

create table if not exists public.seller_memberships (
 seller_id uuid primary key references public.sellers(id) on delete cascade,
 tier_code text not null references public.seller_pricing_tiers(code),
 stripe_customer_id text unique not null,
 stripe_subscription_id text unique not null,
 stripe_price_id text not null,
 status text not null check(status in ('incomplete','incomplete_expired','trialing','active','past_due','unpaid','canceled','paused')),
 current_period_end timestamptz,
 cancel_at_period_end boolean not null default false,
 last_stripe_event_created bigint not null default 0,
 last_stripe_event_id text,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
alter table public.seller_memberships enable row level security;
create index if not exists memberships_status_idx on public.seller_memberships(status,current_period_end);

alter table public.marketplace_settings alter column default_platform_fee_bps set default 200;
update public.marketplace_settings set default_platform_fee_bps=200,updated_at=now() where id=true;

alter table public.seller_orders add column if not exists applied_pricing_plan text not null default 'unassigned';
alter table public.seller_orders add column if not exists applied_fee_bps integer not null default 0 check(applied_fee_bps between 0 and 3000);
alter table public.seller_orders add column if not exists membership_subscription_id text;
alter table public.seller_orders add column if not exists fee_locked_at timestamptz;

-- Fee is computed in the database, with the locked subscription status at order creation.
-- No fee is charged on shipping or tax; no membership status recalculation after this point.
create or replace function public.hcs_set_seller_fee()
returns trigger language plpgsql security definer set search_path=public as $$
declare founder boolean; m record; bps integer;
begin
 select s.is_founding_seller into founder from public.sellers s where s.id=new.seller_id and s.status='approved';
 if founder is null then raise exception 'Seller is not approved'; end if;
 if founder then
  new.applied_pricing_plan:='founder';
  bps:=0;
 else
  new.applied_pricing_plan:='payg';
  select m2.stripe_subscription_id,m2.status,m2.current_period_end into m
    from public.seller_memberships m2
    join public.seller_pricing_tiers t on t.code=m2.tier_code
    where m2.seller_id=new.seller_id and t.active and t.monthly_fee_cents=599
      and t.sales_commission_bps=0 and t.code='starter'
      and m2.stripe_price_id=t.stripe_price_id
      and m2.status='active' and m2.current_period_end>now() for share of m2;
  if found then
   new.applied_pricing_plan:='starter';
   new.membership_subscription_id:=m.stripe_subscription_id;
   bps:=0;
  else
   select t.sales_commission_bps into bps from public.seller_pricing_tiers t where t.code='payg' and t.active;
   if bps is null then raise exception 'Seller pricing policy is unavailable';end if;
  end if;
 end if;
 new.applied_fee_bps:=bps;
 new.platform_fee_cents:=round(new.subtotal_cents::numeric*bps/10000)::integer;
 new.fee_locked_at:=now();
 return new;
end;$$;
create trigger hcs_seller_fee_on_insert before insert on public.seller_orders
for each row execute function public.hcs_set_seller_fee();

create or replace function public.hcs_lock_seller_fee()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.platform_fee_cents is distinct from old.platform_fee_cents
 or new.applied_fee_bps is distinct from old.applied_fee_bps
 or new.applied_pricing_plan is distinct from old.applied_pricing_plan
 or new.membership_subscription_id is distinct from old.membership_subscription_id
 or new.fee_locked_at is distinct from old.fee_locked_at
 then raise exception 'Historical marketplace fees are immutable';end if;
 return new;
end;$$;
create trigger hcs_seller_fee_lock before update on public.seller_orders
for each row execute function public.hcs_lock_seller_fee();

-- Only signed Stripe subscription events, via a server-only RPC, can grant memberships.
-- The seller ID is supplied from verified Checkout subscription metadata; never from browser settings.
create or replace function public.hcs_apply_seller_membership_event(
 p_event_id text, p_event_created bigint, p_event_type text,
 p_subscription_id text, p_customer_id text,
 p_price_id text, p_status text, p_period_end bigint,
 p_cancel_at_period_end boolean, p_seller_id uuid
) returns text language plpgsql security definer set search_path=public as $$
declare current_row record; t record; founding boolean;
begin
 if p_event_id not like 'evt_%' or p_subscription_id not like 'sub_%' or p_customer_id not like 'cus_%'
 then raise exception 'Invalid Stripe subscription event';end if;
 if p_event_created<1 or p_event_type not in ('customer.subscription.created','customer.subscription.updated','customer.subscription.deleted')
 then raise exception 'Unsupported subscription event';end if;
 if p_status not in ('incomplete','incomplete_expired','trialing','active','past_due','unpaid','canceled','paused')
 then raise exception 'Unexpected subscription status';end if;
 select * into t from public.seller_pricing_tiers where stripe_price_id=p_price_id and code='starter' and active;
 if not found then raise exception 'Unrecognized subscription price';end if;
 select is_founding_seller into founding from public.sellers where id=p_seller_id and status='approved';
 if founding is null or founding then raise exception 'Seller is not eligible for a membership';end if;
 select * into current_row from public.seller_memberships where seller_id=p_seller_id for update;
 if found and current_row.stripe_subscription_id<>p_subscription_id
   and current_row.status not in ('canceled','incomplete_expired')
 then raise exception 'Seller already has a different subscription';end if;
 if found and current_row.stripe_customer_id<>p_customer_id then raise exception 'Subscription customer mismatch';end if;
 if found and current_row.stripe_subscription_id=p_subscription_id
   and p_event_created<=current_row.last_stripe_event_created then return 'stale_event';end if;
 insert into public.seller_memberships(seller_id,tier_code,stripe_customer_id,stripe_subscription_id,stripe_price_id,status,
   current_period_end,cancel_at_period_end,last_stripe_event_created,last_stripe_event_id)
 values(p_seller_id,'starter',p_customer_id,p_subscription_id,p_price_id,p_status,
   case when p_period_end>0 then to_timestamp(p_period_end) else null end,
   p_cancel_at_period_end,p_event_created,p_event_id)
 on conflict(seller_id) do update set
  tier_code=excluded.tier_code,stripe_subscription_id=excluded.stripe_subscription_id,
  stripe_price_id=excluded.stripe_price_id,status=excluded.status,current_period_end=excluded.current_period_end,
  cancel_at_period_end=excluded.cancel_at_period_end,last_stripe_event_created=excluded.last_stripe_event_created,
  last_stripe_event_id=excluded.last_stripe_event_id,updated_at=now();
 return 'recorded';
end;$$;
revoke execute on function public.hcs_apply_seller_membership_event(text,bigint,text,text,text,text,text,bigint,boolean,uuid)
 from public,anon,authenticated;
grant execute on function public.hcs_apply_seller_membership_event(text,bigint,text,text,text,text,text,bigint,boolean,uuid)
 to service_role;
