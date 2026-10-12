import {NextRequest,NextResponse} from 'next/server';
import {portalContext,db,PortalError,failure} from '@/lib/server/portal';
import {toCsv} from '@/lib/server/csv';
type ShippingAddress={name?:string;address?:{line1?:string;line2?:string;city?:string;state?:string;postal_code?:string;country?:string}};
type SellerOrder={id:string;order_id:string;status:string;orders:{customer_email:string|null;shipping_name:string|null;shipping_address:ShippingAddress|null}};
type Quote={order_id:string;estimated_weight_oz:number;charged_cents:number;service_label_snapshot:string};
export async function GET(req:NextRequest){
 try{
  const id=req.nextUrl.searchParams.get('seller')||undefined;
  if(id&&!/^[a-f\d-]{36}$/i.test(id))throw new PortalError('Invalid seller ID',400);
  const ctx=await portalContext(id);
  const orders=await db<SellerOrder[]>(`seller_orders?select=id,order_id,status,orders(customer_email,shipping_name,shipping_address)&seller_id=eq.${ctx.sellerId}&status=in.(paid,packing)&order=created_at.asc&limit=1000`);
  const quotes=await db<Quote[]>(`shipping_quotes?select=order_id,estimated_weight_oz,charged_cents,service_label_snapshot&seller_id=eq.${ctx.sellerId}&limit=1000`);
  const byId=new Map(quotes.map(x=>[x.order_id,x]));
  let skipped=0;
  const rows:(string|number)[][]=[];
  for(const o of orders){
   const shipping=o.orders?.shipping_address;
   const address=shipping?.address,quote=byId.get(o.order_id);
   const name=o.orders?.shipping_name||shipping?.name||'';
   if(!address?.line1||!address?.city||!address?.state||!address?.postal_code||!name){skipped++;continue;}
   rows.push([o.order_id,name,address.line1,address.line2||'',address.city,address.state,
    address.postal_code,address.country||'US',o.orders?.customer_email||'',
    quote?.estimated_weight_oz||'',quote?.service_label_snapshot||'',quote?.charged_cents||0]);
  }
  const columns=['Order ID','Recipient Name','Address Line 1','Address Line 2','City','State','ZIP/Postal Code','Country','Email','Estimated Weight (oz)','Requested Service','Shipping Charged (cents)'];
  return new NextResponse(toCsv(columns,rows),{headers:{
   'Content-Type':'text/csv; charset=utf-8',
   'Content-Disposition':'attachment; filename="hometown-card-shop-shipping-orders.csv"',
   'Cache-Control':'no-store','X-Skipped-Orders':String(skipped)
  }});
 }catch(e){return failure(e)}
}
