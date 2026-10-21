-- Avoid relying on trigger OLD row evaluation for INSERT operations.
create or replace function public.hcs_queue_new_products_email() returns trigger language plpgsql security definer set search_path=public as $$
declare seller_status text; key text; is_newly_eligible boolean;
begin
 if tg_op='INSERT' then
  is_newly_eligible:=true;
 else
  is_newly_eligible:=old.status is distinct from 'published' or old.needs_review is distinct from false or coalesce(old.stock,0)=0;
 end if;
 if new.status='published' and new.needs_review=false and new.stock>0 and is_newly_eligible then
  select status into seller_status from public.sellers where id=new.seller_id;
  if seller_status='approved' then
   key:='products:'||to_char((now() at time zone 'UTC')::date,'YYYY-MM-DD');
   insert into public.marketing_events(event_type,dedupe_key,title,body,href)
   values('new_products',key,'New cards have landed','Fresh finds are on the shelves from Hometown Card Shop and independent sellers. Browse the latest cards and collectibles.','/shop?sort=newest')
   on conflict(dedupe_key) do nothing;
  end if;
 end if;
 return new;
end $$;