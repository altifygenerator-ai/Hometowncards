-- Secure Stripe Billing Customer ownership mapping for future approved sellers.
create table if not exists public.seller_billing_customers(
 seller_id uuid primary key references public.sellers(id) on delete cascade,
 stripe_customer_id text not null unique check(stripe_customer_id like 'cus_%'),
 created_at timestamptz not null default now()
);
alter table public.seller_billing_customers enable row level security;
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
 if not exists(select 1 from public.seller_billing_customers c
  where c.seller_id=p_seller_id and c.stripe_customer_id=p_customer_id)
 then raise exception 'Billing customer is not linked to this seller';end if;
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
