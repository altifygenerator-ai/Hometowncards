-- The importer now reconciles eBay categories, NOT every item from the seller's account.
-- Never delete, end, or revise an eBay listing as part of filtering. Non-card site imports
-- are paused, even if they were imported before category IDs were saved.
alter table public.products add column if not exists ebay_category_id text;
alter table public.products add column if not exists ebay_sync_excluded boolean not null default false;

create or replace function public.hcs_reconcile_ebay_cards_page(
 p_seller uuid,p_items jsonb,p_synced_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_row jsonb;v_result text;v_id text;v_cat text;v_created int:=0;
 v_updated int:=0;v_review int:=0;v_excluded int:=0;v_unmatched int:=0;
 v_skipped int:=0;
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>200 or
  jsonb_array_length(p_items)=0 then raise exception 'Invalid eBay listing import page'; end if;
 for v_row in select value from jsonb_array_elements(p_items) loop
  v_id:=v_row->>'id';
  v_cat:=coalesce(v_row->>'categoryId','');
  if v_id !~ '^[0-9]{9,22}$' then raise exception 'Invalid eBay item ID'; end if;
  if v_cat in ('261328','261329','261330','261331',
    '183050','183051','183052','183053',
    '183454','183455','183456','183459') then
   if coalesce(v_row->>'title','')='' then
    raise exception 'A permitted card listing has missing details';end if;
   v_result:=public.hcs_apply_ebay_listing(
    p_seller,v_id,coalesce(v_row->>'sku',''),v_row->>'title',
    (v_row->>'price')::integer,(v_row->>'quantity')::integer,
    coalesce(v_row->>'category',''),coalesce(v_row->>'sport',''),
    coalesce(v_row->>'image',''),coalesce(v_row->>'back',''),p_synced_at);
   update public.products
    set ebay_category_id=v_cat,ebay_sync_excluded=false
    where seller_id=p_seller and source='ebay' and source_item_id=v_id;
   if v_result='created' then v_created:=v_created+1;
   elsif v_result='conflict' then v_review:=v_review+1;
   else v_updated:=v_updated+1;end if;
  elsif v_cat ~ '^[0-9]{1,9}$' then
   -- A valid, different eBay category: hide any existing site copy.
   -- This does NOT touch eBay itself. Never touch manually created/CSV cards.
   update public.products set status='paused',manual_paused=true,
     ebay_category_id=v_cat,ebay_sync_excluded=true,updated_at=now()
    where seller_id=p_seller and source='ebay' and source_item_id=v_id
     and status in ('published','paused');
   if found then v_excluded:=v_excluded+1;
   else v_unmatched:=v_unmatched+1;end if;
  else
   -- No category identity: do not guess and do not hide the old product.
   v_skipped:=v_skipped+1;
  end if;
 end loop;
 return jsonb_build_object('created',v_created,'updated',v_updated,
  'review',v_review,'excluded',v_excluded,'ignored',v_unmatched,'unknown',v_skipped);
end;$$;

revoke all on function public.hcs_reconcile_ebay_cards_page(uuid,jsonb,timestamptz)
 from public,anon,authenticated;
grant execute on function public.hcs_reconcile_ebay_cards_page(uuid,jsonb,timestamptz)
 to service_role;
