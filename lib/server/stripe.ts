import {createHmac,timingSafeEqual} from 'node:crypto';
import {PortalError} from '@/lib/server/portal';
export type StripeCheckoutSession={
 id:string;url?:string|null;client_reference_id?:string|null;
 payment_status?:string;payment_intent?:string|null;amount_total?:number|null;
 total_details?:{amount_tax?:number};customer_details?:{email?:string|null;name?:string|null};
 collected_information?:{shipping_details?:unknown};shipping_details?:unknown;
};
export type StripeEvent={id:string;type:string;livemode:boolean;data:{object:StripeCheckoutSession}};
export const stripeReady=()=>Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_WEBHOOK_SECRET);
/** Reject the wrong business Stripe key before creating any customer Checkout Session. */
export async function assertExpectedStripeAccount(){
 const secret=process.env.STRIPE_SECRET_KEY,expected=process.env.STRIPE_EXPECTED_ACCOUNT_ID;
 if(!secret||!expected)throw new PortalError('Stripe account configuration is incomplete.',503);
 const r=await fetch('https://api.stripe.com/v1/account',{headers:{Authorization:'Bearer '+secret},cache:'no-store'});
 if(!r.ok)throw new PortalError('Stripe account could not be verified.',503);
 const account=await r.json() as {id?:string;charges_enabled?:boolean};
 if(account.id!==expected||!account.charges_enabled)
  throw new PortalError('This Stripe account is not ready to accept payments.',503);
}
export async function stripePost(path:string,fields:URLSearchParams,idempotencyKey?:string):Promise<StripeCheckoutSession>{
 const secret=process.env.STRIPE_SECRET_KEY;
 if(!secret)throw new PortalError('Payments are not configured yet.',503);
 const res=await fetch('https://api.stripe.com/v1/'+path,{method:'POST',headers:{
  Authorization:'Bearer '+secret,
  'Content-Type':'application/x-www-form-urlencoded',
  ...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})
 },body:fields.toString(),cache:'no-store'});
 const data=await res.json();
 if(!res.ok){console.error('Stripe request failed',res.status,data?.error?.type,data?.error?.code);
  throw new PortalError('We could not start your secure checkout. Please retry.',503);}
 return data as StripeCheckoutSession;
}
export function verifyStripeWebhook(raw:string,signature:string|null):StripeEvent{
 const secret=process.env.STRIPE_WEBHOOK_SECRET;
 if(!secret||!signature)throw new PortalError('Webhook verification unavailable',400);
 const parts=signature.split(',').map(x=>x.trim().split('='));
 const stamp=parts.find(x=>x[0]==='t')?.[1],values=parts.filter(x=>x[0]==='v1').map(x=>x[1]);
 if(!stamp||!/^\d+$/.test(stamp)||!values.length||Math.abs(Math.floor(Date.now()/1000)-Number(stamp))>300)
  throw new PortalError('Invalid webhook signature',400);
 const expected=createHmac('sha256',secret).update(stamp+'.'+raw).digest('hex');
 const verified=values.some(v=>{
  if(!/^[a-f0-9]{64}$/i.test(v))return false;
  return timingSafeEqual(Buffer.from(v,'hex'),Buffer.from(expected,'hex'));
 });
 if(!verified)throw new PortalError('Invalid webhook signature',400);
 return JSON.parse(raw) as StripeEvent;
}
