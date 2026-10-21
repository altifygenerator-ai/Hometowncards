/**
 * Derive navigation facets from real eBay item specifics where available,
 * otherwise from explicit card-title structure. Never fabricate a team or player.
 */
const teams=[
'New York Yankees','Boston Red Sox','New York Mets','Los Angeles Dodgers','Chicago Cubs',
'Chicago White Sox','St. Louis Cardinals','San Francisco Giants','Atlanta Braves',
'Philadelphia Phillies','Cincinnati Reds','Pittsburgh Pirates','San Diego Padres',
'Seattle Mariners','Toronto Blue Jays','Baltimore Orioles','Detroit Tigers',
'Cleveland Indians','Cleveland Guardians','Minnesota Twins','Kansas City Royals',
'Oakland Athletics','Miami Marlins','Florida Marlins','Tampa Bay Rays','Tampa Bay Devil Rays',
'Los Angeles Angels','California Angels','Texas Rangers','Houston Astros',
'Arizona Diamondbacks','Colorado Rockies','Milwaukee Brewers','Montreal Expos',
'Green Bay Packers','Chicago Bears','New York Giants','New York Jets','Dallas Cowboys',
'Philadelphia Eagles','Washington Redskins','Washington Commanders','San Francisco 49ers',
'Los Angeles Rams','St. Louis Rams','Carolina Panthers','Atlanta Falcons',
'New Orleans Saints','Tampa Bay Buccaneers','Seattle Seahawks','Arizona Cardinals',
'New England Patriots','Miami Dolphins','Buffalo Bills','Pittsburgh Steelers',
'Baltimore Ravens','Cincinnati Bengals','Cleveland Browns','Indianapolis Colts',
'Houston Texans','Tennessee Titans','Jacksonville Jaguars','Kansas City Chiefs',
'Las Vegas Raiders','Oakland Raiders','Los Angeles Chargers','San Diego Chargers',
'Denver Broncos','Minnesota Vikings','Detroit Lions',
'Los Angeles Lakers','Boston Celtics','Chicago Bulls','New York Knicks',
'Golden State Warriors','Miami Heat','San Antonio Spurs','Dallas Mavericks',
'Phoenix Suns','Houston Rockets','Philadelphia 76ers','Milwaukee Bucks',
'Cleveland Cavaliers','Toronto Raptors','Denver Nuggets','Brooklyn Nets',
'New Jersey Nets','Seattle SuperSonics','Oklahoma City Thunder','Los Angeles Clippers',
'Portland Trail Blazers','Utah Jazz','Sacramento Kings','Detroit Pistons',
'Indiana Pacers','Orlando Magic','Atlanta Hawks','Charlotte Hornets',
'New Orleans Pelicans','Washington Wizards','Minnesota Timberwolves',
'Memphis Grizzlies',
];
const sportLabels=['Baseball','Football','Basketball','Hockey','Soccer','Golf','Racing','Wrestling'];
const sportAliases:Record<string,string>={
'Ice Hockey':'Hockey','Auto Racing':'Racing','NASCAR':'Racing',
'Wrestling':'Wrestling','Pokémon':'Pokémon','Pokemon':'Pokémon',
'Magic: The Gathering':'Magic','Magic The Gathering':'Magic','MTG':'Magic','Yu-Gi-Oh!':'Yu-Gi-Oh!',
'Yu Gi Oh':'Yu-Gi-Oh!','One Piece':'One Piece','One Piece Card Game':'One Piece'
};
type Details={sport:string;team:string;player:string;year:string;cardSet:string;cardNumber:string};
export function ebayListingMetadata(title:string,aspects:Record<string,string>={}):Details{
 const at=(...keys:string[])=>{
  for(const k of keys){
   const found=Object.entries(aspects).find(([name,value])=>
    name.toLowerCase()===k.toLowerCase()&&value.trim());
   if(found)return found[1].trim();
  }
  return '';
 };
 const exactSport=at('Sport','Game','Game Name');
 const inferredGame=/\b(pok[eé]mon|pokemon tcg)\b/i.test(title)?'Pokémon':
  /\b(magic[: ]+the gathering|mtg)\b/i.test(title)?'Magic':
  /\b(yu[ -]?gi[ -]?oh)\b/i.test(title)?'Yu-Gi-Oh!':
  /\bone piece (tcg|card game|trading card)\b/i.test(title)?'One Piece':'';
 const sport= sportAliases[exactSport]||
   (sportLabels.find(s=>s.toLowerCase()===exactSport.toLowerCase())||inferredGame);
 const team=at('Team','Team Name','Franchise')||
  (teams.find(t=>title.toLowerCase().includes(t.toLowerCase()))||'');
 // eBay describes the card's year often as "Season", while year can also
 // mean when an item was produced. Respect explicit season before title fallback.
 const season=at('Season','Year Manufactured','Year');
 const yearMatch=/^(18|19|20)\d{2}/.exec(season)||
   /^(18|19|20)\d{2}(?=\s|-)/.exec(title.trim());
 const year=yearMatch?yearMatch[0]:'';
 const setFromTitle=/^(?:18|19|20)\d{2}[\s-]+(.+?)\s+-\s+/.exec(title);
 const cardSet=at('Set','Card Set')||(setFromTitle?.[1]||'');
 const number=at('Card Number','Card #')||(/#\s*([A-Za-z0-9-]{1,12})/.exec(title)?.[1]||'');
 const rawPlayer=at('Player/Athlete','Player','Character')||
   (/\s+-\s+(.+?)\s+#\s*[A-Za-z0-9-]{1,12}/.exec(title)?.[1]||'');
 const player=rawPlayer.replace(/^(?:Rated Rookie|Star Rookie|Topps All-Star Rookie|Rookie Prospect|All-Star)\s+/i,'').trim();
 return {sport,team,player:player.slice(0,120),year,
  cardSet:cardSet.slice(0,120),cardNumber:number.slice(0,40)};
}
export function ebayItemAspects(item:Record<string,unknown>):Record<string,string>{
 const specifics=item.ItemSpecifics as Record<string,unknown>|undefined;
 const values=specifics?.NameValueList;
 const pairs=Array.isArray(values)?values:values?[values]:[];
 const output:Record<string,string>={};
 for(const p of pairs){
  if(!p||typeof p!=='object')continue;
  const entry=p as Record<string,unknown>;
  const name=String(entry.Name||'').trim();
  const value=entry.Value;
  const text=Array.isArray(value)?value.map(String).join(', '):String(value??'').trim();
  if(name&&text&&text.length<240)output[name]=text;
 }
 return output;
}
