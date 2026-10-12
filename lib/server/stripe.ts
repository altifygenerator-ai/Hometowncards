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

/**
 * A valid business tax address is NOT a sales-tax permit.
 * Never open real Checkout if Stripe has no active Arkansas sales-tax registration.
 * State/local amounts must be destination-calculated by Stripe Tax, not a flat AR rate.
 */
export async function assertArkansasSalesTaxReady(){
 const secret=process.env.STRIPE_SECRET_KEY;
 if(!secret)throw new PortalError('Payments have not been configured.',503);
 const headers={Authorization:'Bearer '+secret};
 const [settingsResponse,registrationsResponse]=await Promise.all([
  fetch('https://api.stripe.com/v1/tax/settings',{headers,cache:'no-store'}),
  fetch('https://api.stripe.com/v1/tax/registrations?status=active&limit=100',{headers,cache:'no-store'})
 ]);
 if(!settingsResponse.ok||!registrationsResponse.ok)
  throw new PortalError('Tax registration could not be verified.',503);
 const settings=await settingsResponse.json() as {status?:string};
 const registrations=await registrationsResponse.json() as {data?:Array<{country?:string;status?:string;country_options?:{us?:{state?:string;type?:string}}}>;has_more?:boolean};
 if(settings.status!=='active'||!registrations.data?.some(r=>
  r.status==='active'&&r.country==='US'&&r.country_options?.us?.state==='AR'&&
  r.country_options.us.type==='state_sales_tax'))
  throw new PortalError('Arkansas sales-tax registration is required before checkout opens.',503);
}

export async function stripePost<T=StripeCheckoutSession>(path:string,fields:URLSearchParams,idempotencyKey?:string):Promise<T>{
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
 return data as T;
}
export function verifyStripeWebhook(raw:string,signature:string|null,webhookSecret?:string):StripeEvent{
 const secret=webhookSecret||process.env.STRIPE_WEBHOOK_SECRET;
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
