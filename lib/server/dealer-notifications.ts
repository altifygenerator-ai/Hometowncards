import {db} from '@/lib/server/portal';
/** A direct-charge dealer is responsible for packing their own paid orders. */
export async function emailDealerPaidOrder(orderId:string){
 if(!/^[0-9a-f-]{36}$/i.test(orderId))return;
 const rows=await db<Array<{seller_id:string;sellers:{display_name:string;contact_email:string|null}}>>(
  'seller_orders?select=seller_id,sellers!inner(display_name,contact_email)&order_id=eq.'+encodeURIComponent(orderId)+'&limit=1');
 const seller=rows[0]?.sellers;
 if(!seller?.contact_email)return;
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
 if(!key||!from)throw new Error('Seller notification email is not configured');
 const text='A buyer has paid for an order from '+seller.display_name+'.\n\nOrder ID: '+orderId+
   '\n\nSign in to your seller dashboard at https://www.hometowncardshop.com/admin to view the buyer, packing details, and shipping information.\n' +
   'Only ship after the order shows as paid in the Orders tab. Refunds and chargebacks need careful review.\n\nHometown Card Shop';
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify({from,to:[seller.contact_email],subject:'[Hometown Card Shop] Your cards sold — order '+orderId.slice(0,8),text}),cache:'no-store'});
 if(!r.ok)throw new Error('Seller order email could not be delivered');
}
