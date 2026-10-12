import {NextRequest,NextResponse} from 'next/server';
import {authorized,db,PortalError} from '@/lib/server/portal';
import {stripePost,assertExpectedStripeAccount} from '@/lib/server/stripe';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  if(process.env.SELLER_MEMBERSHIP_SIGNUPS_ENABLED!=='true'||process.env.SELLER_SIGNUPS_ENABLED!=='true'||process.env.STRIPE_MEMBERSHIP_TAX_READY!=='true')
   throw new PortalError('Seller memberships are not open for enrollment yet.',503);
  const c=await authorized(req,'manage');
  if(c.isFounder||c.role!=='owner')throw new PortalError('Only an outside shop owner can manage this membership.',403);
  await assertExpectedStripeAccount();
  const price=process.env.STRIPE_SELLER_STARTER_PRICE_ID;
  if(!price)throw new PortalError('Membership pricing is not configured.',503);
  const [tiers,memberships]=await Promise.all([
   db<Array<{stripe_price_id:string;monthly_fee_cents:number}>>('seller_pricing_tiers?select=stripe_price_id,monthly_fee_cents&code=eq.starter&active=eq.true&limit=1'),
   db<Array<{stripe_subscription_id:string;status:string}>>('seller_memberships?select=stripe_subscription_id,status&seller_id=eq.'+c.sellerId+'&limit=1')
  ]);
  if(tiers[0]?.stripe_price_id!==price||tiers[0]?.monthly_fee_cents!==599)throw new PortalError('Starter membership price does not match the platform.',503);
  if(memberships[0]&&!['canceled','incomplete_expired'].includes(memberships[0].status))
   throw new PortalError('Manage your existing membership in your billing settings.',409);
  const rows=await db<Array<{stripe_customer_id:string}>>('seller_billing_customers?select=stripe_customer_id&seller_id=eq.'+c.sellerId+'&limit=1');
  let customerId=rows[0]?.stripe_customer_id;
  if(!customerId){
   const values=new URLSearchParams({email:c.email,'metadata[seller_id]':c.sellerId,'metadata[app]':'hometown-card-shop'});
   const customer=await stripePost<{id:string}>('customers',values,'hcs-billing-customer-'+c.sellerId);
   if(!customer.id?.startsWith('cus_'))throw new PortalError('Could not create your seller billing profile.',503);
   customerId=customer.id;
   await db('seller_billing_customers',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({seller_id:c.sellerId,stripe_customer_id:customerId})});
  }
  const base=req.nextUrl.origin;
  const values=new URLSearchParams({
   mode:'subscription',customer:customerId,
   'line_items[0][price]':price,'line_items[0][quantity]':'1',
   'client_reference_id':c.sellerId,
   'metadata[seller_id]':c.sellerId,
   'subscription_data[metadata][seller_id]':c.sellerId,
   'subscription_data[metadata][app]':'hometown-card-shop',
   'automatic_tax[enabled]':'true',
   billing_address_collection:'required',
   success_url:base+'/admin/dashboard?membership=completed',
   cancel_url:base+'/admin/dashboard?membership=cancelled',
   'payment_method_types[0]':'card'
  });
  const session=await stripePost<{url?:string|null}>('checkout/sessions',values);
  if(!session.url||!session.url.startsWith('https://checkout.stripe.com/'))throw new PortalError('Billing checkout unavailable.',503);
  return NextResponse.json({url:session.url},{headers:{'Cache-Control':'no-store'}});
 }catch(err){
  if(!(err instanceof PortalError))console.error('Membership checkout failed',err);
  return NextResponse.json({error:err instanceof PortalError?err.message:'Unable to start membership checkout.'},
   {status:err instanceof PortalError?err.code:500,headers:{'Cache-Control':'no-store'}});
 }
}
