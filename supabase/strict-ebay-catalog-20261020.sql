-- Only trading cards and sports-themed decorative license plates are permitted
-- on the eBay-sourced storefront. Everything else is hidden locally (never deleted
-- from eBay or from order-history tables). Manual and CSV listings remain untouched.
alter table public.products add column if not exists ebay_storefront_kind text
 check(ebay_storefront_kind in ('card','sports_plate','excluded','review'));

create or replace function public.hcs_ebay_storefront_kind(p_cat text,p_title text)
returns text language plpgsql immutable set search_path=public as $$
declare t text:=coalesce(p_title,''); cat text:=coalesce(p_cat,'');
begin
 if t='' then return 'review';end if;
 -- Sports license plates (NOT automobile tag stock, music plates or other signs).
 if t ~* '(licen[cs]e[[:space:]-]*plate|football[[:space:]-]*car[[:space:]-]*tag)' then
  if t ~* '(NFL|MLB|NBA|NHL|NCAA|football|baseball|basketball|hockey|soccer|sports?|Dolphins|Giants|Bengals|Jaguars|Rams|Buccaneers|Vikings|Cardinals|Patriots|Panthers|Jets|Bears|Eagles|Chiefs|Seahawks|Packers|Steelers|Cowboys|Broncos|Raiders|49ers|Chargers|Falcons|Bills|Browns|Colts|Lions|Ravens|Saints|Titans|Texans|Commanders|Redskins|Washington)'
   then return 'sports_plate';end if;
  return 'excluded';
 end if;
 -- Do not treat a novel, DVD, computer game, sign or other non-card item
 -- as a card merely because a collectible brand/player appears in the title.
 if t ~* '(DVD|VHS|CD-ROM|video[[:space:]-]*game|novel|hardcover|paperback|heatsink|cpu[[:space:]-]*fan|cooling[[:space:]-]*fan|laptop|controller|console|comic[[:space:]-]*book|magazine|poster|thermometer|bottle|glassware|lamp|potholder|embroidered[[:space:]-]*patch|booster[[:space:]-]*amplifier|recipe[[:space:]-]*box|card[[:space:]-]*storage[[:space:]-]*box|deck[[:space:]-]*box)'
 then return 'excluded';end if;
 -- Primary eBay trading card categories.
 if cat in ('261328','261329','261330','261331','183050','183051','183052','183053',
            '183454','183455','183456','183459') then return 'card';end if;
 -- GetMyeBaySelling does NOT guarantee PrimaryCategory.CategoryID on output.
 -- In that case use strict recognizable trading card title conventions.
 if t ~* '^(18|19|20)[0-9]{2}[[:space:]-]+.*#[[:space:]]*[A-Za-z0-9-]{1,12}([[:space:]]|$|[),.])'
    or t ~* '^(18|19|20)[0-9]{2}[[:space:]-]+.*(Topps|Donruss|Fleer|Upper Deck|Score|Bowman|Panini|Pro Set|Leaf|O-Pee-Chee|Select|Prizm|Hoops|Stadium Club|SkyBox)[[:space:]-]'
    or t ~* '(baseball|football|basketball|hockey|soccer|pokemon|pokémon|yugioh|yu-gi-oh|mtg|magic the gathering)[[:space:]-]+(trading[[:space:]-]+)?card(s)?([[:space:]#,.]|$)'
    or t ~* '(sports trading card|ccg individual card|trading card single|trading card lot)'
 then return 'card';end if;
 -- Known non-card eBay categories shouldn't get added by a fuzzy sports title.
 if cat ~ '^[0-9]{1,9}$' then return 'excluded';end if;
 return 'review'; -- hidden until a category or explicit card details confirm it
end;$$;

create or replace function public.hcs_ebay_title_year(p_title text)
returns text language sql immutable as $$
 select case when substring(p_title from '^((18|19|20)[0-9]{2})')::integer
              between 1850 and 2027
   then substring(p_title from '^((18|19|20)[0-9]{2})') else '' end
$$;
create or replace function public.hcs_ebay_title_set(p_title text)
returns text language sql immutable as $$
 select left(coalesce(substring(p_title from '^(?:18|19|20)[0-9]{2}[[:space:]-]+(.+?)[[:space:]]-[[:space:]]+'),''),120)
$$;
create or replace function public.hcs_ebay_title_number(p_title text)
returns text language sql immutable as $$
 select left(coalesce(substring(p_title from '#[[:space:]]*([A-Za-z0-9-]{1,12})'),''),40)
$$;
create or replace function public.hcs_ebay_title_player(p_title text)
returns text language sql immutable as $$
 select left(coalesce(substring(p_title from '[[:space:]]-[[:space:]]+(.+?)[[:space:]]+#[[:space:]]*[A-Za-z0-9-]{1,12}'),''),120)
$$;

-- Re-evaluate all *existing* linked listings from their actual saved titles.
-- Keeps historical records and manual pauses; only public visibility changes.
with classified as (
 select id,public.hcs_ebay_storefront_kind(ebay_category_id,title) as kind
 from public.products where source='ebay'
)
update public.products p set
 ebay_storefront_kind=c.kind,
 ebay_sync_excluded=case when c.kind in ('excluded','review') then true else false end,
 manual_paused=case when c.kind in ('excluded','review') then true else p.manual_paused end,
 status=case when c.kind in ('excluded','review') and p.status='published' then 'paused' else p.status end,
 sport=case when c.kind='sports_plate' then 'Memorabilia' else p.sport end,
 category=case when c.kind='sports_plate' then 'Sports License Plates'
               when c.kind='card' and coalesce(p.category,'')='' then 'Trading Cards' else p.category end,
 card_year=case when c.kind='card' and coalesce(p.card_year,'')='' and
                   coalesce(p.listing_overrides->>'card_year','')='' then
                     public.hcs_ebay_title_year(p.title) else p.card_year end,
 card_set=case when c.kind='card' and coalesce(p.card_set,'')='' and
                   coalesce(p.listing_overrides->>'card_set','')='' then
                     public.hcs_ebay_title_set(p.title) else p.card_set end,
 card_number=case when c.kind='card' and coalesce(p.card_number,'')='' and
                   coalesce(p.listing_overrides->>'card_number','')='' then
                     public.hcs_ebay_title_number(p.title) else p.card_number end,
 player=case when c.kind='card' and coalesce(p.player,'')='' and
                   coalesce(p.listing_overrides->>'player','')='' then
                     public.hcs_ebay_title_player(p.title) else p.player end,
 updated_at=now()
from classified c where p.id=c.id;

-- The server determines the actual product type. No direct public RPC permissions.
create or replace function public.hcs_reconcile_ebay_cards_page(
 p_seller uuid,p_items jsonb,p_synced_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb;kind text;cat text;item_id text;row_result text;
 added integer:=0;updated integer:=0;hidden integer:=0;reviewed integer:=0;plates integer:=0;
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
   if row_result='created' then added:=added+1;else updated:=updated+1;end if;
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
   'review',reviewed,'memorabilia',plates,'ignored',0,'unknown',reviewed);
end;$$;

revoke all on function public.hcs_reconcile_ebay_cards_page(uuid,jsonb,timestamptz)
 from public,anon,authenticated;
grant execute on function public.hcs_reconcile_ebay_cards_page(uuid,jsonb,timestamptz) to service_role;
