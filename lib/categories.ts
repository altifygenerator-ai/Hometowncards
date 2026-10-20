import type {Product} from './catalog';
/** A future-ready shelf taxonomy. Inactive categories are never advertised as in stock. */
export type Shelf = {slug:string; name:string; emoji:string; description:string; sport?:string; matchCategory?:string; group:'Sports cards'|'Trading card games'|'Other cards & collectibles'|'Shop extras'};
export const SHELVES:Shelf[] = [
 {slug:'baseball',name:'Baseball',emoji:'⚾',description:'Vintage stars, rookies and set builders',sport:'Baseball',group:'Sports cards'},
 {slug:'football',name:'Football',emoji:'🏈',description:'NFL favorites and old-school finds',sport:'Football',group:'Sports cards'},
 {slug:'basketball',name:'Basketball',emoji:'🏀',description:'Big names, classic hoops and more',sport:'Basketball',group:'Sports cards'},
 {slug:'golf',name:'Golf',emoji:'⛳',description:'The cards from the links',sport:'Golf',group:'Sports cards'},
 {slug:'motorsports',name:'Motorsports',emoji:'🏁',description:'Racing cards and drivers',sport:'Racing',group:'Sports cards'},
 {slug:'hockey',name:'Hockey',emoji:'🏒',description:'Hockey cards for the collection',sport:'Hockey',group:'Sports cards'},
 {slug:'soccer',name:'Soccer',emoji:'⚽',description:'Clubs, countries and players',sport:'Soccer',group:'Sports cards'},
 {slug:'wrestling',name:'Wrestling & MMA',emoji:'🥊',description:'Wrestling and fight cards',sport:'Wrestling',group:'Sports cards'},
 {slug:'pokemon',name:'Pokémon',emoji:'✦',description:'Cards, sets and singles',sport:'Pokémon',group:'Trading card games'},
 {slug:'magic',name:'Magic: The Gathering',emoji:'✧',description:'Singles and collecting',sport:'Magic',group:'Trading card games'},
 {slug:'yugioh',name:'Yu-Gi-Oh!',emoji:'♠',description:'Cards and sets',sport:'Yu-Gi-Oh!',group:'Trading card games'},
 {slug:'one-piece',name:'One Piece',emoji:'★',description:'TCG singles and more',sport:'One Piece',group:'Trading card games'},
 {slug:'other-trading-cards',name:'Other trading cards',emoji:'♣',description:'Mixed sets and unusual finds',sport:'Other Cards',group:'Other cards & collectibles'},
 {slug:'non-sport',name:'Non-sport cards',emoji:'🎬',description:'Entertainment, TV and movie cards',sport:'Non-Sport',group:'Other cards & collectibles'},
 {slug:'graded',name:'Graded cards',emoji:'✓',description:'Slabbed and graded collectibles',sport:'Graded',group:'Other cards & collectibles'},
 {slug:'sealed',name:'Sealed packs & boxes',emoji:'▣',description:'Unopened trading card products',sport:'Sealed',group:'Other cards & collectibles'},
 {slug:'card-lots',name:'Card lots & bundles',emoji:'▤',description:'More cardboard in one purchase',sport:'Card Lots',group:'Shop extras'},
 {slug:'supplies',name:'Card supplies',emoji:'▯',description:'Storage, sleeves and protection',sport:'Supplies',group:'Shop extras'},
 {slug:'sports-memorabilia',name:'Sports memorabilia',emoji:'🏟️',description:'NFL and other sports license plates and fan collectibles',sport:'Memorabilia',group:'Other cards & collectibles'},
 {slug:'collectibles',name:'Vintage & other finds',emoji:'★',description:'Books, memorabilia, games and oddities',sport:'Collectibles',group:'Other cards & collectibles'},
 ];
export function shelvesWithCounts(products:Product[]){
  const tally = new Map<string,number>();
  for(const product of products)tally.set(product.sport,(tally.get(product.sport)||0)+1);
  return SHELVES.map(s=>({...s,count:tally.get(s.sport||'')||0}));
}
