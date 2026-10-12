-- SST Arkansas self-calculated taxes and future seller Connect tax options.
-- No tax permit is created; checkout remains OFF until seller is legally registered and deployment is tested.
CREATE OR REPLACE FUNCTION public.hcs_apply_manual_checkout_tax(p_order uuid, p_shipping jsonb, p_tax_cents integer, p_rate numeric, p_source text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_order public.orders%rowtype;v_state text;
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
 if v_state='AR' then
  if p_source !~ '^ar-sst-[0-9]{4}q[1-4] or p_rate<0.065 or p_rate>0.16
   or p_tax_cents<>round((v_order.subtotal_cents+v_order.shipping_cents)*p_rate)
  then raise exception 'Invalid Arkansas sales tax amount';end if;
 else
  if p_source<>'outside-arkansas-not-registered' or p_rate<>0 or p_tax_cents<>0
  then raise exception 'Invalid out-of-state tax amount';end if;
 end if;
 update public.orders set
  tax_cents=p_tax_cents,tax_rate=p_rate,tax_source=p_source,
  total_cents=subtotal_cents+shipping_cents+p_tax_cents,
  shipping_address=p_shipping,shipping_name=left(coalesce(p_shipping->>'name',''),120),
  updated_at=now() where id=p_order;
end;$function$
 or p_rate<0.065 or p_rate>0.16
   or p_tax_cents<>round((v_order.subtotal_cents+v_order.shipping_cents)*p_rate)
  then raise exception 'Invalid Arkansas sales tax amount';end if;
 else
  if p_source<>'outside-arkansas-not-registered' or p_rate<>0 or p_tax_cents<>0
  then raise exception 'Invalid out-of-state tax amount';end if;
 end if;
 update public.orders set
  tax_cents=p_tax_cents,tax_rate=p_rate,tax_source=p_source,
  total_cents=subtotal_cents+shipping_cents+p_tax_cents,
  shipping_address=p_shipping,shipping_name=left(coalesce(p_shipping->>'name',''),120),
  updated_at=now() where id=p_order;
end;$function$;
revoke all on function public.hcs_apply_manual_checkout_tax(uuid,jsonb,integer,numeric,text) from public,anon,authenticated;
grant execute on function public.hcs_apply_manual_checkout_tax(uuid,jsonb,integer,numeric,text) to service_role;

create table if not exists public.seller_tax_profiles (
 seller_id uuid primary key references public.sellers(id) on delete cascade,
 collection_mode text not null default 'seller_managed' check(collection_mode in ('seller_managed','connect_stripe_tax')),
 registered_states text[] not null default '{}'::text[],
 responsibility_confirmed_at timestamptz,
 last_reviewed_at timestamptz,
 last_reviewed_by uuid,
 notes text not null default '',
 updated_at timestamptz not null default now()
);
-- Only service role/server-authenticated seller admins can access a seller's tax settings.
alter table public.seller_tax_profiles enable row level security;
revoke all on public.seller_tax_profiles from anon,authenticated;
insert into public.seller_tax_profiles(seller_id,collection_mode)
select id,'seller_managed' from public.sellers where slug='hometown-card-shop'
on conflict(seller_id) do nothing;
