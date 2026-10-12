-- Fixed state-level sales/use tax rates for Hometown founder checkout.
-- This is a simplified tax policy, not a complete registration/taxability determination.
-- Rates: Tax Foundation state sales tax table, July 1, 2026.
-- https://taxfoundation.org/data/all/state/2026-sales-tax-rates-midyear/
create table if not exists public.state_sales_tax_rates(
 state_code text primary key check (state_code ~ '^[A-Z]{2}$'),
 rate numeric(8,6) not null check (rate>=0 and rate<=0.16),
 source text not null,
 updated_at timestamptz not null default now()
);
alter table public.state_sales_tax_rates enable row level security;
revoke all on public.state_sales_tax_rates from anon,authenticated;
insert into public.state_sales_tax_rates(state_code,rate,source)
values
 ('AL',0.040000,'state-base-2026-07'),
 ('AK',0.000000,'state-base-2026-07'),
 ('AZ',0.056000,'state-base-2026-07'),
 ('AR',0.065000,'state-base-2026-07'),
 ('CA',0.072500,'state-base-2026-07'),
 ('CO',0.029000,'state-base-2026-07'),
 ('CT',0.063500,'state-base-2026-07'),
 ('DE',0.000000,'state-base-2026-07'),
 ('FL',0.060000,'state-base-2026-07'),
 ('GA',0.040000,'state-base-2026-07'),
 ('HI',0.040000,'state-base-2026-07'),
 ('ID',0.060000,'state-base-2026-07'),
 ('IL',0.062500,'state-base-2026-07'),
 ('IN',0.070000,'state-base-2026-07'),
 ('IA',0.060000,'state-base-2026-07'),
 ('KS',0.065000,'state-base-2026-07'),
 ('KY',0.060000,'state-base-2026-07'),
 ('LA',0.050000,'state-base-2026-07'),
 ('ME',0.055000,'state-base-2026-07'),
 ('MD',0.060000,'state-base-2026-07'),
 ('MA',0.062500,'state-base-2026-07'),
 ('MI',0.060000,'state-base-2026-07'),
 ('MN',0.068750,'state-base-2026-07'),
 ('MS',0.070000,'state-base-2026-07'),
 ('MO',0.042250,'state-base-2026-07'),
 ('MT',0.000000,'state-base-2026-07'),
 ('NE',0.055000,'state-base-2026-07'),
 ('NV',0.068500,'state-base-2026-07'),
 ('NH',0.000000,'state-base-2026-07'),
 ('NJ',0.066250,'state-base-2026-07'),
 ('NM',0.048750,'state-base-2026-07'),
 ('NY',0.040000,'state-base-2026-07'),
 ('NC',0.047500,'state-base-2026-07'),
 ('ND',0.050000,'state-base-2026-07'),
 ('OH',0.057500,'state-base-2026-07'),
 ('OK',0.045000,'state-base-2026-07'),
 ('OR',0.000000,'state-base-2026-07'),
 ('PA',0.060000,'state-base-2026-07'),
 ('RI',0.070000,'state-base-2026-07'),
 ('SC',0.060000,'state-base-2026-07'),
 ('SD',0.042000,'state-base-2026-07'),
 ('TN',0.070000,'state-base-2026-07'),
 ('TX',0.062500,'state-base-2026-07'),
 ('UT',0.061000,'state-base-2026-07'),
 ('VT',0.060000,'state-base-2026-07'),
 ('VA',0.053000,'state-base-2026-07'),
 ('WA',0.065000,'state-base-2026-07'),
 ('WV',0.060000,'state-base-2026-07'),
 ('WI',0.050000,'state-base-2026-07'),
 ('WY',0.040000,'state-base-2026-07'),
 ('DC',0.060000,'state-base-2026-07')
on conflict(state_code) do update set rate=excluded.rate,source=excluded.source,updated_at=now();

create or replace function public.hcs_apply_manual_checkout_tax(
 p_order uuid,p_shipping jsonb,p_tax_cents integer,p_rate numeric,p_source text)
returns void language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype;v_state text;v_rate numeric;
begin
 select * into v_order from public.orders where id=p_order for update;
 if not found or v_order.status<>'held' or v_order.stripe_session_id is not null
    or v_order.checkout_expires_at<=now() then
  raise exception 'Order is no longer eligible for tax calculation';
 end if;
 v_state:=upper(coalesce(p_shipping->'address'->>'state',''));
 if coalesce(p_shipping->>'name','')='' or
  length(coalesce(p_shipping->'address'->>'line1',''))<5 or
  length(coalesce(p_shipping->'address'->>'city',''))<2 or
  coalesce(p_shipping->'address'->>'country','')<>'US' or
  coalesce(p_shipping->'address'->>'postal_code','')!~'^\d{5}(-\d{4})?$'
 then raise exception 'Invalid delivery address';end if;
 select rate into v_rate from public.state_sales_tax_rates where state_code=v_state;
 if not found then raise exception 'Unknown state tax rate';end if;
 if p_source<>'state-base-2026-07' or p_rate is distinct from v_rate
    or p_tax_cents is null or p_tax_cents<>round((v_order.subtotal_cents+v_order.shipping_cents)*v_rate)
 then raise exception 'Invalid state tax amount';end if;
 update public.orders set
  tax_cents=p_tax_cents,tax_rate=p_rate,tax_source=p_source,
  total_cents=subtotal_cents+shipping_cents+p_tax_cents,
  shipping_address=p_shipping,shipping_name=left(coalesce(p_shipping->>'name',''),120),
  updated_at=now() where id=p_order;
end;$$;

revoke all on function public.hcs_apply_manual_checkout_tax(uuid,jsonb,integer,numeric,text) from public,anon,authenticated;
grant execute on function public.hcs_apply_manual_checkout_tax(uuid,jsonb,integer,numeric,text) to service_role;
