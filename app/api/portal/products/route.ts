import {NextRequest} from 'next/server';import {authorized,db,failure,json,PortalError,safeTerm,idList,queryIds,audit} from '@/lib/server/portal';
type ProductRow={id:string;title:string;sku:string;source:string;source_item_id:string;price_cents:number;price_override_cents:number|null;stock:number;status:string;manual_paused:boolean;needs_review:boolean;manual_image_url:string|null;image_url:string|null;sport:string;team:string;player:string;card_year:string;card_set:string;inventory_location:string;weight_oz:number|null;shipping_profile_id:string|null;updated_at:string};
export async function GET(req:NextRequest){try{
 const {sellerId}=await authorized(req);const q=safeTerm(req.nextUrl.searchParams.get('search'),100);const status=safeTerm(req.nextUrl.searchParams.get('status'),20);const offset=Math.max(0,Math.min(100000,Number(req.nextUrl.searchParams.get('offset'))||0));const limit=Math.max(1,Math.min(100,Number(req.nextUrl.searchParams.get('limit'))||50));
 let query=`products?select=id,title,sku,source,source_item_id,price_cents,price_override_cents,stock,status,manual_paused,needs_review,manual_image_url,image_url,sport,team,player,card_year,card_set,inventory_location,weight_oz,shipping_profile_id,updated_at&seller_id=eq.${sellerId}&order=updated_at.desc&offset=${offset}&limit=${limit}`;
 if(q)query+=`&or=(title.ilike.*${encodeURIComponent(q.replace(/[%*(),]/g,''))}*,sku.ilike.*${encodeURIComponent(q.replace(/[%*(),]/g,''))}*)`;
 if(status==='review')query+='&needs_review=eq.true';
 if(status==='published'||status==='draft'||status==='sold_out'||status==='paused')query+=`&status=eq.${status}`;
 const rows=await db<ProductRow[]>(query);return json({items:rows,nextOffset:rows.length===limit?offset+limit:null});
}catch(err){return failure(err)}}
export async function PATCH(req:NextRequest){try{
 const {sellerId,userId}=await authorized(req,'manage');const body=await req.json() as {ids?:string[];action?:string;value?:unknown};const ids=idList(body.ids);if(!ids.length)throw new PortalError('Select at least one item.');
 const action=safeTerm(body.action,40);if(!['price-set','price-adjust-percent','price-adjust-dollars','price-clear','pause','unpause','stock-set','sport','team','location','weight','review-complete'].includes(action))throw new PortalError('Unknown bulk action.');
 const updated=await db<number>('rpc/portal_bulk_edit',{method:'POST',body:JSON.stringify({p_seller_id:sellerId,p_actor:userId,p_ids:ids,p_action:action,p_value:body.value==null?null:String(body.value).slice(0,200)})});
 return json({ok:true,changed:updated});
}catch(err){return failure(err)}}

export async function POST(req:NextRequest){try{
 const {sellerId,userId}=await authorized(req,'manage');
 const raw=await req.text();if(raw.length>14000)throw new PortalError('Listing is too large.',413);
 const body=JSON.parse(raw) as Record<string,unknown>;
 const title=safeTerm(body.title,250),sku=safeTerm(body.sku,120);
 const price=Math.round(Number(body.price)*100),stock=Number(body.stock);
 if(title.length<2||!sku)throw new PortalError('Enter a title and SKU.');
 if(!Number.isSafeInteger(price)||price<1||price>100000000)throw new PortalError('Enter a valid card price.');
 if(!Number.isInteger(stock)||stock<0||stock>100000)throw new PortalError('Enter a valid stock quantity.');
 const existing=await db<Array<{id:string}>>('products?select=id&seller_id=eq.'+sellerId+'&sku=eq.'+encodeURIComponent(sku)+'&limit=1');
 if(existing.length)throw new PortalError('You already have a card with that SKU.',409);
 const item={
  seller_id:sellerId,source:'manual',source_item_id:crypto.randomUUID(),sku,title,
  description:safeTerm(body.description,4000),price_cents:price,stock,
  status:stock>0?'published':'sold_out',
  needs_review:true,manual_paused:false,
  sport:safeTerm(body.sport,80)||'Other Cards',team:safeTerm(body.team,100),
  player:safeTerm(body.player,120),card_year:safeTerm(body.card_year,4),
  card_set:safeTerm(body.card_set,120),card_number:safeTerm(body.card_number,40),
  condition:safeTerm(body.condition,100),category:safeTerm(body.category,120),
  inventory_location:safeTerm(body.inventory_location,100),last_edited_by:userId
 };
 const created=await db<Array<{id:string}>>('products',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(item)});
 if(!created[0]?.id)throw new PortalError('The listing could not be created.',502);
 await audit(sellerId,userId,'listing_created',created[0].id,null,{sku,title,price,stock});
 return json({ok:true,id:created[0].id},201);
}catch(e){return failure(e)}}
