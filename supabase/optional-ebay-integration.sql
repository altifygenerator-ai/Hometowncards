-- Optional eBay integration: local-only sellers do not need an eBay account.
-- Strictly seller-scoped, server-only OAuth secrets and idempotent order stock reductions.
create table if not exists public.ebay_connections(
 seller_id uuid primary key references public.sellers(id) on delete cascade,
 refresh_token_ciphertext text not null,
 status text not null default 'connected' check(status in ('connected','paused','error')),
 sync_mode text not null default 'import_only' check(sync_mode in ('import_only','two_way')),
 ebay_username text,
 listing_page integer not null default 1 check(listing_page between 1 and 100),
 listing_total integer,
 listing_pages integer,
 listing_started_at timestamptz,
 last_listing_sync_at timestamptz,
 last_order_sync_at timestamptz,
 last_writeback_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.ebay_connections enable row level security;
revoke all on public.ebay_connections from public,anon,authenticated;
create table if not exists public.ebay_imported_order_lines(
 seller_id uuid not null references public.sellers(id) on delete cascade,
 ebay_order_id text not null,
 ebay_line_id text not null,
 ebay_listing_id text not null,
 quantity integer not null check(quantity between 1 and 100000),
 result text not null check(result in ('applied','missing','conflict')),
 created_at timestamptz not null default now(),
 primary key(seller_id,ebay_order_id,ebay_line_id)
);
alter table public.ebay_imported_order_lines enable row level security;
revoke all on public.ebay_imported_order_lines from public,anon,authenticated;

-- A paid eBay order must never be imported twice. Respect active website holds, and
-- pause the listing for review if stock is already shared by a checkout.
create or replace function public.hcs_apply_ebay_order_line(
 p_seller uuid,p_ebay_order text,p_ebay_line text,p_listing text,p_quantity integer)
returns text language plpgsql security definer set search_path=public as $$
declare v_product public.products%rowtype;v_reserved integer;v_result text;
begin
 if p_ebay_order='' or length(p_ebay_order)>128 or p_ebay_line='' or length(p_ebay_line)>128
  or p_listing !~ '^[0-9]{9,22}$' or p_quantity<1 or p_quantity>10000 then
  raise exception 'Invalid eBay order identity';
 end if;
 if exists(select 1 from public.ebay_imported_order_lines where seller_id=p_seller
   and ebay_order_id=p_ebay_order and ebay_line_id=p_ebay_line) then return 'duplicate';end if;
 select * into v_product from public.products where seller_id=p_seller and source='ebay'
   and source_item_id=p_listing for update;
 if not found then v_result:='missing';
 else
  select coalesce(sum(quantity),0)::integer into v_reserved
   from public.inventory_reservations where product_id=v_product.id
    and state='held' and expires_at>now();
  if v_product.stock<p_quantity or v_product.stock-p_quantity<v_reserved then
   v_result:='conflict';
   update public.products set manual_paused=true,needs_review=true,updated_at=now() where id=v_product.id;
  else
   v_result:='applied';
   update public.products set stock=stock-p_quantity,
    status=case when stock=p_quantity then 'sold_out' else status end,
    updated_at=now() where id=v_product.id;
   insert into public.stock_movements(product_id,seller_id,delta,reason,reference_id)
   values(v_product.id,p_seller,-p_quantity,'ebay_sale',left(p_ebay_order||':'||p_ebay_line,150));
  end if;
 end if;
 insert into public.ebay_imported_order_lines(seller_id,ebay_order_id,ebay_line_id,ebay_listing_id,quantity,result)
 values(p_seller,p_ebay_order,p_ebay_line,p_listing,p_quantity,v_result)
 on conflict do nothing;
 return v_result;
end;$$;
revoke all on function public.hcs_apply_ebay_order_line(uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.hcs_apply_ebay_order_line(uuid,text,text,text,integer) to service_role;

-- Lock the listing and reconcile against any site sales still awaiting eBay writeback.
-- Never unpause manually hidden cards and don't erase curated card details.
create or replace function public.hcs_apply_ebay_listing(
 p_seller uuid,p_listing text,p_sku text,p_title text,p_price integer,
 p_quantity integer,p_category text,p_sport text,p_image text,p_back text,
 p_synced_at timestamptz)
returns text language plpgsql security definer set search_path=public as $$
declare v_old public.products%rowtype;v_pending integer;v_hold integer;v_qty integer;
begin
 if p_listing !~ '^[0-9]{9,22}$' or p_price<1 or p_price>100000000 or
    p_quantity<0 or p_quantity>100000 or length(p_title)<2 or length(p_title)>250
 then raise exception 'Invalid eBay listing data';end if;
 select * into v_old from public.products where seller_id=p_seller
  and source='ebay' and source_item_id=p_listing for update;
 select coalesce(sum(sold_quantity),0)::integer into v_pending from public.ebay_sale_outbox
  where seller_id=p_seller and source_item_id=p_listing
  and state in ('pending_connection','pending','processing','needs_review');
 v_qty:=greatest(0,p_quantity-v_pending);
 if not found then null;end if;
 if v_old.id is not null then
  select coalesce(sum(quantity),0)::integer into v_hold from public.inventory_reservations
   where product_id=v_old.id and state='held' and expires_at>now();
  update public.products set
   sku=coalesce(nullif(left(p_sku,120),''),sku),
   title=coalesce(nullif(listing_overrides->>'title',''),left(p_title,250)),
   price_cents=p_price,stock=v_qty,
   status=case when v_qty=0 then 'sold_out'
     when manual_paused then status
     when status in ('archived','paused') then status else 'published' end,
   needs_review=needs_review or v_qty<v_hold,
   manual_paused=manual_paused or v_qty<v_hold,
   category=coalesce(nullif(listing_overrides->>'category',''),left(p_category,120)),
   sport=coalesce(nullif(listing_overrides->>'sport',''),nullif(sport,''),left(p_sport,80),'Other Cards'),
   image_url=coalesce(nullif(p_image,''),image_url),
   back_image_url=coalesce(nullif(p_back,''),back_image_url),
   ebay_url='https://www.ebay.com/itm/'||p_listing,
   last_source_sync=p_synced_at,updated_at=now() where id=v_old.id;
  return case when v_qty<v_hold then 'conflict' else 'updated' end;
 end if;
 insert into public.products(seller_id,source,source_item_id,sku,title,price_cents,stock,status,
   sport,category,image_url,back_image_url,ebay_url,needs_review,last_source_sync)
 values(p_seller,'ebay',p_listing,coalesce(nullif(left(p_sku,120),''),p_listing),
  left(p_title,250),p_price,v_qty,case when v_qty>0 then 'published' else 'sold_out' end,
  coalesce(nullif(left(p_sport,80),''),'Other Cards'),left(p_category,120),nullif(p_image,''),
  nullif(p_back,''),'https://www.ebay.com/itm/'||p_listing,p_image is null or p_image='',p_synced_at)
 on conflict(seller_id,source,source_item_id) do nothing;
 return 'created';
end;$$;
revoke all on function public.hcs_apply_ebay_listing(uuid,text,text,text,integer,integer,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.hcs_apply_ebay_listing(uuid,text,text,text,integer,integer,text,text,text,text,timestamptz) to service_role;
