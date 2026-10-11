import {NextRequest} from 'next/server';import {authorized,db,failure,json,PortalError,safeTerm} from '@/lib/server/portal';
export async function GET(req:NextRequest){try{
 const {sellerId}=await authorized(req);const status=safeTerm(req.nextUrl.searchParams.get('status'),30);const limit=Math.max(1,Math.min(100,Number(req.nextUrl.searchParams.get('limit'))||50));
 let q=`seller_orders?select=id,order_id,subtotal_cents,shipping_cents,platform_fee_cents,status,tracking_number,carrier,shipped_at,created_at,orders(id,customer_email,status,created_at,shipping_name,shipping_address),order_lines(id,product_title_snapshot,sku_snapshot,quantity,unit_price_cents)&seller_id=eq.${sellerId}&order=created_at.desc&limit=${limit}`;
 if(['pending','paid','packing','shipped','delivered','cancelled','refunded','needs_review'].includes(status))q+=`&status=eq.${status}`;
 return json({orders:await db(q)});
}catch(e){return failure(e)}}
export async function PATCH(req:NextRequest){try{
 const {sellerId,userId}=await authorized(req,'manage');const body=await req.json() as {id?:string;status?:string;carrier?:string;tracking?:string};
 const id=safeTerm(body.id,50);if(!/^[a-f\d-]{36}$/i.test(id))throw new PortalError('Invalid order.');
 const rows=await db<Array<{id:string;status:string}>>(`seller_orders?select=id,status&seller_id=eq.${sellerId}&id=eq.${id}&limit=1`);const current=rows[0];if(!current)throw new PortalError('Order not found.',404);
 const transitions:Record<string,string[]>={pending:[],paid:['packing','shipped'],packing:['shipped'],shipped:['delivered'],delivered:[],cancelled:[],refunded:[],needs_review:['packing']};
 const status=safeTerm(body.status,30);if(!transitions[current.status]?.includes(status))throw new PortalError('This order cannot move from '+current.status+' to '+status+'.');
 const tracking=safeTerm(body.tracking,120),carrier=safeTerm(body.carrier,80);
 if(status==='shipped'&&(!tracking||!carrier))throw new PortalError('Provide a carrier and tracking number before marking shipped. Untracked shipping requires a separate manual procedure.');
 const patch={status,...(status==='shipped'?{carrier,tracking_number:tracking,shipped_at:new Date().toISOString()}:{})};
 await db(`seller_orders?id=eq.${id}&seller_id=eq.${sellerId}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});
 await db('order_events',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({seller_order_id:id,actor_user_id:userId,event_type:'fulfillment_'+status,detail:{previous:current.status,carrier:carrier||null,tracking:tracking||null}})});
 return json({ok:true});
}catch(e){return failure(e)}}
