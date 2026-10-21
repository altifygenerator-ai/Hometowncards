import {NextRequest} from 'next/server';
import {authorized,db,failure,json,PortalError} from '@/lib/server/portal';
import {stripePost,assertExpectedStripeAccount} from '@/lib/server/stripe';
import {sendShopAlert} from '@/lib/server/alerts';
export const runtime='nodejs';
type Order={id:string;seller_id:string;status:string;orders:{id:string;status:string;stripe_payment_intent_id:string|null;total_cents:number}};
type Acc={provider_account_id:string|null;onboarding_status:string};
export async function POST(req:NextRequest){
 try{
  const actor=await authorized(req,'manage');
  if(actor.isFounder||actor.role!=='owner')throw new PortalError('Only the independent shop owner may refund one of their orders here.',403);
  const b=await req.json() as {sellerOrderId?:string;acknowledge?:boolean};
  if(b.acknowledge!==true||!/^[0-9a-f-]{36}$/i.test(b.sellerOrderId||''))throw new PortalError('Confirm that you intend to refund this full order.',400);
  await assertExpectedStripeAccount();
  const orders=await db<Order[]>('seller_orders?select=id,seller_id,status,orders!inner(id,status,stripe_payment_intent_id,total_cents)&id=eq.'+b.sellerOrderId+'&seller_id=eq.'+actor.sellerId+'&limit=1');
  const so=orders[0];
  if(!so||!so.orders?.stripe_payment_intent_id||!['paid','fulfilled','partially_refunded'].includes(so.orders.status))
   throw new PortalError('Only completed payments from your own seller account can be refunded.',409);
  const profiles=await db<Acc[]>('seller_payout_accounts?select=provider_account_id,onboarding_status&seller_id=eq.'+actor.sellerId+'&limit=1');
  const account=profiles[0]?.provider_account_id;
  if(!account?.startsWith('acct_'))throw new PortalError('Your connected payment account is unavailable.',409);
  const intent=so.orders.stripe_payment_intent_id;
  const secret=process.env.STRIPE_SECRET_KEY;
  if(!secret)throw new PortalError('Stripe payments are not configured.',503);
  const check=await fetch('https://api.stripe.com/v1/payment_intents/'+encodeURIComponent(intent),{
   headers:{Authorization:'Bearer '+secret,'Stripe-Account':account},cache:'no-store'});
  const pi=await check.json() as {id?:string;status?:string;amount_received?:number};
  if(!check.ok||pi.id!==intent||pi.status!=='succeeded')throw new PortalError('The seller payment could not be independently verified in Stripe.',409);
  const form=new URLSearchParams({payment_intent:intent,reason:'requested_by_customer',refund_application_fee:'true',
   'metadata[order_id]':so.orders.id,'metadata[seller_id]':actor.sellerId});
  const refund=await stripePost<{id:string;status:string}>('refunds',form,'hcs-seller-full-refund-'+so.orders.id,account);
  if(!refund.id?.startsWith('re_'))throw new PortalError('Stripe did not confirm a refund attempt.',503);
  try{await sendShopAlert('order','Independent seller initiated full refund',
   'Seller ID: '+actor.sellerId+'\nOrder: '+so.orders.id+'\nRefund ID: '+refund.id+'\nStatus: '+refund.status+
   '\nPlatform commission is refunded proportionately by Stripe. Webhook reconciliation will update the seller order.');}
  catch(e){console.error('Seller refund alert could not be delivered',e)}
  return json({ok:true,status:refund.status,message:'Stripe has received your refund request. Refresh orders after Stripe confirms the refund.'});
 }catch(e){return failure(e)}
}
