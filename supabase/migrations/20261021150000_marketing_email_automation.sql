-- Durable, consent-based Hometown Card Shop email automation.
create table if not exists public.marketing_subscribers (
 id uuid primary key default gen_random_uuid(),
 email text not null unique,
 status text not null default 'pending' check (status in ('pending','active','unsubscribed')),
 consent_source text not null,
 consent_at timestamptz not null default now(),
 confirmed_at timestamptz,
 confirmation_hash text,
 confirmation_expires_at timestamptz,
 unsubscribe_hash text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.marketing_events (
 id uuid primary key default gen_random_uuid(),
 event_type text not null check (event_type in ('new_seller','new_products','promo')),
 dedupe_key text not null unique,
 title text not null,
 body text not null,
 href text not null,
 scheduled_for timestamptz not null default now(),
 status text not null default 'queued' check (status in ('queued','sending','sent','cancelled')),
 cursor_subscriber_id uuid,
 created_at timestamptz not null default now(),
 sent_at timestamptz
);
create table if not exists public.marketing_deliveries (
 event_id uuid not null references public.marketing_events(id) on delete cascade,
 subscriber_id uuid not null references public.marketing_subscribers(id) on delete cascade,
 status text not null check (status in ('sent','failed')),
 sent_at timestamptz not null default now(),
 primary key(event_id,subscriber_id)
);
alter table public.marketing_subscribers enable row level security;
alter table public.marketing_events enable row level security;
alter table public.marketing_deliveries enable row level security;
revoke all on public.marketing_subscribers,public.marketing_events,public.marketing_deliveries from anon,authenticated;
grant all on public.marketing_subscribers,public.marketing_events,public.marketing_deliveries to service_role;
create index if not exists marketing_events_queue_idx on public.marketing_events(status,scheduled_for);
create index if not exists marketing_subscribers_active_idx on public.marketing_subscribers(status,id);
create or replace function public.hcs_queue_new_seller_email() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.status='approved' and old.status is distinct from 'approved' and coalesce(new.is_founding_seller,false)=false then
  insert into public.marketing_events(event_type,dedupe_key,title,body,href)
  values('new_seller','seller:'||new.id::text,new.display_name,
    'A new independent card shop has joined the Hometown Card Shop marketplace. Stop by to see what they have brought to the counter.',
    '/sellers/'||new.slug)
  on conflict(dedupe_key) do nothing;
 end if;
 return new;
end $$;
drop trigger if exists hcs_new_seller_marketing on public.sellers;
create trigger hcs_new_seller_marketing after update of status on public.sellers for each row execute function public.hcs_queue_new_seller_email();
create or replace function public.hcs_queue_new_products_email() returns trigger language plpgsql security definer set search_path=public as $$
declare seller_status text; key text;
begin
 if new.status='published' and new.needs_review=false and new.stock>0
   and (tg_op='INSERT' or old.status is distinct from 'published' or old.needs_review is distinct from false or coalesce(old.stock,0)=0) then
  select status into seller_status from public.sellers where id=new.seller_id;
  if seller_status='approved' then
   key:='products:'||to_char((now() at time zone 'UTC')::date,'YYYY-MM-DD');
   insert into public.marketing_events(event_type,dedupe_key,title,body,href)
   values('new_products',key,'New cards have landed',
     'Fresh finds are on the shelves from Hometown Card Shop and independent sellers. Browse the latest cards and collectibles.',
     '/shop?sort=newest')
   on conflict(dedupe_key) do nothing;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists hcs_new_products_marketing on public.products;
create trigger hcs_new_products_marketing after insert or update of status,needs_review,stock on public.products for each row execute function public.hcs_queue_new_products_email();