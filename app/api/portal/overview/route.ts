import {NextRequest} from 'next/server';import {authorized,db,failure,json} from '@/lib/server/portal';
export async function GET(req:NextRequest){try{
 const {sellerId,...ctx}=await authorized(req);
 const [products,orders,jobs,profiles,bonus]=await Promise.all([
  db<Array<{price_cents:number;price_override_cents:number|null;stock:number;status:string;needs_review:boolean;manual_paused:boolean;source:string}>>(`products?select=price_cents,price_override_cents,stock,status,needs_review,manual_paused,source&seller_id=eq.${sellerId}&limit=10000`),
  db<Array<{id:string;status:string;subtotal_cents:number;shipping_cents:number;created_at:string;order_id:string;orders:{customer_email:string|null;created_at:string;status:string}}>>(`seller_orders?select=id,status,subtotal_cents,shipping_cents,created_at,order_id,orders(customer_email,created_at,status)&seller_id=eq.${sellerId}&order=created_at.desc&limit=5000`),
  db<Array<{id:string;operation:string;status:string;rows_changed:number;created_at:string}>>(`bulk_jobs?select=id,operation,status,rows_changed,created_at&seller_id=eq.${sellerId}&order=created_at.desc&limit=8`),
  db<Array<{id:string}>>(`shipping_profiles?select=id&seller_id=eq.${sellerId}&active=eq.true`),
  db<Array<{sport:string;available_count:number}>>(`bonus_card_pools?select=sport,available_count&funding_seller_id=eq.${sellerId}`)
 ]);
 const paid=orders.filter(x=>['paid','packing','shipped','delivered'].includes(x.status));
 return json({seller:{id:sellerId,name:ctx.sellerName,isFounder:ctx.isFounder,platformRole:ctx.platformRole},metrics:{listings:products.length,available:products.filter(x=>x.status==='published'&&!x.manual_paused&&!x.needs_review&&x.stock>0).length,units:products.reduce((n,x)=>n+x.stock,0),inventoryRetailCents:products.reduce((n,x)=>n+(x.price_override_cents??x.price_cents)*x.stock,0),needsAttention:products.filter(x=>x.needs_review||x.manual_paused||x.status==='sold_out').length,orders:orders.length,unshipped:orders.filter(x=>['paid','packing'].includes(x.status)).length,salesCents:paid.reduce((n,x)=>n+x.subtotal_cents,0),shippingProfiles:profiles.length},orders:orders.slice(0,10),jobs,bonusPools:bonus});
}catch(err){return failure(err)}}
