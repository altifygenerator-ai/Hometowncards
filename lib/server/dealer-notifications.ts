import {db} from '@/lib/server/portal';
import {brandedEmail,plainFor,sendEmail,SITE} from '@/lib/server/branded-email';
/** A direct-charge dealer is responsible for packing their own paid orders. */
export async function emailDealerPaidOrder(orderId:string){
 if(!/^[0-9a-f-]{36}$/i.test(orderId))return;
 const rows=await db<Array<{seller_id:string;sellers:{display_name:string;contact_email:string|null}}>>(
  'seller_orders?select=seller_id,sellers!inner(display_name,contact_email)&order_id=eq.'+encodeURIComponent(orderId)+'&limit=1');
 const seller=rows[0]?.sellers;
 if(!seller?.contact_email)return;
 const title='Your cards sold — order '+orderId.slice(0,8);
 const body='A buyer has paid for an order from '+seller.display_name+'.\n\nOrder ID: '+orderId+'\n\nSign in to your seller dashboard to view the buyer, packing details, and shipping information.\nOnly ship after the order shows as paid in the Orders tab. Refunds and chargebacks need careful review.';
 await sendEmail(seller.contact_email,'[Hometown Card Shop] '+title,plainFor(title,body,SITE+'/admin'),brandedEmail(title,body,'Open seller dashboard','/admin','Seller order notification.'));
}

/** Separate dealer lifecycle emails from order receipts; never include secrets or passwords. */
export async function emailDealerAccountUpdate(email:string,name:string,stage:'approved'|'active'|'declined'){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return;
 const title=stage==='approved'?'Your dealer account has been approved':stage==='active'?'Your card shop is ready to sell':'Update on your card shop application';
 const detail=stage==='approved'?
  'Your shop account was approved for setup. Sign in, add or import your cards, configure your shipping and return policies, and connect Stripe for payouts. Your storefront will not start accepting payments until it passes all launch checks.':
  stage==='active'?'Your independent dealer storefront has been approved for publishing. Browse your listings and review orders from your seller dashboard.':
  'We could not approve your application at this time. Reply to this email if you have questions.';
 const body='Hi '+name+',\n\n'+detail;
 await sendEmail(email,'[Hometown Card Shop] '+title,plainFor(title,body,SITE+'/admin'),brandedEmail(title,body,'Sign in to your dashboard','/admin'));
}
