-- Applied to Hometown Card Shop production 2026-10-11.
-- Purchase: card + penny sleeve + toploader (~0.30 oz).
-- Free common: card + penny sleeve (~0.08 oz).
-- Letter packaging: paper + envelope + tape (~0.40 oz); parcel packaging 1.00 oz.
alter table public.shipping_profiles
 add column if not exists bonus_item_weight_oz numeric(8,3) not null default 0.080
 check(bonus_item_weight_oz>0 and bonus_item_weight_oz<10);
update public.shipping_profiles p
 set default_item_weight_oz=0.300,bonus_item_weight_oz=0.080,
 packaging_weight_oz=case when p.shipping_class='economy' then .400 else 1.000 end
from public.sellers s where p.seller_id=s.id and s.slug='hometown-card-shop'
 and p.name in ('Economy letter up to 1 oz','Economy letter up to 2 oz','Economy letter up to 3.5 oz','Tracked parcel up to 16 oz','Insured parcel up to $500','Insured parcel up to $1,000');
update public.shipping_profiles p set active=true
from public.sellers s where p.seller_id=s.id and s.slug='hometown-card-shop'
and p.name in ('Economy letter up to 1 oz','Economy letter up to 2 oz','Economy letter up to 3.5 oz','Tracked parcel up to 16 oz','Insured parcel up to $500','Insured parcel up to $1,000');
-- Keep quote and checkout in agreement: modify last checkout RPC via safe exact-string replacements.
do $do$
declare f text;
begin
select pg_get_functiondef('public.hcs_begin_checkout(jsonb,text,uuid)'::regprocedure) into f;
if strpos(f,'v_item_weight numeric:=0;')=0 then raise exception 'Missing existing item weight variable';end if;
f:=replace(f,'v_item_weight numeric:=0;','v_item_weight numeric:=0;v_requires_parcel boolean:=false;v_is_special boolean:=false;');
f:=replace(f,'v_item_weight:=v_item_weight+v_quantities[v_index]*coalesce(v_product.weight_oz,0);',
$replacement$v_is_special:=v_product.title ~* '(^|[^a-z])(psa|bgs|sgc|cgc|graded|slab|booster|sealed|blaster|hobby box)([^a-z]|$)'
or v_product.category ~* '(^|[^a-z])(graded|sealed|packs|boxes)([^a-z]|$)';
v_requires_parcel:=v_requires_parcel or v_is_special;
v_item_weight:=v_item_weight+v_quantities[v_index]*
(case when v_is_special then greatest(coalesce(v_product.weight_oz+0.24,4.00),4.00)
else greatest(coalesce(v_product.weight_oz+0.24,0.30),0.30) end);$replacement$);
f:=replace(f,$old$v_weight:=v_profile.packaging_weight_oz
    +(v_bought+v_bonus)*v_profile.default_item_weight_oz;$old$,
$new$v_weight:=round((v_profile.packaging_weight_oz+greatest(v_item_weight,v_bought*v_profile.default_item_weight_oz)
    +v_bonus*v_profile.bonus_item_weight_oz)::numeric,3);$new$);
f:=replace(f,$old$if v_profile.shipping_class='economy' and (v_weight>3.5 or v_profile.tracking_included) then continue;end if;$old$,
$new$if v_profile.shipping_class='economy'
 and (v_weight>3.5 or v_profile.tracking_included or v_bought>2 or v_requires_parcel)
 then continue;end if;$new$);
if strpos(f,'v_bonus*v_profile.bonus_item_weight_oz')=0
 or strpos(f,'v_bought>2 or v_requires_parcel')=0 then raise exception 'Checkout weight migration did not match';end if;
execute f;
end;
$do$;
