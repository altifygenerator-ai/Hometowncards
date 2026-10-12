import {NextRequest,NextResponse} from 'next/server';
import {authorized,db,PortalError} from '@/lib/server/portal';
import {stripePost,assertExpectedStripeAccount} from '@/lib/server/stripe';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 try{
  const c=await authorized(req,'manage');
  if(c.isFounder||c.role!=='owner')throw new PortalError('Membership billing is available to seller owners.',403);
  await assertExpectedStripeAccount();
  const customers=await db<Array<{stripe_customer_id:string}>>('seller_billing_customers?select=stripe_customer_id&seller_id=eq.'+c.sellerId+'&limit=1');
  if(!customers[0])throw new PortalError('You do not have a billing profile yet.',404);
  const values=new URLSearchParams({customer:customers[0].stripe_customer_id,return_url:req.nextUrl.origin+'/admin/dashboard'});
  const session=await stripePost<{url:string}>('billing_portal/sessions',values);
  if(!session.url||!session.url.startsWith('https://billing.stripe.com/'))throw new PortalError('Billing portal is temporarily unavailable.',503);
  return NextResponse.json({url:session.url},{headers:{'Cache-Control':'no-store'}});
 }catch(err){if(!(err instanceof PortalError))console.error('Billing portal unavailable',err);
  return NextResponse.json({error:err instanceof PortalError?err.message:'Unable to open billing portal.'},
  {status:err instanceof PortalError?err.code:500,headers:{'Cache-Control':'no-store'}});
 }
}
