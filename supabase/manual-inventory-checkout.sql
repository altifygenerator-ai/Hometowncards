-- Manual inventory checkout with separate future eBay writeback queue.
-- Stripe checkout remains disabled until tax registration is verified.
alter table public.marketplace_settings
 add column if not exists manual_inventory_mode boolean not null default false;
update public.marketplace_settings set manual_inventory_mode=true,updated_at=now()
 where id=true and checkout_enabled=false;

create table if not exists public.ebay_sale_outbox(
 id uuid primary key default gen_random_uuid(),
 movement_id uuid not null unique references public.stock_movements(id),
 product_id uuid not null references public.products(id),
 seller_id uuid not null references public.sellers(id),
 source_item_id text not null,
 sold_quantity integer not null check (sold_quantity>0),
 state text not null default 'pending_connection' check(state in ('pending_connection','pending','processing','completed','needs_review')),
 attempts integer not null default 0,
 last_error text,
 processed_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists ebay_sale_outbox_pending_idx on public.ebay_sale_outbox(seller_id,state,created_at);
alter table public.ebay_sale_outbox enable row level security;
revoke all on public.ebay_sale_outbox from anon,authenticated;

create or replace function public.hcs_queue_ebay_site_sale()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_source text;v_source_id text;
begin
 if new.reason<>'site_sale' or new.delta>=0 then return new;end if;
 select source,source_item_id into v_source,v_source_id from public.products where id=new.product_id;
 if v_source='ebay' and v_source_id is not null then
  insert into public.ebay_sale_outbox(movement_id,product_id,seller_id,source_item_id,sold_quantity)
  values(new.id,new.product_id,new.seller_id,v_source_id,-new.delta)
  on conflict(movement_id) do nothing;
 end if;
 return new;
end;$$;
drop trigger if exists hcs_queue_ebay_site_sale_trigger on public.stock_movements;
create trigger hcs_queue_ebay_site_sale_trigger
 after insert on public.stock_movements
 for each row execute function public.hcs_queue_ebay_site_sale();

-- Preserve all reservation, reward, shipping and webhook settlement rules.
CREATE OR REPLACE FUNCTION public.hcs_begin_checkout(p_items jsonb, p_preferred_sport text DEFAULT 'Mixed'::text, p_shipping_profile_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
 v_seller uuid;v_seller_info record; v_policy record;v_pool record; v_product record;v_line jsonb;
 v_ids text[]:=array[]::text[];v_quantities integer[]:=array[]::integer[];
 v_id text;v_qty integer;v_index integer;v_bought integer:=0;v_subtotal bigint:=0;
 v_bonus integer;v_available bigint;v_weight numeric;v_item_weight numeric:=0;v_requires_parcel boolean:=false;v_is_special boolean:=false;
 v_profile record;v_ship bigint:=null;v_profile_id uuid;v_best_weight numeric;v_best_tracked boolean;v_best_coverage integer;
 v_service text;v_order uuid;v_seller_order uuid;v_lines jsonb:='[]'::jsonb;
 v_sport text; v_manual_inventory boolean:=false; v_total bigint;v_expiry timestamptz:=now()+interval '45 minutes';
begin
 if not exists(select 1 from public.marketplace_settings where id=true and checkout_enabled and not marketplace_mode)
 then raise exception 'Checkout has not been opened';end if;
 select manual_inventory_mode into v_manual_inventory from public.marketplace_settings where id=true;
 v_manual_inventory:=coalesce(v_manual_inventory,false);
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>50
 then raise exception 'Cart requires between 1 and 50 distinct listings';end if;
 select id,tracking_required_from_cents,insurance_required_from_cents into v_seller_info from public.sellers where slug='hometown-card-shop' and is_founding_seller and status='approved';
 v_seller:=v_seller_info.id;
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
 perform 1 from public.products p where p.seller_id=v_seller and ((p.source='ebay' and p.source_item_id=any(v_ids)) or (p.source in ('manual','csv') and p.id::text=any(v_ids)))
 order by p.id for update;
 for v_index in 1..array_length(v_ids,1) loop
  select * into v_product from public.products p
   where p.seller_id=v_seller and ((p.source='ebay' and p.source_item_id=v_ids[v_index]) or (p.source in ('manual','csv') and p.id::text=v_ids[v_index]));
  if not found or v_product.status<>'published' or v_product.needs_review or v_product.manual_paused
  then raise exception 'A cart listing is no longer available';end if;
  -- Never take orders against a stale eBay feed.
  if v_product.source='ebay' and not v_manual_inventory and not exists(select 1 from public.seller_integrations i
    where i.seller_id=v_seller and i.provider='ebay' and i.status='connected'
      and i.last_successful_sync>now()-interval '20 minutes')
  then raise exception 'Live inventory synchronization is required';end if;
  select coalesce(sum(r.quantity),0) into v_available from public.inventory_reservations r
   where r.product_id=v_product.id and r.state='held' and r.expires_at>now();
  if v_product.stock-v_available<v_quantities[v_index] then raise exception 'Not enough stock for a card';end if;
  v_subtotal:=v_subtotal+coalesce(v_product.price_override_cents,v_product.price_cents)::bigint*v_quantities[v_index];
  v_is_special:=v_product.title ~* '(^|[^a-z])(psa|bgs|sgc|cgc|graded|slab|booster|sealed|blaster|hobby box)([^a-z]|$)'
 or v_product.category ~* '(^|[^a-z])(graded|sealed|packs|boxes)([^a-z]|$)';
 v_requires_parcel:=v_requires_parcel or v_is_special;
 v_item_weight:=v_item_weight+v_quantities[v_index]*
 (case when v_is_special then greatest(coalesce(v_product.weight_oz+0.24,4.00),4.00)
 else greatest(coalesce(v_product.weight_oz+0.24,0.30),0.30) end);
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
  v_weight:=round((v_profile.packaging_weight_oz
    +greatest(v_item_weight, v_bought*v_profile.default_item_weight_oz)
    +v_bonus*v_profile.bonus_item_weight_oz)::numeric,3);
  if v_bought+v_bonus>v_profile.max_items or v_weight>v_profile.max_weight_oz then continue;end if;
  if p_shipping_profile_id is not null and p_shipping_profile_id<>v_profile.id then continue;end if;
  if v_profile.min_order_value_cents is not null and v_subtotal<v_profile.min_order_value_cents then continue;end if;
  if v_profile.max_order_value_cents is not null and v_subtotal>v_profile.max_order_value_cents then continue;end if;
  if not v_profile.tracking_included and v_subtotal>=v_seller_info.tracking_required_from_cents then continue;end if;
  if v_subtotal>v_seller_info.insurance_required_from_cents and v_profile.insurance_coverage_cents<v_subtotal then continue;end if;
  if v_profile.shipping_class='economy'
    and (v_weight>3.5 or v_profile.tracking_included or v_bought>2 or v_requires_parcel)
    then continue;end if;
  if v_profile.shipping_class in ('tracked','insured') and not v_profile.tracking_included then continue;end if;
  v_available:=case when v_profile.free_shipping_threshold_cents is not null
     and v_subtotal>=v_profile.free_shipping_threshold_cents then 0
    else v_profile.base_cents+(v_bought+v_bonus-1)*v_profile.additional_item_cents end;
  if v_ship is null or v_available<v_ship then
   v_ship:=v_available;v_profile_id:=v_profile.id;v_service:=v_profile.service_label;v_best_weight:=v_weight;v_best_tracked:=v_profile.tracking_included;v_best_coverage:=v_profile.insurance_coverage_cents;
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
 insert into public.shipping_quotes(order_id,seller_id,shipping_profile_id,quantity,gift_cards,estimated_weight_oz,charged_cents,service_label_snapshot,tracking_included,insured_for_cents)
 values(v_order,v_seller,v_profile_id,v_bought,v_bonus,v_best_weight,v_ship,v_service,v_best_tracked,v_best_coverage);
 return jsonb_build_object('order_id',v_order,'items',v_lines,'shipping_cents',v_ship,'subtotal_cents',v_subtotal,
  'bonus_cards',v_bonus,'total_cents',v_total,'shipping_service',v_service,'expires_unix',extract(epoch from v_expiry)::bigint);
end;$function$

revoke execute on function public.hcs_begin_checkout(jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.hcs_begin_checkout(jsonb,text,uuid) to service_role;
