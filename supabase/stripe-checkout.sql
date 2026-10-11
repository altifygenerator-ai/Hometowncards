-- Hometown Card Shop: staged hosted Stripe Checkout, single founder now, Connect-compatible orders later.
-- Apply only to dedicated Hometown Card Shop Supabase project.
create table if not exists public.stripe_webhook_events(
 id text primary key,
 event_type text not null,
 checkout_session_id text,
 created_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
alter table public.order_bonus_cards add column if not exists pool_id uuid references public.bonus_card_pools(id);
alter table public.orders add column if not exists checkout_expires_at timestamptz;
create index if not exists checkout_expiry_idx on public.orders(checkout_expires_at) where status='held';

create or replace function public.hcs_begin_checkout(p_items jsonb,p_preferred_sport text default 'Mixed')
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_seller uuid; v_policy record;v_pool record; v_product record;v_line jsonb;
 v_ids text[]:=array[]::text[];v_quantities integer[]:=array[]::integer[];
 v_id text;v_qty integer;v_index integer;v_bought integer:=0;v_subtotal bigint:=0;
 v_bonus integer;v_available bigint;v_weight numeric;v_item_weight numeric:=0;
 v_profile record;v_ship bigint:=null;v_profile_id uuid;v_best_weight numeric;
 v_service text;v_order uuid;v_seller_order uuid;v_lines jsonb:='[]'::jsonb;
 v_sport text; v_total bigint;v_expiry timestamptz:=now()+interval '45 minutes';
begin
 if not exists(select 1 from public.marketplace_settings where id=true and checkout_enabled and not marketplace_mode)
 then raise exception 'Checkout has not been opened';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>50
 then raise exception 'Cart requires between 1 and 50 distinct listings';end if;
 select id into v_seller from public.sellers where slug='hometown-card-shop' and is_founding_seller and status='approved';
 if v_seller is null then raise exception 'Founding shop is unavailable';end if;
 v_sport:=case when p_preferred_sport in ('Baseball','Football','Basketball') then p_preferred_sport else 'Mixed' end;
 for v_line in select value from jsonb_array_elements(p_items) loop
  v_id:=v_line->>'id';
  if v_id is null or length(v_id)>100 or length(v_id)<1 then raise exception 'Invalid listing identifier';end if;
  if jsonb_typeof(v_line->'quantity')<>'number' then raise exception 'Invalid quantity';end if;
  v_qty:=(v_line->>'quantity')::integer;
  if v_qty<1 or v_qty>25 or v_id=any(v_ids) then raise exception 'Cart quantity or duplicate listing';end if;
  v_ids:=array_append(v_ids,v_id);v_quantities:=array_append(v_quantities,v_qty);
  v_bought:=v_bought+v_qty;
 end loop;
 if v_bought>100 then raise exception 'Too many cards for a single checkout';end if;
 -- Lock in stable order to serialize competing checkout reservations.
 perform 1 from public.products p where p.seller_id=v_seller and p.source_item_id=any(v_ids)
 order by p.id for update;
 for v_index in 1..array_length(v_ids,1) loop
  select * into v_product from public.products p
   where p.seller_id=v_seller and p.source_item_id=v_ids[v_index] and p.source='ebay';
  if not found or v_product.status<>'published' or v_product.needs_review or v_product.manual_paused
  then raise exception 'A cart listing is no longer available';end if;
  -- Never take orders against a stale eBay feed.
  if not exists(select 1 from public.seller_integrations i
    where i.seller_id=v_seller and i.provider='ebay' and i.status='connected'
      and i.last_successful_sync>now()-interval '20 minutes')
  then raise exception 'Live inventory synchronization is required';end if;
  select coalesce(sum(r.quantity),0) into v_available from public.inventory_reservations r
   where r.product_id=v_product.id and r.state='held' and r.expires_at>now();
  if v_product.stock-v_available<v_quantities[v_index] then raise exception 'Not enough stock for a card';end if;
  v_subtotal:=v_subtotal+coalesce(v_product.price_override_cents,v_product.price_cents)::bigint*v_quantities[v_index];
  v_item_weight:=v_item_weight+v_quantities[v_index]*coalesce(v_product.weight_oz,0);
  v_lines:=v_lines||jsonb_build_array(jsonb_build_object('product_id',v_product.id,
   'seller_id',v_seller,'source_item_id',v_product.source_item_id,'title',left(v_product.title,240),
   'sku',v_product.sku,'unit_price_cents',coalesce(v_product.price_override_cents,v_product.price_cents),
   'quantity',v_quantities[v_index]));
 end loop;
 if v_subtotal<1 or v_subtotal>50000000 then raise exception 'Invalid merchandise total';end if;
 select * into v_policy from public.reward_policies where id='hometown-bonus-cards-v1'
   and funding_seller_id=v_seller and is_active;
 if not found then raise exception 'Free card fulfillment is not ready';end if;
 v_bonus:=case when v_subtotal>=5000 then 20 when v_subtotal>=2500 then 10
              when v_subtotal>=1000 then 5 else 1 end;
 -- Reserve enough FREE common cards at checkout, not when a picker happens to pack the parcel.
 select * into v_pool from public.bonus_card_pools
 where funding_seller_id=v_seller and sport in (v_sport,'Mixed')
   and available_count-reserved_count>=v_bonus
 order by case when sport=v_sport then 0 else 1 end limit 1 for update;
 if not found then raise exception 'Bonus card stock needs replenishing';end if;
 -- Rate model is seller-configured; prefer cheapest allowed profile (including gift weight).
 for v_profile in select * from public.shipping_profiles where seller_id=v_seller and active and allows_bonus_cards
   order by sort_order,id loop
  v_weight:=v_profile.packaging_weight_oz
    +(v_bought+v_bonus)*v_profile.default_item_weight_oz;
  if v_bought+v_bonus>v_profile.max_items or v_weight>v_profile.max_weight_oz then continue;end if;
  v_available:=case when v_profile.free_shipping_threshold_cents is not null
     and v_subtotal>=v_profile.free_shipping_threshold_cents then 0
    else v_profile.base_cents+(v_bought+v_bonus-1)*v_profile.additional_item_cents end;
  if v_ship is null or v_available<v_ship then
   v_ship:=v_available;v_profile_id:=v_profile.id;v_service:=v_profile.service_label;v_best_weight:=v_weight;
  end if;
 end loop;
 if v_ship is null then raise exception 'Shipping is not configured for this parcel';end if;
 v_total:=v_subtotal+v_ship;
 insert into public.orders(status,subtotal_cents,shipping_cents,tax_cents,total_cents,checkout_expires_at)
 values('held',v_subtotal,v_ship,0,v_total,v_expiry) returning id into v_order;
 insert into public.seller_orders(order_id,seller_id,subtotal_cents,shipping_cents,platform_fee_cents,status)
 values(v_order,v_seller,v_subtotal,v_ship,0,'pending') returning id into v_seller_order;
 for v_line in select value from jsonb_array_elements(v_lines) loop
  insert into public.order_lines(order_id,seller_order_id,seller_id,product_id,product_title_snapshot,sku_snapshot,quantity,unit_price_cents)
  values(v_order,v_seller_order,v_seller,(v_line->>'product_id')::uuid,v_line->>'title',v_line->>'sku',(v_line->>'quantity')::integer,(v_line->>'unit_price_cents')::integer);
  insert into public.inventory_reservations(order_id,product_id,quantity,expires_at)
  values(v_order,(v_line->>'product_id')::uuid,(v_line->>'quantity')::integer,v_expiry);
 end loop;
 update public.bonus_card_pools set reserved_count=reserved_count+v_bonus,updated_at=now() where id=v_pool.id;
 insert into public.order_bonus_cards(order_id,reward_policy_id,funding_seller_id,free_card_count,preferred_sport,pool_id)
 values(v_order,'hometown-bonus-cards-v1',v_seller,v_bonus,v_sport,v_pool.id);
 insert into public.shipping_quotes(order_id,seller_id,shipping_profile_id,quantity,gift_cards,estimated_weight_oz,charged_cents,service_label_snapshot)
 values(v_order,v_seller,v_profile_id,v_bought,v_bonus,v_best_weight,v_ship,v_service);
 return jsonb_build_object('order_id',v_order,'items',v_lines,'shipping_cents',v_ship,'subtotal_cents',v_subtotal,
  'bonus_cards',v_bonus,'total_cents',v_total,'shipping_service',v_service,'expires_unix',extract(epoch from v_expiry)::bigint);
end;$$;

create or replace function public.hcs_attach_checkout(p_order uuid,p_session_id text)
returns void language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype;
begin
 select * into v_order from public.orders where id=p_order for update;
 if not found or v_order.status<>'held' or v_order.checkout_expires_at<=now() then
  raise exception 'Checkout reservation expired';end if;
 if p_session_id not like 'cs_%' then raise exception 'Invalid Checkout session';end if;
 if v_order.stripe_session_id is not null and v_order.stripe_session_id<>p_session_id
 then raise exception 'Order already has a different session';end if;
 update public.orders set stripe_session_id=p_session_id,updated_at=now() where id=p_order;
end;$$;

create or replace function public.hcs_settle_checkout(
 p_order uuid,p_session_id text,p_event_id text,p_event_type text,
 p_paid boolean default false,p_payment_intent text default null,
 p_email text default null,p_shipping jsonb default null,
 p_amount_total integer default null,p_tax_cents integer default 0)
returns text language plpgsql security definer set search_path=public as $$
declare v_o public.orders%rowtype;v_line record;v_bonus record;v_reserved bigint;
begin
 if p_event_id is null or p_event_id not like 'evt_%' then raise exception 'Invalid Stripe event id';end if;
 if p_event_type not in ('checkout.session.completed','checkout.session.async_payment_succeeded',
   'checkout.session.async_payment_failed','checkout.session.expired') then raise exception 'Unsupported event';end if;
 select * into v_o from public.orders where id=p_order for update;
 if not found or v_o.stripe_session_id<>p_session_id then raise exception 'Unrecognized checkout session';end if;
 if exists(select 1 from public.stripe_webhook_events where id=p_event_id) then return 'duplicate';end if;
 if v_o.status in ('paid','fulfilled') then
  insert into public.stripe_webhook_events(id,event_type,checkout_session_id) values(p_event_id,p_event_type,p_session_id);
  return 'already_paid';
 end if;
 if v_o.status<>'held' then
  insert into public.stripe_webhook_events(id,event_type,checkout_session_id) values(p_event_id,p_event_type,p_session_id);
  return 'already_closed';
 end if;
 if p_paid then
  if p_amount_total is null or p_tax_cents<0 or p_amount_total<>v_o.total_cents+p_tax_cents
  then
   update public.orders set status='needs_review',updated_at=now() where id=p_order;
   insert into public.stripe_webhook_events(id,event_type,checkout_session_id) values(p_event_id,p_event_type,p_session_id);
   return 'amount_mismatch_needs_review';
  end if;
  if v_o.checkout_expires_at<=now() then
   update public.orders set status='needs_review',updated_at=now() where id=p_order;
   insert into public.stripe_webhook_events(id,event_type,checkout_session_id) values(p_event_id,p_event_type,p_session_id);
   return 'expired_paid_needs_review';
  end if;
  -- Consume each held unit exactly once. Stripe is authoritative, not the redirect page.
  for v_line in select r.product_id,r.quantity,p.seller_id
    from public.inventory_reservations r join public.products p on p.id=r.product_id
    where r.order_id=p_order and r.state='held' order by r.product_id for update of r loop
   update public.products set stock=stock-v_line.quantity,
    status=case when stock=v_line.quantity then 'sold_out' else status end,updated_at=now()
    where id=v_line.product_id and stock>=v_line.quantity;
   if not found then raise exception 'Paid order stock conflict; manual reconciliation required';end if;
   insert into public.stock_movements(product_id,seller_id,delta,reason,reference_id)
   values(v_line.product_id,v_line.seller_id,-v_line.quantity,'site_sale',p_session_id);
  end loop;
  update public.inventory_reservations set state='consumed' where order_id=p_order and state='held';
  select * into v_bonus from public.order_bonus_cards where order_id=p_order for update;
  if found then
    update public.bonus_card_pools
      set available_count=available_count-v_bonus.free_card_count,
          reserved_count=reserved_count-v_bonus.free_card_count,updated_at=now()
      where id=v_bonus.pool_id and available_count>=v_bonus.free_card_count and reserved_count>=v_bonus.free_card_count;
    if not found then raise exception 'Bonus inventory conflict';end if;
  end if;
  update public.orders set status='paid',stripe_payment_intent_id=nullif(p_payment_intent,''),
    customer_email=left(p_email,250),shipping_address=p_shipping,
    tax_cents=p_tax_cents,total_cents=p_amount_total,updated_at=now() where id=p_order;
  update public.seller_orders set status='paid' where order_id=p_order;
 else
  if p_event_type='checkout.session.completed' then
   -- For delayed payments, retain inventory until final succeeded/failed.
   insert into public.stripe_webhook_events(id,event_type,checkout_session_id) values(p_event_id,p_event_type,p_session_id);
   return 'awaiting_payment';
  end if;
  update public.inventory_reservations set state=case when p_event_type='checkout.session.expired' then 'expired' else 'cancelled' end
   where order_id=p_order and state='held';
  select * into v_bonus from public.order_bonus_cards where order_id=p_order for update;
  if found then update public.bonus_card_pools set reserved_count=greatest(0,reserved_count-v_bonus.free_card_count),updated_at=now()
    where id=v_bonus.pool_id;end if;
  update public.orders set status='cancelled',updated_at=now() where id=p_order;
  update public.seller_orders set status='cancelled' where order_id=p_order;
 end if;
 insert into public.stripe_webhook_events(id,event_type,checkout_session_id) values(p_event_id,p_event_type,p_session_id);
 return case when p_paid then 'paid' else 'released' end;
end;$$;

-- When Stripe creation fails BEFORE handing out a checkout URL, cancel safely.
create or replace function public.hcs_abort_unattached_checkout(p_order uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_o public.orders%rowtype;v_bonus record;
begin
 select * into v_o from public.orders where id=p_order for update;
 if not found or v_o.status<>'held' or v_o.stripe_session_id is not null then return;end if;
 update public.inventory_reservations set state='cancelled' where order_id=p_order and state='held';
 select * into v_bonus from public.order_bonus_cards where order_id=p_order for update;
 if found then update public.bonus_card_pools set reserved_count=greatest(0,reserved_count-v_bonus.free_card_count) where id=v_bonus.pool_id;end if;
 update public.orders set status='cancelled',updated_at=now() where id=p_order;
 update public.seller_orders set status='cancelled' where order_id=p_order;
end;$$;

revoke all on function public.hcs_begin_checkout(jsonb,text) from public,anon,authenticated;
revoke all on function public.hcs_attach_checkout(uuid,text) from public,anon,authenticated;
revoke all on function public.hcs_settle_checkout(uuid,text,text,text,boolean,text,text,jsonb,integer,integer) from public,anon,authenticated;
revoke all on function public.hcs_abort_unattached_checkout(uuid) from public,anon,authenticated;
grant execute on function public.hcs_begin_checkout(jsonb,text) to service_role;
grant execute on function public.hcs_attach_checkout(uuid,text) to service_role;
grant execute on function public.hcs_settle_checkout(uuid,text,text,text,boolean,text,text,jsonb,integer,integer) to service_role;
grant execute on function public.hcs_abort_unattached_checkout(uuid) to service_role;
