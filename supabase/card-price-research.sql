-- Applied to Hometown Card Shop Supabase as hcs_card_price_research_foundation_20261011.
-- Safe to reapply. Only server service-role code is permitted to write/read these private tables.
create table if not exists public.card_price_research(
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references public.sellers(id) on delete cascade,
 product_id uuid not null,requested_by uuid references auth.users(id) on delete set null,
 status text not null default 'awaiting_sources' check(status in ('awaiting_sources','researching','needs_review','insufficient_sales','ready','failed','cancelled')),
 identity_snapshot jsonb not null default '{}'::jsonb check(jsonb_typeof(identity_snapshot)='object'),
 search_terms text not null default '',target_condition text not null default '',target_grade text not null default '',
 suggested_price_cents integer check(suggested_price_cents is null or suggested_price_cents between 1 and 100000000),
 low_cents integer check(low_cents is null or low_cents between 1 and 100000000),
 high_cents integer check(high_cents is null or high_cents between 1 and 100000000),
 matched_sales integer not null default 0 check(matched_sales>=0),
 confidence text not null default 'insufficient' check(confidence in ('insufficient','low','medium','high')),
 rationale text not null default '',source_summary jsonb not null default '{}'::jsonb check(jsonb_typeof(source_summary)='object'),
 algorithm_version text not null default 'v1',error_summary text,
 completed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint price_research_owning_seller_fk foreign key(product_id,seller_id) references public.products(id,seller_id) on delete cascade
);
create index if not exists card_price_research_seller_date_idx on public.card_price_research(seller_id,created_at desc);
create index if not exists card_price_research_product_idx on public.card_price_research(seller_id,product_id,created_at desc);
alter table public.card_price_research enable row level security;
create table if not exists public.card_price_comparables(
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.card_price_research(id) on delete cascade,
 seller_id uuid not null references public.sellers(id) on delete cascade,
 provider text not null check(provider in ('ebay_sold','sportscardspro','collx','cardmarket','openai_web','manual','other')),
 provider_record_id text,source_url text,card_title text not null default '',
 observed_kind text not null check(observed_kind in ('sold','asking','guide')),
 evidence_status text not null check(evidence_status in ('provider_verified','reported','unverified')),
 observed_at timestamptz,currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
 price_cents integer not null check(price_cents>0 and price_cents<=100000000),
 shipping_cents integer check(shipping_cents is null or shipping_cents between 0 and 100000000),
 grade text not null default '',card_variant text not null default '',condition_notes text not null default '',
 match_score numeric(4,3) not null default 0 check(match_score between 0 and 1),
 match_reason text not null default '',included_in_estimate boolean not null default false,
 evidence_json jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence_json)='object'),
 created_at timestamptz not null default now(),
 constraint card_price_comparables_verified_only check(not included_in_estimate or (observed_kind='sold' and evidence_status='provider_verified' and currency='USD' and observed_at is not null and match_score>=0.900)),
 constraint card_price_comparables_unique_provider_record unique(run_id,provider,provider_record_id)
);
create index if not exists card_price_comps_run_idx on public.card_price_comparables(run_id,created_at desc);
alter table public.card_price_comparables enable row level security;
create or replace function public.hcs_prepare_card_price_research(p_seller uuid,p_product uuid,p_actor uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v record;v_id uuid;v_recent uuid;v_search text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_seller::text,314));
 select id,title,source,source_item_id,card_year,card_set,card_number,sport,player,team,condition,sku,image_url,manual_image_url into v from public.products where seller_id=p_seller and id=p_product;
 if not found then raise exception 'Card does not belong to seller';end if;
 select id into v_recent from public.card_price_research where seller_id=p_seller and product_id=p_product and status in ('awaiting_sources','researching') and created_at>now()-interval '24 hours' order by created_at desc limit 1;
 if v_recent is not null then return v_recent;end if;
 if(select count(*) from public.card_price_research where seller_id=p_seller and created_at>now()-interval '1 day')>=25 then raise exception 'Daily card research preparation limit reached';end if;
 v_search=trim(concat_ws(' ',nullif(v.card_year,''),nullif(v.card_set,''),nullif(v.player,''),nullif(v.card_number,'')));
 if v_search='' then v_search=left(v.title,200);end if;
 insert into public.card_price_research(seller_id,product_id,requested_by,status,identity_snapshot,search_terms,target_condition)
 values(p_seller,p_product,p_actor,'awaiting_sources',
 jsonb_build_object('title',v.title,'source',v.source,'source_item_id',v.source_item_id,'year',v.card_year,'set',v.card_set,'number',v.card_number,'sport',v.sport,'player',v.player,'team',v.team,'condition',v.condition,'sku',v.sku,'photo_available',(v.image_url is not null or v.manual_image_url is not null)),
 left(v_search,400),left(v.condition,100)) returning id into v_id;
 return v_id;
end;$$;
revoke all on function public.hcs_prepare_card_price_research(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.hcs_prepare_card_price_research(uuid,uuid,uuid) to service_role;
create or replace function public.hcs_record_card_price_recommendation(p_seller uuid,p_run uuid,p_price integer,p_low integer,p_high integer,p_count integer,p_confidence text,p_rationale text,p_source_summary jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_price is null or p_price<=0 or p_count<3 or p_confidence not in ('medium','high') then raise exception 'Insufficient pricing evidence';end if;
 if p_low>p_price or p_high<p_price or p_low>p_high then raise exception 'Inconsistent price range';end if;
 if(select count(*) from public.card_price_comparables where seller_id=p_seller and run_id=p_run and included_in_estimate and observed_kind='sold' and evidence_status='provider_verified' and currency='USD' and observed_at>=now()-interval '365 days')<p_count then raise exception 'Verified sold comparable count mismatch';end if;
 update public.card_price_research set status='ready',suggested_price_cents=p_price,low_cents=p_low,high_cents=p_high,matched_sales=p_count,confidence=p_confidence,
 rationale=left(p_rationale,2500),source_summary=coalesce(p_source_summary,'{}'::jsonb),updated_at=now(),completed_at=now()
 where seller_id=p_seller and id=p_run and status in ('awaiting_sources','researching','insufficient_sales','needs_review');
 if not found then raise exception 'Research request unavailable';end if;
end;$$;
revoke all on function public.hcs_record_card_price_recommendation(uuid,uuid,integer,integer,integer,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.hcs_record_card_price_recommendation(uuid,uuid,integer,integer,integer,integer,text,text,jsonb) to service_role;
