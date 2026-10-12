import {NextRequest,NextResponse} from 'next/server';
import {verifyStripeWebhook} from '@/lib/server/stripe';
import {checkoutRpc} from '@/lib/server/checkout-db';
import {sendShopAlert} from '@/lib/server/alerts';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 let event;
 try{event=verifyStripeWebhook(await req.text(),req.headers.get('stripe-signature'))}
 catch{return NextResponse.json({error:'Invalid signature'},{status:400})}
 // Seller subscriptions are Stripe Billing payments to the platform, NOT Connect transfers.
 if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type)){
  const sub=event.data?.object as unknown as {
   id?:string;customer?:string|{id?:string};status?:string;
   current_period_end?:number;cancel_at_period_end?:boolean;
   metadata?:Record<string,string>;
   items?:{data?:Array<{price?:{id?:string};current_period_end?:number}>};
  };
  const sellerId=sub?.metadata?.seller_id||'';
  const priceId=sub?.items?.data?.[0]?.price?.id||'';
  const customer=typeof sub?.customer==='string'?sub.customer:sub?.customer?.id||'';
  // Never infer eligibility from an arbitrary checkout session or email.
  if(!/^[0-9a-f-]{36}$/i.test(sellerId)||!sub?.id||!customer||!priceId)return NextResponse.json({received:true,ignored:true});
  try{
   const result=await checkoutRpc<string>('hcs_apply_seller_membership_event',{
    p_event_id:event.id,p_event_created:Math.max(0,Math.floor((event as unknown as {created?:number}).created||0)),
    p_event_type:event.type,p_subscription_id:sub.id,p_customer_id:customer,
    p_price_id:priceId,p_status:event.type==='customer.subscription.deleted'?'canceled':(sub.status||''),
    p_period_end:sub.items?.data?.[0]?.current_period_end??sub.current_period_end??0,
    p_cancel_at_period_end:Boolean(sub.cancel_at_period_end),p_seller_id:sellerId
   });
   if(result==='recorded'){
    try{await sendShopAlert('seller_application','Seller membership updated',
     'Stripe Billing event '+event.type+' updated seller membership '+sellerId+'.')}catch(e){console.error('Membership notification failed',e)}
   }
   return NextResponse.json({received:true});
  }catch(e){console.error('Seller membership webhook failed',event.id,e);
   return NextResponse.json({error:'Unable to save seller billing state'},{status:500});}
 }
  const types=['checkout.session.completed','checkout.session.expired',
  'checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'];
 if(!types.includes(event.type))return NextResponse.json({received:true,ignored:true});
 const s=event.data?.object;
 if(!s?.id||!s.client_reference_id)return NextResponse.json({received:true,ignored:true});
 try{
  const paid=(event.type==='checkout.session.completed'&&s.payment_status==='paid')||
   event.type==='checkout.session.async_payment_succeeded';
  const outcome=await checkoutRpc<string>('hcs_settle_checkout',{
   p_order:s.client_reference_id,p_session_id:s.id,p_event_id:event.id,
   p_event_type:event.type,p_paid:paid,p_payment_intent:typeof s.payment_intent==='string'?s.payment_intent:null,
   p_email:s.customer_details?.email||null,
   p_shipping:s.collected_information?.shipping_details||s.shipping_details||null,
   p_amount_total:s.amount_total??null,p_tax_cents:s.total_details?.amount_tax??0
  });
  if(outcome==='paid'){
   try{await sendShopAlert('order','Paid order '+s.client_reference_id,
    'A customer paid for order '+s.client_reference_id+'.\nOpen the shopkeeper dashboard to pack and ship the cards.')}catch(e){console.error('Order notification delivery failed',e)}
  }
  if(outcome.includes('needs_review')){
   try{await sendShopAlert('security','Payment needs manual review',
     'Check Stripe and the order dashboard for session '+s.id+'.')}catch(e){console.error('Review notification delivery failed',e)}
  }
  return NextResponse.json({received:true});
 }catch(err){
  console.error('Stripe webhook processing failed',event.id,event.type,err);
  // Non-2xx tells Stripe to retry; never claim success after a DB failure.
  return NextResponse.json({error:'Could not persist payment event'},{status:500});
 }
}
