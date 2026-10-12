-- Import up to 200 eBay listings in ONE atomic database transaction per page.
-- Prevents a slow loop of 200 HTTPS RPC calls per request.
create or replace function public.hcs_import_ebay_listing_page(
 p_seller uuid,p_items jsonb,p_synced_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row jsonb;v_result text;v_created integer:=0;v_updated integer:=0;v_review integer:=0;
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>200 or
    jsonb_array_length(p_items)=0 then raise exception 'Invalid eBay listing page';end if;
 for v_row in select value from jsonb_array_elements(p_items) loop
  v_result:=public.hcs_apply_ebay_listing(
   p_seller,v_row->>'id',coalesce(v_row->>'sku',''),v_row->>'title',
   (v_row->>'price')::integer,(v_row->>'quantity')::integer,
   coalesce(v_row->>'category',''),coalesce(v_row->>'sport',''),
   coalesce(v_row->>'image',''),coalesce(v_row->>'back',''),p_synced_at
  );
  if v_result='created' then v_created:=v_created+1;
  elsif v_result='conflict' then v_review:=v_review+1;
  else v_updated:=v_updated+1;end if;
 end loop;
 return jsonb_build_object('created',v_created,'updated',v_updated,'review',v_review);
end;$$;
revoke all on function public.hcs_import_ebay_listing_page(uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.hcs_import_ebay_listing_page(uuid,jsonb,timestamptz) to service_role;
