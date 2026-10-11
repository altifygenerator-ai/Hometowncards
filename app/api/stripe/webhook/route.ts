import {NextRequest,NextResponse} from 'next/server';
import {verifyStripeWebhook} from '@/lib/server/stripe';
import {checkoutRpc} from '@/lib/server/checkout-db';
import {sendShopAlert} from '@/lib/server/alerts';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 let event;
 try{event=verifyStripeWebhook(await req.text(),req.headers.get('stripe-signature'))}
 catch{return NextResponse.json({error:'Invalid signature'},{status:400})}
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
