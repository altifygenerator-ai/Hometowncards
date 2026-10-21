import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/server/portal';
export const runtime='nodejs';
type Row={id:string;status:string;order_lines:Array<{seller_id:string;products:{id:string;source:string;source_item_id:string|null}}>;};
export async function GET(req:NextRequest){
 const session=req.nextUrl.searchParams.get('session_id')||'';
 if(!/^cs_[a-zA-Z0-9_]{10,200}$/.test(session))return NextResponse.json({error:'Invalid checkout reference'},{status:400});
 try{
  const rows=await db<Row[]>('orders?select=id,status,order_lines(seller_id,products(id,source,source_item_id))&stripe_session_id=eq.'+encodeURIComponent(session)+'&limit=1');
  const order=rows[0];
  if(!order)return NextResponse.json({state:'processing'},{headers:{'Cache-Control':'no-store'}});
  const paid=['paid','fulfilled','partially_refunded','refunded'].includes(order.status);
  if(!paid)return NextResponse.json({state:order.status==='cancelled'?'cancelled':'processing'},{headers:{'Cache-Control':'no-store'}});
  const removed=order.order_lines.map(l=>l.seller_id+':'+(l.products.source==='ebay'?l.products.source_item_id:l.products.id));
  return NextResponse.json({state:'paid',orderId:order.id,cartKeys:removed},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Checkout confirmation unavailable',e);
  return NextResponse.json({state:'processing'},{headers:{'Cache-Control':'no-store'}});}
}
