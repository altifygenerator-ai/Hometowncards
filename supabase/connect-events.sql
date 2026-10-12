-- Future Stripe Connect accounts: isolated signed webhook inbox, no payouts enabled here.
create table if not exists public.connect_webhook_events(
 id text primary key,
 event_type text not null,
 connected_account_id text not null,
 seller_id uuid references public.sellers(id),
 handling_status text not null check(handling_status in ('updated_account','logged_for_review','unmatched')),
 created_at timestamptz not null default now()
);
alter table public.connect_webhook_events enable row level security;
create index if not exists connect_events_account_idx on public.connect_webhook_events(connected_account_id,created_at desc);

create or replace function public.hcs_record_connect_event(
 p_event_id text,p_event_type text,p_connected_account_id text,
 p_charges_enabled boolean default null,p_payouts_enabled boolean default null
) returns text language plpgsql security definer set search_path=public as $$
declare r record;v_status text;
begin
 if p_event_id not like 'evt_%' or p_connected_account_id not like 'acct_%' then raise exception 'Invalid Stripe event';end if;
 if length(p_event_type)<3 or length(p_event_type)>120 then raise exception 'Invalid event type';end if;
 if exists(select 1 from public.connect_webhook_events where id=p_event_id) then return 'duplicate';end if;
 select seller_id into r from public.seller_payout_accounts
 where provider_account_id=p_connected_account_id for update;
 v_status:=case when r.seller_id is null then 'unmatched'
  when p_event_type in ('account.updated','account.application.deauthorized') then 'updated_account'
  else 'logged_for_review' end;
 if r.seller_id is not null then
  if p_event_type='account.updated' then
   update public.seller_payout_accounts
    set charges_enabled=coalesce(p_charges_enabled,false),
        payouts_enabled=coalesce(p_payouts_enabled,false),
        onboarding_status=case when p_charges_enabled and p_payouts_enabled then 'active' else 'restricted' end,
        updated_at=now()
    where seller_id=r.seller_id;
  elsif p_event_type='account.application.deauthorized' then
   update public.seller_payout_accounts set charges_enabled=false,payouts_enabled=false,
    onboarding_status='restricted',updated_at=now() where seller_id=r.seller_id;
  end if;
 end if;
 insert into public.connect_webhook_events(id,event_type,connected_account_id,seller_id,handling_status)
 values(p_event_id,p_event_type,p_connected_account_id,r.seller_id,v_status);
 return v_status;
end;$$;
revoke execute on function public.hcs_record_connect_event(text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.hcs_record_connect_event(text,text,text,boolean,boolean) to service_role;
