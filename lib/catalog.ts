import raw from './products.json';
import {canonicalSport,SHELVES} from './categories';

export type Product = {
  id: string; productId?:string; description?:string; title: string; price: number; quantity: number;
  sport: string; team: string; player: string; year: string; set: string;
  number: string; image: string; backImage: string; sku: string;
  condition: string; ebayUrl: string; category: string;
  sellerId: string; sellerName: string; sellerSlug:string;
};

const inventory = (raw as Omit<Product,'sellerId'|'sellerName'|'sellerSlug'>[]).map(p=>({
 ...p,sellerId:'hometown',sellerName:'Hometown Card Shop',sellerSlug:'hometown-card-shop'
}));
const byId = new Map(inventory.map(product => [product.id,product]));
export const TOTAL_ITEMS = inventory.length;
export const PHOTOS_COUNT = inventory.filter(product => Boolean(product.image)).length;
export const formatMoney = (cents: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);

export function getProduct(id: string){ return byId.get(id); }
export function getProducts(){ return inventory; }
export function countSport(sport:string){ return inventory.filter(x=>x.sport===sport).length; }
export const sports = SHELVES.map(s=>s.sport!).filter((name,i,arr)=>arr.indexOf(name)===i).map(name=>({name,count:countSport(name)}));
export function getTeamOptions(sport?: string, source: Product[] = inventory){
 const tally = new Map<string,number>();
 for(const item of source){if(item.team && (!sport || sport==='All' || item.sport===sport))tally.set(item.team,(tally.get(item.team)||0)+1);}
 return [...tally].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).map(([name,count])=>({name,count}));
}
export type SearchFilters = { search?:string; sport?:string; team?:string; year?:string; seller?:string; sort?:string; page?:string };
export function searchProducts(filters: SearchFilters, source: Product[] = inventory){
 const q=(filters.search||'').trim().toLowerCase();
 let result=source.filter(p=>{
  if(filters.sport && filters.sport!=='All' && canonicalSport(p.sport)!==canonicalSport(filters.sport))return false;
  if(filters.seller && p.sellerSlug!==filters.seller)return false;
  if(filters.team && p.team!==filters.team)return false;
  if(filters.year && p.year!==filters.year)return false;
  if(q && ![p.title,p.sport,p.team,p.player,p.set,p.year,p.number,p.sku].join(' ').toLowerCase().includes(q))return false;
  return true;
 });
 switch(filters.sort){
  case 'price-asc':result.sort((a,b)=>a.price-b.price);break;
  case 'price-desc':result.sort((a,b)=>b.price-a.price);break;
  case 'title':result.sort((a,b)=>a.title.localeCompare(b.title));break;
  case 'year':result.sort((a,b)=>Number(b.year)-Number(a.year));break;
  default: result.sort((a,b)=>Number(b.id)-Number(a.id));
 }
 const count=result.length;
 const perPage=36;
 const page=Math.max(1,Math.min(2000,Math.floor(Number(filters.page)||1)));
 return {items:result.slice((page-1)*perPage,page*perPage),total:count,page,perPage,pages:Math.ceil(count/perPage)};
}
/**
 * Curate pictured, in-stock cards across budget, middle, and premium price tiers.
 * Use price rank rather than hard dollar cutoffs so the mix adapts as stock changes.
 * Prefer different sports before repeating a sport in the same tier.
 */
export function recommended(count=8, source: Product[] = inventory){
 const limit=Math.max(0,Math.floor(count));
 if(limit===0)return [];
 const priced=source.filter(p=>p.quantity>0&&p.price>0&&Boolean(p.image)&&p.sport!=='Collectibles')
  .sort((a,b)=>a.price-b.price||a.id.localeCompare(b.id));
 if(!priced.length)return [];
 const budgetEnd=Math.max(1,Math.ceil(priced.length*.35));
 const premiumStart=Math.max(budgetEnd,Math.floor(priced.length*.75));
 const middlePrice=priced[Math.floor(priced.length/2)].price;
 const pools={
  budget:priced.slice(0,budgetEnd),
  mid:priced.slice(budgetEnd,premiumStart).sort((a,b)=>Math.abs(a.price-middlePrice)-Math.abs(b.price-middlePrice)||a.id.localeCompare(b.id)),
  premium:priced.slice(premiumStart).reverse()
 };
 const cadence: Array<keyof typeof pools>=['premium','budget','mid','budget','premium','mid','budget','mid'];
 const picked:Product[]=[];
 const selected=new Set<string>();
 const sportsSeen=new Map<string,number>();
 function take(pool:Product[]){
  let best:Product|undefined;let score=Infinity;
  for(const p of pool){
   if(selected.has(`${p.sellerId}:${p.id}`))continue;
   const n=sportsSeen.get(p.sport)||0;
   if(n<score){best=p;score=n;if(n===0)break;}
  }
  if(!best)return false;
  picked.push(best);selected.add(`${best.sellerId}:${best.id}`);
  sportsSeen.set(best.sport,(sportsSeen.get(best.sport)||0)+1);
  return true;
 }
 const tiers=Object.keys(pools) as Array<keyof typeof pools>;
 for(let i=0;picked.length<Math.min(limit,priced.length);i++){
  const preferred=cadence[i%cadence.length];
  let added=take(pools[preferred]);
  if(!added){
   for(const tier of tiers){if(take(pools[tier])){added=true;break;}}
  }
  if(!added)break;
 }
 return picked;
}

export function sportsFor(source: Product[]){
 const counts=new Map<string,number>();for(const p of source){const name=canonicalSport(p.sport);counts.set(name,(counts.get(name)||0)+1)}
 const known=SHELVES.map(s=>s.sport!).filter((name,i,arr)=>arr.indexOf(name)===i);
 const extras=[...counts.keys()].filter(name=>!known.includes(name)).sort((a,b)=>a.localeCompare(b));
 return [...known,...extras].map(name=>({name,count:counts.get(name)||0}));
}
