-- Continue to skip order updates for products excluded by the card-only filter.
-- Eliminate a concurrency race: claim the (seller, eBay order, line) key first
-- with a unique insert, BEFORE locking/reducing any stock.
create or replace function public.hcs_apply_ebay_order_line(
 p_seller uuid,p_ebay_order text,p_ebay_line text,p_listing text,p_quantity integer)
returns text language plpgsql security definer set search_path=public as $$
declare v_product public.products%rowtype;v_reserved integer;v_result text;
begin
 if p_ebay_order='' or length(p_ebay_order)>128 or p_ebay_line='' or length(p_ebay_line)>128
  or p_listing !~ '^[0-9]{9,22}$' or p_quantity<1 or p_quantity>10000 then
  raise exception 'Invalid eBay order identity';
 end if;
 insert into public.ebay_imported_order_lines(seller_id,ebay_order_id,ebay_line_id,ebay_listing_id,quantity,result)
 values(p_seller,p_ebay_order,p_ebay_line,p_listing,p_quantity,'missing')
 on conflict(seller_id,ebay_order_id,ebay_line_id) do nothing;
 if not found then return 'duplicate';end if;
 select * into v_product from public.products where seller_id=p_seller and source='ebay'
   and source_item_id=p_listing for update;
 if not found then v_result:='missing';
 elsif v_product.ebay_sync_excluded then v_result:='missing';
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
 update public.ebay_imported_order_lines set result=v_result
   where seller_id=p_seller and ebay_order_id=p_ebay_order and ebay_line_id=p_ebay_line;
 return v_result;
end;$$;
revoke all on function public.hcs_apply_ebay_order_line(uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.hcs_apply_ebay_order_line(uuid,text,text,text,integer) to service_role;

-- Old general-purpose page importer must not bypass the new card-only filter.
revoke execute on function public.hcs_import_ebay_listing_page(uuid,jsonb,timestamptz) from service_role;
