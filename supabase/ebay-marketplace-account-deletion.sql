-- eBay's Production keys require a Marketplace Account Deletion notification endpoint.
-- Only VERIFIED eBay-signed requests may call the server-only processing function.
alter table public.ebay_connections add column if not exists user_id_hash text;
alter table public.ebay_connections add column if not exists eias_token_hash text;
create table if not exists public.ebay_account_deletion_receipts(
 notification_id text primary key check(length(notification_id) between 5 and 128),
 result text not null default 'processed',
 affected_seller_count integer not null default 0,
 processed_at timestamptz not null default now()
);
alter table public.ebay_account_deletion_receipts enable row level security;
revoke all on public.ebay_account_deletion_receipts from public,anon,authenticated;

create or replace function public.hcs_process_verified_ebay_account_deletion(
 p_notification_id text,
 p_username text,
 p_user_id_hash text,
 p_eias_hash text
) returns integer
language plpgsql security definer set search_path=public as $$
declare
 v_seller uuid;
 v_affected integer:=0;
begin
 if length(coalesce(p_notification_id,''))<5 or length(p_notification_id)>128
    or (coalesce(p_username,'')='' and coalesce(p_user_id_hash,'')='' and coalesce(p_eias_hash,'')='') then
  raise exception 'Invalid signed eBay account-deletion identifiers';
 end if;
 -- A notification ID is applied once, even when eBay retries delivery.
 insert into public.ebay_account_deletion_receipts(notification_id)
 values(p_notification_id) on conflict(notification_id) do nothing;
 if not found then return 0; end if;
 for v_seller in
  select seller_id from public.ebay_connections
  where (coalesce(p_username,'')<>'' and lower(ebay_username)=lower(p_username))
     or (coalesce(p_user_id_hash,'')<>'' and user_id_hash=p_user_id_hash)
     or (coalesce(p_eias_hash,'')<>'' and eias_token_hash=p_eias_hash)
  for update
 loop
  -- Do not delete records retained for legally required payment, tax or shipping obligations.
  -- Unpublish eBay-derived listings and strip eBay account links from the public catalogue.
  update public.products set
    manual_paused=true,
    status=case when status in ('published','paused') then 'paused' else status end,
    ebay_url=null,
    updated_at=now()
  where seller_id=v_seller and source='ebay';
  -- Permanently remove the refresh-token ciphertext from the live database.
  delete from public.ebay_connections where seller_id=v_seller;
  update public.seller_integrations
    set status='disconnected',external_account_id=null,
        configuration='{}'::jsonb,last_error=null,last_successful_sync=null
    where seller_id=v_seller and provider='ebay';
  v_affected:=v_affected+1;
 end loop;
 update public.ebay_account_deletion_receipts set affected_seller_count=v_affected,
   result=case when v_affected>0 then 'deleted_connected_account_data' else 'no_stored_account_match' end,
   processed_at=now()
 where notification_id=p_notification_id;
 return v_affected;
end;$$;
revoke all on function public.hcs_process_verified_ebay_account_deletion(text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.hcs_process_verified_ebay_account_deletion(text,text,text,text) to service_role;
