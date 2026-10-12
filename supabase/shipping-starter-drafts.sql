-- Shipping prices are DRAFTS for the founding seller, not live carrier quotes.
-- USPS Notice 123 effective 2026-10-04. Nonmachinable letter fee and package postage vary.
-- Keep all profiles inactive until packing tests and actual labels confirm cost.
with founder as (select id from public.sellers where slug='hometown-card-shop' and is_founding_seller and status='approved')
update public.shipping_profiles p set
 name='Economy letter up to 3.5 oz',service_label='Economy letter (no tracking)',
 base_cents=299,additional_item_cents=0,max_weight_oz=3.5,max_items=8,
 packaging_weight_oz=0.4,default_item_weight_oz=0.15,
 shipping_class='economy',tracking_included=false,insurance_coverage_cents=0,
 max_order_value_cents=1999,active=false,
 notes='DRAFT: USPS First-Class stamped or nonmachinable letter, only if flexible/uniform/<=1/4 inch thick. Check actual postage, not eBay Standard Envelope.'
where seller_id in (select id from founder) and name='Economy letter' and base_cents=0 and not active;
with founder as (select id from public.sellers where slug='hometown-card-shop' and is_founding_seller and status='approved')
update public.shipping_profiles p set
 name='Tracked parcel up to 16 oz',service_label='USPS Ground Advantage (tracked)',
 base_cents=899,additional_item_cents=0,max_weight_oz=15.99,max_items=80,
 packaging_weight_oz=1,default_item_weight_oz=0.15,
 shipping_class='tracked',tracking_included=true,insurance_coverage_cents=10000,
 active=false,notes='DRAFT: 2026 seasonal USPS Ground Advantage prices vary by zone; compare Pirate Ship commercial/Connect eCommerce rate before enabling.'
where seller_id in (select id from founder) and name='Tracked parcel' and base_cents=0 and not active;
with founder as (select id from public.sellers where slug='hometown-card-shop' and is_founding_seller and status='approved')
update public.shipping_profiles p set
 name='Insured parcel up to $500',service_label='Tracked parcel with up to $500 coverage',
 base_cents=1299,additional_item_cents=0,max_weight_oz=15.99,max_items=80,
 packaging_weight_oz=1,default_item_weight_oz=0.15,
 shipping_class='insured',tracking_included=true,insurance_coverage_cents=50000,
 min_order_value_cents=10001,active=false,
 notes='DRAFT: Must buy real additional insurance on label before shipment, estimate may differ by destination and coverage.'
where seller_id in (select id from founder) and name='Insured tracked parcel' and base_cents=0 and not active;
with founder as (select id from public.sellers where slug='hometown-card-shop' and is_founding_seller and status='approved')
insert into public.shipping_profiles(seller_id,name,service_label,active,base_cents,additional_item_cents,
 max_weight_oz,max_items,packaging_weight_oz,default_item_weight_oz,allows_bonus_cards,
 shipping_class,tracking_included,insurance_coverage_cents,max_order_value_cents,notes,sort_order)
select id,'Economy letter up to 1 oz','Economy letter (1 oz · no tracking)',false,199,0,
 1,4,0.4,0.15,true,'economy',false,0,1999,
 'DRAFT $1.99. 2026 postage $0.82 + $0.49 nonmachinable if needed + packaging. Must fit letter dimensions, rigidity and thickness limits.',0 from founder
on conflict(seller_id,name) do nothing;
with founder as (select id from public.sellers where slug='hometown-card-shop' and is_founding_seller and status='approved')
insert into public.shipping_profiles(seller_id,name,service_label,active,base_cents,additional_item_cents,
 max_weight_oz,max_items,packaging_weight_oz,default_item_weight_oz,allows_bonus_cards,
 shipping_class,tracking_included,insurance_coverage_cents,max_order_value_cents,notes,sort_order)
select id,'Economy letter up to 2 oz','Economy letter (2 oz · no tracking)',false,249,0,
 2,7,0.4,0.15,true,'economy',false,0,1999,
 'DRAFT $2.49. 2026 2oz USPS $1.11 + $0.49 nonmachinable if needed + packaging; must physically qualify.',1 from founder
on conflict(seller_id,name) do nothing;
-- Premium choice for buyers preferring tracking on a small order. 
-- Draft price covers rate variation by distance but must be checked before enabling.
with founder as (select id from public.sellers where slug='hometown-card-shop' and is_founding_seller and status='approved')
insert into public.shipping_profiles(seller_id,name,service_label,active,base_cents,additional_item_cents,
 max_weight_oz,max_items,packaging_weight_oz,default_item_weight_oz,allows_bonus_cards,
 shipping_class,tracking_included,insurance_coverage_cents,notes,sort_order)
select id,'Insured parcel up to $1,000','Tracked parcel with up to $1,000 coverage',false,1599,0,
 15.99,80,1,0.15,true,'insured',true,100000,
 'DRAFT: Purchase actual label insurance for order value, policy exclusions and claim rules apply.',30 from founder
on conflict(seller_id,name) do nothing;
-- Seller can enable only after entering verified shipping costs; checkout still off.
