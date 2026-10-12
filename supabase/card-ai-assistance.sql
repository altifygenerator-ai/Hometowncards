-- Optional, owner-controlled AI card identification. No model calls until API key and explicit feature switch exist.
create table if not exists public.card_ai_inspections(
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references public.sellers(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 actor_user_id uuid references auth.users(id) on delete set null,
 status text not null default 'started' check(status in ('started','completed','failed')),
 model text not null,
 suggested_fields jsonb,
 error_summary text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists card_ai_inspections_seller_day_idx on public.card_ai_inspections(seller_id,created_at desc);
alter table public.card_ai_inspections enable row level security;
create or replace function public.hcs_reserve_card_ai_request(p_seller uuid,p_product uuid,p_actor uuid,p_model text)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_seller::text,42));
 if not exists(select 1 from public.products where seller_id=p_seller and id=p_product)
 then raise exception 'Seller listing not found';end if;
 if (select count(*) from public.card_ai_inspections where seller_id=p_seller and created_at>now()-interval '1 day')>=20
 then raise exception 'Daily identification limit reached';end if;
 insert into public.card_ai_inspections(seller_id,product_id,actor_user_id,model)
 values(p_seller,p_product,p_actor,left(p_model,80)) returning id into result;
 return result;
end;$$;
revoke execute on function public.hcs_reserve_card_ai_request(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.hcs_reserve_card_ai_request(uuid,uuid,uuid,text) to service_role;