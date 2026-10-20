-- Sports license plates are memorabilia, not card sets, and player parsing
-- should not include generic rookie-prefix descriptors.
update public.products
set card_year='',card_set='',card_number='',player='',updated_at=now()
where source='ebay' and ebay_storefront_kind='sports_plate'
  and (coalesce(card_year,'')<>'' or coalesce(card_set,'')<>'' or
       coalesce(card_number,'')<>'' or coalesce(player,'')<>'');

update public.products
set player=regexp_replace(player,'^(Rated Rookie|Star Rookie|Topps All-Star Rookie|Rookie Prospect|All-Star)[[:space:]]+','','i'),
    updated_at=now()
where source='ebay' and ebay_storefront_kind='card'
  and coalesce(listing_overrides->>'player','')=''
  and player ~* '^(Rated Rookie|Star Rookie|Topps All-Star Rookie|Rookie Prospect|All-Star)[[:space:]]+';

update public.products p set
 team=t.team,updated_at=now()
from (values
 ('Miami Dolphins'),('New York Giants'),('Cincinnati Bengals'),
 ('Jacksonville Jaguars'),('St. Louis Rams'),('Tampa Bay Buccaneers'),
 ('Minnesota Vikings'),('Arizona Cardinals'),('New England Patriots'),
 ('Carolina Panthers'),('New York Jets'),('Chicago Bears'),('Philadelphia Eagles'),
 ('Kansas City Chiefs'),('Seattle Seahawks')
) as t(team)
where p.source='ebay' and p.ebay_storefront_kind='sports_plate'
 and coalesce(p.team,'')='' and p.title ilike '%'||t.team||'%';
