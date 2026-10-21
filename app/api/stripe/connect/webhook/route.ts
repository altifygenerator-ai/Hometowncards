import {NextRequest,NextResponse} from 'next/server';
import {verifyStripeWebhook} from '@/lib/server/stripe';
import {checkoutRpc} from '@/lib/server/checkout-db';
import {sendShopAlert} from '@/lib/server/alerts';
import {emailDealerPaidOrder} from '@/lib/server/dealer-notifications';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const secret=process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:'Connect webhook not configured'},{status:503});
 let event;
 try{event=verifyStripeWebhook(await req.text(),req.headers.get('stripe-signature'),secret)}
 catch{return NextResponse.json({error:'Invalid webhook signature'},{status:400})}
 const enriched=event as typeof event&{account?:string;data:{object:{
  id?:string;client_reference_id?:string;metadata?:Record<string,string>;charges_enabled?:boolean;payouts_enabled?:boolean;
  payment_status?:string;payment_intent?:string;amount_total?:number|null;total_details?:{amount_tax?:number|null};
  customer_details?:{email?:string|null};collected_information?:{shipping_details?:unknown};shipping_details?:unknown;
 }}};
 const detail=enriched.data?.object;
 const connected=enriched.account||(event.type==='account.updated'?detail?.id:'');
 if(!connected?.startsWith('acct_'))return NextResponse.json({received:true,ignored:true});
 const checkoutEvents=['checkout.session.completed','checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed','checkout.session.expired'];
 if(event.type==='charge.refunded'||event.type==='charge.dispute.created'){
  const charge=detail as typeof detail&{payment_intent?:string|null;charge?:string|null;amount?:number;amount_refunded?:number};
  const paymentIntent=typeof charge?.payment_intent==='string'?charge.payment_intent:null;
  if(!paymentIntent){
   try{await sendShopAlert('security','Dealer payment event missing payment intent',
    'Stripe event '+event.id+' for '+connected+' needs manual investigation.');}catch{}
   return NextResponse.json({received:true,needs_review:true});
  }
  try{
   const status=await checkoutRpc<string>('hcs_record_dealer_charge_event',{
    p_event_id:event.id,p_event_type:event.type,p_connected_account_id:connected,
    p_payment_intent:paymentIntent,
    p_charge_id:typeof charge?.charge==='string'?charge.charge:charge?.id||'',
    p_amount_refunded:typeof charge?.amount_refunded==='number'?charge.amount_refunded:0,
    p_charge_total:typeof charge?.amount==='number'?charge.amount:null
   });
   if(status!=='duplicate'){
    try{await sendShopAlert('security','Connected dealer '+event.type,
     'Event '+event.id+'\\nConnected account '+connected+'\\nPayment intent '+paymentIntent+
     '\\nState '+status+'\\nVerify seller refund, application fee adjustment and shipping status.')}
    catch(error){console.error('Dealer payment incident alert not sent',error)}
   }
   return NextResponse.json({received:true,status});
  }catch(error){
   console.error('Dealer refund or dispute event could not be recorded',event.id,error);
   return NextResponse.json({error:'Could not record connected charge event'},{status:500});
  }
 }
 if(checkoutEvents.includes(event.type)){
  const orderId=detail?.metadata?.order_id||detail?.client_reference_id||'';
  if(!/^[0-9a-f-]{36}$/i.test(orderId)||!detail?.id?.startsWith('cs_'))return NextResponse.json({error:'Missing dealer checkout metadata'},{status:400});
  try{
   const paid=(event.type==='checkout.session.completed'&&detail.payment_status==='paid')||
    event.type==='checkout.session.async_payment_succeeded';
   const status=await checkoutRpc<string>('hcs_settle_dealer_checkout',{
    p_order:orderId,p_session_id:detail.id,p_event_id:event.id,p_event_type:event.type,p_connected_account_id:connected,
    p_paid:paid,p_amount_total:detail.amount_total??null,p_tax_cents:detail.total_details?.amount_tax??0,
    p_payment_intent:detail.payment_intent||null,p_email:detail.customer_details?.email||null,
    p_shipping:detail.collected_information?.shipping_details||detail.shipping_details||null
   });
   if(status==='paid'||status==='paid_needs_review'){
    try{await sendShopAlert('order',status==='paid'?'Independent dealer order paid':'Dealer payment needs immediate review',
     'Order '+orderId+'\nStripe event '+event.id+'\nConnected account '+connected+'\nStatus '+status);}
    catch(err){console.error('Dealer platform order alert failed',err)}
    if(status==='paid')try{await emailDealerPaidOrder(orderId)}catch(err){console.error('Dealer email not delivered',err)}
   }
   return NextResponse.json({received:true,status});
  }catch(err){console.error('Dealer Checkout settlement failed',event.id,event.type,err);
   return NextResponse.json({error:'Could not settle connected dealer payment'},{status:500});
  }
 }
 const watched=['account.updated','account.application.deauthorized','charge.dispute.created','charge.refunded','payout.failed'];
 if(!watched.includes(event.type))return NextResponse.json({received:true,ignored:true});
 try{
  const status=await checkoutRpc<string>('hcs_record_connect_event',{
   p_event_id:event.id,p_event_type:event.type,p_connected_account_id:connected,
   p_charges_enabled:typeof detail?.charges_enabled==='boolean'?detail.charges_enabled:null,
   p_payouts_enabled:typeof detail?.payouts_enabled==='boolean'?detail.payouts_enabled:null
  });
  if(['charge.dispute.created','charge.refunded','payout.failed','account.application.deauthorized'].includes(event.type)){
   try{await sendShopAlert('security','Dealer Stripe event needs review',
    'Event: '+event.type+'\nConnected account: '+connected+'\nStripe event: '+event.id+'\nResult: '+status+'\nReview refunds, inventory, and payouts manually.')}
   catch(err){console.error('Dealer Stripe alert failed',err)}
  }
  return NextResponse.json({received:true,status});
 }catch(err){console.error('Connect webhook persistence failed',event.id,event.type,err);
  return NextResponse.json({error:'Could not persist connected account event'},{status:500});
 }
}
