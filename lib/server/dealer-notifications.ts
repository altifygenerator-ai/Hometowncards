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

/** Separate dealer lifecycle emails from order receipts; never include secrets or passwords. */
export async function emailDealerAccountUpdate(email:string,name:string,stage:'approved'|'active'|'declined'){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return;
 const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
 if(!key||!from)throw new Error('Dealer account email is not configured');
 const subject=stage==='approved'?'Your dealer account has been approved':stage==='active'?'Your card shop is ready to sell':'Update on your card shop application';
 const detail=stage==='approved'?
   'Your shop account was approved for setup. Sign in, add or import your cards, configure your shipping and return policies, and connect Stripe for payouts. Your storefront will not start accepting payments until it passes all launch checks.':
   stage==='active'?'Your independent dealer storefront has been approved for publishing. Browse your listings and review orders from your seller dashboard.':
   'We could not approve your application at this time. Reply to this email if you have questions.';
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify({from,to:[email],subject:'[Hometown Card Shop] '+subject,text:'Hi '+name+',\n\n'+detail+'\n\nSign in: https://www.hometowncardshop.com/admin\n\nHometown Card Shop'}),cache:'no-store'});
 if(!response.ok)throw new Error('Dealer account email could not be delivered');
}
