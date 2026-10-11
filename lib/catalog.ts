import raw from './products.json';

export type Product = {
  id: string; title: string; price: number; quantity: number;
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
export const sports = ['Baseball','Football','Basketball','Golf','Racing','Other Cards','Collectibles'].map(name=>({name,count:countSport(name)}));
export function getTeamOptions(sport?: string, source: Product[] = inventory){
 const tally = new Map<string,number>();
 for(const item of source){if(item.team && (!sport || sport==='All' || item.sport===sport))tally.set(item.team,(tally.get(item.team)||0)+1);}
 return [...tally].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).map(([name,count])=>({name,count}));
}
export type SearchFilters = { search?:string; sport?:string; team?:string; year?:string; seller?:string; sort?:string; page?:string };
export function searchProducts(filters: SearchFilters, source: Product[] = inventory){
 const q=(filters.search||'').trim().toLowerCase();
 let result=source.filter(p=>{
  if(filters.sport && filters.sport!=='All' && p.sport!==filters.sport)return false;
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
export function recommended(count=8, source: Product[] = inventory){
  // A consistent selection of real, pictured cards at a variety of prices.
  const cards=source.filter(x=>x.image && x.sport!=='Collectibles' && x.price>=200 && x.price<=2500);
  const sports=['Baseball','Football','Basketball','Baseball','Football'];
  const picked:Product[]=[];
  for(const sport of sports){const candidate=cards.find(x=>x.sport===sport && !picked.some(y=>y.id===x.id));if(candidate)picked.push(candidate);}
  for(const x of cards){if(picked.length>=count)break;if(!picked.some(y=>y.id===x.id))picked.push(x);}
  return picked.slice(0,count);
}

export function sportsFor(source: Product[]){ const counts=new Map<string,number>();for(const p of source)counts.set(p.sport,(counts.get(p.sport)||0)+1);return ['Baseball','Football','Basketball','Golf','Racing','Other Cards','Collectibles'].map(name=>({name,count:counts.get(name)||0}));}
