import {NextRequest} from 'next/server';import {authorized,db,failure,json,PortalError,safeTerm,idList,queryIds,audit} from '@/lib/server/portal';
type ProductRow={id:string;title:string;sku:string;source:string;source_item_id:string;price_cents:number;price_override_cents:number|null;stock:number;status:string;manual_paused:boolean;needs_review:boolean;sport:string;team:string;player:string;card_year:string;card_set:string;inventory_location:string;weight_oz:number|null;shipping_profile_id:string|null;updated_at:string};
export async function GET(req:NextRequest){try{
 const {sellerId}=await authorized(req);const q=safeTerm(req.nextUrl.searchParams.get('search'),100);const status=safeTerm(req.nextUrl.searchParams.get('status'),20);const offset=Math.max(0,Math.min(100000,Number(req.nextUrl.searchParams.get('offset'))||0));const limit=Math.max(1,Math.min(100,Number(req.nextUrl.searchParams.get('limit'))||50));
 let query=`products?select=id,title,sku,source,source_item_id,price_cents,price_override_cents,stock,status,manual_paused,needs_review,sport,team,player,card_year,card_set,inventory_location,weight_oz,shipping_profile_id,updated_at&seller_id=eq.${sellerId}&order=updated_at.desc&offset=${offset}&limit=${limit}`;
 if(q)query+=`&or=(title.ilike.*${encodeURIComponent(q.replace(/[%*(),]/g,''))}*,sku.ilike.*${encodeURIComponent(q.replace(/[%*(),]/g,''))}*)`;
 if(status==='published'||status==='draft'||status==='sold_out'||status==='paused')query+=`&status=eq.${status}`;
 const rows=await db<ProductRow[]>(query);return json({items:rows,nextOffset:rows.length===limit?offset+limit:null});
}catch(err){return failure(err)}}
export async function PATCH(req:NextRequest){try{
 const {sellerId,userId}=await authorized(req,'manage');const body=await req.json() as {ids?:string[];action?:string;value?:unknown};const ids=idList(body.ids);if(!ids.length)throw new PortalError('Select at least one item.');
 const action=safeTerm(body.action,40);if(!['price-set','price-adjust-percent','price-adjust-dollars','price-clear','pause','unpause','stock-set','sport','team','location','weight','review-complete'].includes(action))throw new PortalError('Unknown bulk action.');
 const updated=await db<number>('rpc/portal_bulk_edit',{method:'POST',body:JSON.stringify({p_seller_id:sellerId,p_actor:userId,p_ids:ids,p_action:action,p_value:body.value==null?null:String(body.value).slice(0,200)})});
 return json({ok:true,changed:updated});
}catch(err){return failure(err)}}
