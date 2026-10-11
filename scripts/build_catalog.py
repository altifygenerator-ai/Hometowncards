#!/usr/bin/env python3
"""Build the initial shop snapshot from an eBay active-listings CSV and CollX image tracker.
Uses standard-library CSV only. eBay item ID is canonical; CollX SKU is a photo join key.
"""
import csv,json,re,sys,os
from pathlib import Path
HERE=Path(__file__).resolve().parents[1]
SRC=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/mnt/data/eBay-all-active-listings-report-2026-10-11-11340682020.csv')
COLLX=Path(sys.argv[2]) if len(sys.argv)>2 else Path('/mnt/data/files/Hometown_Cards_AR_Inventory_Tracker_v6.csv')

TEAM_NAMES={
 'Baseball': ['Arizona Diamondbacks','Atlanta Braves','Baltimore Orioles','Boston Red Sox','Chicago Cubs','Chicago White Sox','Cincinnati Reds','Cleveland Guardians','Cleveland Indians','Colorado Rockies','Detroit Tigers','Houston Astros','Kansas City Royals','Los Angeles Angels','Anaheim Angels','California Angels','Los Angeles Dodgers','Florida Marlins','Miami Marlins','Milwaukee Brewers','Minnesota Twins','New York Mets','New York Yankees','Oakland Athletics','Philadelphia Athletics','Philadelphia Phillies','Pittsburgh Pirates','San Diego Padres','San Francisco Giants','Seattle Mariners','St. Louis Cardinals','Tampa Bay Rays','Tampa Bay Devil Rays','Texas Rangers','Toronto Blue Jays','Washington Nationals','Montreal Expos','Brooklyn Dodgers','New York Giants','Boston Braves','Milwaukee Braves','St. Louis Browns','Washington Senators','Kansas City Athletics'],
 'Football': ['Arizona Cardinals','Atlanta Falcons','Baltimore Ravens','Buffalo Bills','Carolina Panthers','Chicago Bears','Cincinnati Bengals','Cleveland Browns','Dallas Cowboys','Denver Broncos','Detroit Lions','Green Bay Packers','Houston Texans','Indianapolis Colts','Jacksonville Jaguars','Kansas City Chiefs','Las Vegas Raiders','Oakland Raiders','Los Angeles Raiders','Los Angeles Chargers','San Diego Chargers','Los Angeles Rams','St. Louis Rams','Miami Dolphins','Minnesota Vikings','New England Patriots','New Orleans Saints','New York Giants','New York Jets','Philadelphia Eagles','Pittsburgh Steelers','San Francisco 49ers','Seattle Seahawks','Tampa Bay Buccaneers','Tennessee Titans','Houston Oilers','Tennessee Oilers','Washington Commanders','Washington Redskins','Washington Football Team','Washington Wizards'],
 'Basketball':['Atlanta Hawks','Boston Celtics','Brooklyn Nets','New Jersey Nets','Charlotte Hornets','Charlotte Bobcats','Chicago Bulls','Cleveland Cavaliers','Dallas Mavericks','Denver Nuggets','Detroit Pistons','Golden State Warriors','Houston Rockets','Indiana Pacers','Los Angeles Clippers','Los Angeles Lakers','Memphis Grizzlies','Vancouver Grizzlies','Miami Heat','Milwaukee Bucks','Minnesota Timberwolves','New Orleans Pelicans','New Orleans Hornets','New York Knicks','Oklahoma City Thunder','Orlando Magic','Philadelphia 76ers','Phoenix Suns','Portland Trail Blazers','Sacramento Kings','San Antonio Spurs','Toronto Raptors','Utah Jazz','Washington Wizards','Seattle SuperSonics'],
 'Hockey':['Anaheim Ducks','Mighty Ducks of Anaheim','Boston Bruins','Buffalo Sabres','Calgary Flames','Carolina Hurricanes','Chicago Blackhawks','Colorado Avalanche','Columbus Blue Jackets','Dallas Stars','Detroit Red Wings','Edmonton Oilers','Florida Panthers','Los Angeles Kings','Minnesota Wild','Montreal Canadiens','Nashville Predators','New Jersey Devils','New York Islanders','New York Rangers','Ottawa Senators','Philadelphia Flyers','Pittsburgh Penguins','San Jose Sharks','Seattle Kraken','St. Louis Blues','Tampa Bay Lightning','Toronto Maple Leafs','Vancouver Canucks','Vegas Golden Knights','Washington Capitals','Winnipeg Jets','Phoenix Coyotes','Arizona Coyotes','Quebec Nordiques','Hartford Whalers'],
}
SPORT_TAGS={'Baseball':'Baseball','Football':'Football','Basketball':'Basketball','Hockey':'Hockey','Soccer':'Soccer','Wrestling':'Wrestling','NASCAR':'Racing','Racing':'Racing','Golf':'Golf','Tennis':'Tennis','UFC':'MMA','Boxing':'Boxing'}
TEAM_NAMES={k:sorted(v,key=len,reverse=True) for k,v in TEAM_NAMES.items()}

