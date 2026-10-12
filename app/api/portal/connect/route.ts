import {NextRequest,NextResponse} from 'next/server';
import {authorized,db,PortalError} from '@/lib/server/portal';
import {stripePost,assertExpectedStripeAccount} from '@/lib/server/stripe';
export const runtime='nodejs';
type Connection={provider_account_id:string|null;onboarding_status:string;charges_enabled:boolean;payouts_enabled:boolean};
async function owner(req:NextRequest){
 const c=await authorized(req,'manage');
 if(c.isFounder||c.role!=='owner')throw new PortalError('Only approved outside dealer owners may connect payout accounts.',403);
 const members=await db<Array<{role:string}>>('seller_members?select=role&seller_id=eq.'+c.sellerId+'&user_id=eq.'+c.userId+'&limit=1');
 if(members[0]?.role!=='owner')throw new PortalError('A verified seller-owner membership is required.',403);
 return c;
}
function err(e:unknown){
 if(!(e instanceof PortalError))console.error('Connect onboarding operation failed',e);
 return NextResponse.json({error:e instanceof PortalError?e.message:'Unable to continue dealer onboarding.'},
 {status:e instanceof PortalError?e.code:500,headers:{'Cache-Control':'no-store'}});
}
export async function GET(req:NextRequest){
 try{const c=await owner(req);const records=await db<Connection[]>('seller_payout_accounts?select=provider_account_id,onboarding_status,charges_enabled,payouts_enabled&seller_id=eq.'+c.sellerId+'&limit=1');
  return NextResponse.json({status:records[0]||null,onboardingOpen:process.env.STRIPE_CONNECT_ONBOARDING_ENABLED==='true'},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return err(e)}
}
export async function POST(req:NextRequest){
 try{
  if(process.env.STRIPE_CONNECT_ONBOARDING_ENABLED!=='true'||process.env.SELLER_SIGNUPS_ENABLED!=='true')
   throw new PortalError('Dealer payout onboarding is not open yet.',503);
  const c=await owner(req);
  const settings=await db<Array<{seller_signup_enabled:boolean}>>('marketplace_settings?select=seller_signup_enabled&id=eq.true&limit=1');
  if(!settings[0]?.seller_signup_enabled)throw new PortalError('Marketplace seller onboarding is closed.',503);
  await assertExpectedStripeAccount();
  const rows=await db<Connection[]>('seller_payout_accounts?select=provider_account_id,onboarding_status,charges_enabled,payouts_enabled&seller_id=eq.'+c.sellerId+'&limit=1');
  let id=rows[0]?.provider_account_id;
  if(!id){
   const fields=new URLSearchParams({type:'express',country:'US',email:c.email,
     'capabilities[card_payments][requested]':'true','capabilities[transfers][requested]':'true',
     'metadata[app]':'hometown-card-shop','metadata[seller_id]':c.sellerId});
   const acct=await stripePost<{id:string}>('accounts',fields,'hcs-connect-'+c.sellerId);
   if(!acct.id?.startsWith('acct_'))throw new PortalError('Stripe seller account could not be created.',503);
   id=acct.id;
   await db('seller_payout_accounts?on_conflict=seller_id',{
    method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},
    body:JSON.stringify({seller_id:c.sellerId,provider:'stripe_connect',provider_account_id:id,onboarding_status:'pending'})});
  }
  const base=req.nextUrl.origin;
  const values=new URLSearchParams({account:id,type:'account_onboarding',
   refresh_url:base+'/admin/dashboard?connect=retry',return_url:base+'/admin/dashboard?connect=returned'});
  const link=await stripePost<{url:string}>('account_links',values);
  if(!link.url||!link.url.startsWith('https://connect.stripe.com/'))throw new PortalError('Stripe onboarding is unavailable.',503);
  return NextResponse.json({url:link.url},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return err(e)}
}
