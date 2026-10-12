import {NextRequest} from 'next/server';
import {authorized,db,failure,json,PortalError,safeTerm,audit,moneyCents} from '@/lib/server/portal';
type Item={id:string;seller_id:string;source:string;stock:number;manual_paused:boolean;needs_review:boolean;image_url:string|null;back_image_url:string|null;manual_image_url:string|null;manual_back_image_url:string|null;listing_overrides:Record<string,unknown>};
const uuid=/^[a-f0-9-]{36}$/i;
async function own(sellerId:string,id:string){if(!uuid.test(id))throw new PortalError('Invalid product ID.',400);
 const rows=await db<Item[]>('products?select=id,seller_id,source,stock,manual_paused,needs_review,image_url,back_image_url,manual_image_url,manual_back_image_url,listing_overrides&seller_id=eq.'+sellerId+'&id=eq.'+id+'&limit=1');
 if(!rows[0])throw new PortalError('Card not found in your shop.',404);return rows[0];}
export async function GET(req:NextRequest,ctx:{params:Promise<{id:string}>}){
 try{const {sellerId}=await authorized(req);const {id}=await ctx.params;await own(sellerId,id);
 const [products,photos]=await Promise.all([
 db<Record<string,unknown>[]>('products?select=*&seller_id=eq.'+sellerId+'&id=eq.'+id+'&limit=1'),
 db<Array<{id:string;slot:string;public_url:string;created_at:string}>>('product_images?select=id,slot,public_url,created_at&seller_id=eq.'+sellerId+'&product_id=eq.'+id+'&order=slot.asc')]);
 const settings=await db<Array<{manual_inventory_mode:boolean}>>('marketplace_settings?select=manual_inventory_mode&id=eq.true&limit=1');
 return json({product:products[0],photos,manualInventoryMode:settings[0]?.manual_inventory_mode===true});
 }catch(e){return failure(e)}
}
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}){
 try{const {sellerId,userId}=await authorized(req,'manage');const {id}=await ctx.params;
 const old=await own(sellerId,id);
 const body=await req.json() as Record<string,unknown>;
 const permitted=['title','description','sport','team','player','card_year','card_set','card_number','condition','category','inventory_location','seller_notes'] as const;
 const sizes:Record<string,number>={title:250,description:4000,sport:80,team:100,player:120,card_year:4,card_set:120,card_number:40,condition:100,category:120,inventory_location:100,seller_notes:2000};
 const patch:Record<string,unknown>={updated_at:new Date().toISOString(),last_edited_by:userId};
 const overrides={...(old.listing_overrides||{})};
 for(const key of permitted){if(Object.prototype.hasOwnProperty.call(body,key)){
  const val=safeTerm(body[key],sizes[key]);
  if(key==='title'&&val.length<2)throw new PortalError('Enter a card title.');
  if(key==='card_year'&&val&&!/^\d{4}$/.test(val))throw new PortalError('Card year needs four digits.');
  patch[key]=val;overrides[key]=val;
 }}
 if(Object.prototype.hasOwnProperty.call(body,'price_override_cents')){
  if(body.price_override_cents===null){patch.price_override_cents=null;}
  else{const price=Number(body.price_override_cents);if(!Number.isInteger(price)||price<1||price>100000000)throw new PortalError('Enter a valid site price in cents.');patch.price_override_cents=price;}
 }
 if(Object.prototype.hasOwnProperty.call(body,'stock')){
  if(old.source==='ebay'){
   const settings=await db<Array<{manual_inventory_mode:boolean}>>('marketplace_settings?select=manual_inventory_mode&id=eq.true&limit=1');
   if(!settings[0]?.manual_inventory_mode)throw new PortalError('eBay stock must be updated via eBay when live synchronization is enabled.',409);
  }
  const stock=Number(body.stock);if(!Number.isInteger(stock)||stock<0||stock>100000)throw new PortalError('Invalid stock quantity.');
  patch.stock=stock;patch.status=stock?'published':'sold_out';
  // Keep manually removed eBay listings hidden even if a later eBay import finds them.
  if(old.source==='ebay'&&stock===0)patch.manual_paused=true;
 }
 if(Object.prototype.hasOwnProperty.call(body,'manual_paused'))patch.manual_paused=body.manual_paused===true;
 if(Object.prototype.hasOwnProperty.call(body,'needs_review')){
  if(body.needs_review!==true&&body.needs_review!==false)throw new PortalError('Invalid review status.');
  if(body.needs_review===false&&!old.manual_image_url&&!old.image_url)throw new PortalError('Upload a front photo before clearing the photo review flag.');
  patch.needs_review=body.needs_review;
 }
 patch.listing_overrides=overrides;
 await db('products?id=eq.'+id+'&seller_id=eq.'+sellerId,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});
 await audit(sellerId,userId,'listing_detail_edit',id,{source:old.source,review:old.needs_review},{changedFields:Object.keys(patch),manualOverrides:overrides});
 return json({ok:true});
 }catch(e){return failure(e)}
}