def get_sport(row,meta):
 cat=(meta or {}).get('category','')
 for name,sport in SPORT_TAGS.items():
  if name.casefold() in cat.casefold():return sport
 title=row['Title'];s=title.casefold()
 for sport in ['Baseball','Football','Basketball','Hockey']:
  if f'{sport.lower()} card' in s or re.search(rf'\b{sport.lower()}\b',s):return sport
 # avoid forcing every card to baseball on ambiguous title
 for sport,teams in TEAM_NAMES.items():
  for t in teams:
   if t.casefold() in s:return sport
 if row['eBay category 1 name']=='Trading Card Singles':return 'Other Cards'
 return 'Collectibles'

def get_team(title,sport):
 for team in TEAM_NAMES.get(sport,[]):
  if re.search(r'(?<![a-z])'+re.escape(team)+r'(?![a-z])',title,re.I):return team
 return ''

def get_price(row):
 try:return max(0,int(round(float(row.get('Current price') or row.get('Start price') or 0)*100)))
 except (ValueError,TypeError):return 0

with SRC.open(newline='',encoding='utf-8-sig') as f:ebay=list(csv.DictReader(f))
with COLLX.open(newline='',encoding='utf-8-sig') as f:collx={x['collx_id']:x for x in csv.DictReader(f) if x.get('collx_id')}
items=[]
for row in ebay:
 item_id=row['Item number'].strip();sku=row.get('Custom label (SKU)','').strip();meta=collx.get(sku)
 sport=get_sport(row,meta);title=row['Title'].strip();year=meta.get('year','') if meta else ''
 if not year:
  m=re.search(r'(?<!\d)(?:19[4-9]\d|20[0-2]\d)(?!\d)',title)
  year=m.group() if m else ''
 im1=(meta or {}).get('front_image','').strip();im2=(meta or {}).get('back_image','').strip()
 # Only use image URLs that identify the matching CollX record, never other products' photos.
 if not im1.startswith('https://'):im1=''
 if not im2.startswith('https://'):im2=''
 p={'id':item_id,'title':title,'price':get_price(row),'quantity':int(row['Available quantity'] or 0),
 'sport':sport,'team':get_team(title,sport),'player':(meta or {}).get('name','').strip(),
 'year':year,'set':(meta or {}).get('set','').strip(),'number':(meta or {}).get('number','').strip(),
 'image':im1,'backImage':im2,'sku':sku or item_id,'condition':row.get('Condition','').strip(),
 'ebayUrl':f'https://www.ebay.com/itm/{item_id}','category':row['eBay category 1 name'].strip()}
 items.append(p)
assert len(items)==len(ebay)
assert len({p['id'] for p in items})==len(items)
assert sum(bool(p['image']) for p in items)>=3200
(HERE/'lib'/'products.json').write_text(json.dumps(items,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
from collections import Counter
print(json.dumps({'items':len(items),'photos':sum(bool(i['image']) for i in items),'sport':Counter(i['sport'] for i in items),'teamsFound':sum(bool(i['team']) for i in items),'yearFound':sum(bool(i['year']) for i in items)},indent=2))
