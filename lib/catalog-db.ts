import type {Product} from '@/lib/catalog';
import {getProducts} from '@/lib/catalog';

const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
const production=process.env.NEXT_PUBLIC_STORE_LIVE==='true';
/** Preview uses a clearly identified snapshot; live mode NEVER falls back to stale stock. */
export async function getCatalog():Promise<Product[]>{
 if(!url||!key){if(production)throw new Error('Live inventory database is missing');return getProducts();}
 try{
  const result:Product[]=[];
  for(let offset=0;offset<15000;offset+=1000){
   const u=`${url}/rest/v1/products?select=*,sellers!inner(slug,display_name,status)&sellers.status=eq.approved&status=eq.published&stock=gt.0&needs_review=eq.false&manual_paused=eq.false&order=created_at.desc&offset=${offset}&limit=1000`;
   const res=await fetch(u,{headers:{apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key})},next:{revalidate:90}});
   if(!res.ok)throw new Error('Catalog DB returned '+res.status);
   const rows=await res.json() as Array<Record<string,unknown>>;
   for(const x of rows){const seller=(x.sellers||{}) as Record<string,unknown>;
    result.push({id:String(x.source==='ebay'?x.source_item_id:x.id),sellerId:String(x.seller_id),sellerName:String(seller.display_name||'Hometown Card Shop'),sellerSlug:String(seller.slug||'hometown-card-shop'),title:String(x.title||''),price:Number(x.price_override_cents??x.price_cents??0),quantity:Number(x.stock||0),sport:String(x.sport||'Other Cards'),team:String(x.team||''),player:String(x.player||''),year:String(x.card_year||''),set:String(x.card_set||''),number:String(x.card_number||''),image:String(x.image_url||''),backImage:String(x.back_image_url||''),sku:String(x.sku||x.source_item_id||x.id),condition:String(x.condition||''),ebayUrl:String(x.ebay_url||''),category:String(x.category||'')});
   }
   if(rows.length<1000)break;
  }
  return result;
 }catch(err){if(production)throw err;return getProducts();}
}
export async function getCatalogItem(id:string){return (await getCatalog()).find(p=>p.id===id);}
