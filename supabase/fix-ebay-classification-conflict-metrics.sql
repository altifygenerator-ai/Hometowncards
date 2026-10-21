-- Separate verified inventory-reservation stock conflicts from
-- unrelated eBay listings held for category review. The two outcomes
-- must never share a misleading stock warning.
CREATE OR REPLACE FUNCTION public.hcs_reconcile_ebay_cards_page(p_seller uuid, p_items jsonb, p_synced_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r jsonb;kind text;cat text;item_id text;row_result text;
 added integer:=0;updated integer:=0;hidden integer:=0;reviewed integer:=0;plates integer:=0;conflicts integer:=0;
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>200 or
    jsonb_array_length(p_items)=0 then raise exception 'Invalid eBay page';end if;
 for r in select value from jsonb_array_elements(p_items) loop
  item_id:=coalesce(r->>'id','');
  if item_id !~ '^[0-9]{9,22}$' then raise exception 'Invalid eBay listing ID';end if;
  cat:=coalesce(r->>'categoryId','');
  -- Preserve an earlier confirmed ID if the reduced eBay response omits it.
  if cat='' then
   select coalesce(ebay_category_id,'') into cat from public.products
    where seller_id=p_seller and source='ebay' and source_item_id=item_id;
  end if;
  kind:=public.hcs_ebay_storefront_kind(cat,r->>'title');
  if kind in ('card','sports_plate') then
   if coalesce(r->>'title','')='' or (r->>'price')::integer<1 or
     (r->>'quantity')::integer<0 then
    raise exception 'Verified allowed item is missing listing details';end if;
   row_result:=public.hcs_apply_ebay_listing(
      p_seller,item_id,coalesce(r->>'sku',''),r->>'title',
      (r->>'price')::integer,(r->>'quantity')::integer,
      coalesce(r->>'category',''),coalesce(r->>'sport',''),
      coalesce(r->>'image',''),coalesce(r->>'back',''),p_synced_at);
   update public.products set
      ebay_storefront_kind=kind,ebay_sync_excluded=false,
      ebay_category_id=nullif(cat,''),
      sport=case when kind='sports_plate' then 'Memorabilia'
        when coalesce(listing_overrides->>'sport','')<>'' then sport
        when coalesce(r->>'sport','') not in ('','Other Cards') then r->>'sport'
        else sport end,
      category=case when kind='sports_plate' then 'Sports License Plates'
                    when coalesce(category,'')='' then 'Trading Cards' else category end,
      card_year=case when kind='card' and coalesce(listing_overrides->>'card_year','')=''
        then coalesce(nullif(r->>'year',''),nullif(card_year,''),public.hcs_ebay_title_year(title)) else card_year end,
      card_set=case when kind='card' and coalesce(listing_overrides->>'card_set','')=''
        then coalesce(nullif(r->>'cardSet',''),nullif(card_set,''),public.hcs_ebay_title_set(title)) else card_set end,
      card_number=case when kind='card' and coalesce(listing_overrides->>'card_number','')=''
        then coalesce(nullif(r->>'cardNumber',''),nullif(card_number,''),public.hcs_ebay_title_number(title)) else card_number end,
      player=case when kind='card' and coalesce(listing_overrides->>'player','')=''
        then coalesce(nullif(r->>'player',''),nullif(player,''),public.hcs_ebay_title_player(title)) else player end,
      team=case when coalesce(listing_overrides->>'team','')='' and coalesce(team,'')=''
        then coalesce(r->>'team','') else team end
    where seller_id=p_seller and source='ebay' and source_item_id=item_id;
   if row_result='created' then added:=added+1;
   elsif row_result='conflict' then conflicts:=conflicts+1;
   else updated:=updated+1;end if;
   if kind='sports_plate' then plates:=plates+1;end if;
  else
   update public.products set
    ebay_storefront_kind=kind,ebay_sync_excluded=true,manual_paused=true,
    status=case when status='published' then 'paused' else status end,
    ebay_category_id=coalesce(nullif(cat,''),ebay_category_id),
    updated_at=now()
   where seller_id=p_seller and source='ebay' and source_item_id=item_id;
   if kind='review' then reviewed:=reviewed+1;else hidden:=hidden+1;end if;
  end if;
 end loop;
 return jsonb_build_object('created',added,'updated',updated,'excluded',hidden,
   'review',conflicts,'memorabilia',plates,'ignored',0,'unknown',reviewed);
end;$function$

