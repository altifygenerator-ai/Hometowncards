import {NextRequest} from 'next/server';import {authorized,db,failure,json,PortalError,safeTerm} from '@/lib/server/portal';
export async function GET(req:NextRequest){try{const {sellerId}=await authorized(req);return json({profiles:await db(`shipping_profiles?select=*&seller_id=eq.${sellerId}&order=sort_order.asc,created_at.asc`)});}catch(e){return failure(e)}}
export async function POST(req:NextRequest){try{
 const {sellerId}=await authorized(req,'manage');const body=await req.json() as Record<string,unknown>;
 const name=safeTerm(body.name,100),service_label=safeTerm(body.service_label,120)||'Standard shipping';if(!name)throw new PortalError('Enter a shipping profile name.');
 const ints=['base_cents','additional_item_cents','max_items'];const decimals=['max_weight_oz','packaging_weight_oz','default_item_weight_oz'];const patch:Record<string,unknown>={seller_id:sellerId,name,service_label,active:body.active!==false,allows_bonus_cards:body.allows_bonus_cards!==false,sort_order:Math.floor(Number(body.sort_order)||0),notes:safeTerm(body.notes,500)};
 for(const key of ints){const n=Number(body[key]);if(!Number.isInteger(n)||n<0||n>100000||(key==='max_items'&&n===0))throw new PortalError(`Invalid ${key}.`);patch[key]=n}
 for(const key of decimals){const n=Number(body[key]);if(!Number.isFinite(n)||n<0||n>10000||(key!=='packaging_weight_oz'&&n===0))throw new PortalError(`Invalid ${key}.`);patch[key]=n}
 const free=body.free_shipping_threshold_cents;patch.free_shipping_threshold_cents=free==null||free===''?null:Number(free);if(patch.free_shipping_threshold_cents!==null&&(!Number.isInteger(patch.free_shipping_threshold_cents)||Number(patch.free_shipping_threshold_cents)<0))throw new PortalError('Invalid free shipping threshold.');
 if(body.id){const id=String(body.id);if(!/^[a-f\d-]{36}$/i.test(id))throw new PortalError('Invalid profile ID.');await db(`shipping_profiles?id=eq.${id}&seller_id=eq.${sellerId}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)})}
 else await db('shipping_profiles',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});
 return json({ok:true});
}catch(e){return failure(e)}}
