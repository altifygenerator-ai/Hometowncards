alter table public.marketing_events add column if not exists locked_until timestamptz;
create or replace function public.hcs_claim_marketing_event()
returns setof public.marketing_events
language sql
security definer
set search_path=public
as $$
 with next_event as (
  select id from public.marketing_events
  where status in ('queued','sending') and scheduled_for<=now()
    and (locked_until is null or locked_until<now())
  order by scheduled_for,id
  for update skip locked
  limit 1
 )
 update public.marketing_events e
 set status='sending',locked_until=now()+interval '5 minutes'
 from next_event n where e.id=n.id
 returning e.*;
$$;
revoke all on function public.hcs_claim_marketing_event() from public,anon,authenticated;
grant execute on function public.hcs_claim_marketing_event() to service_role;