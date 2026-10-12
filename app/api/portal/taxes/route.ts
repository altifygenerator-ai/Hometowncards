import {NextRequest} from 'next/server';
import {authorized,db,failure,json,PortalError,safeTerm} from '@/lib/server/portal';
type Profile={seller_id:string;collection_mode:'seller_managed'|'connect_stripe_tax';registered_states:string[];
 responsibility_confirmed_at:string|null;updated_at:string;notes:string};
type Payout={provider_account_id:string|null;onboarding_status:string;charges_enabled:boolean;payouts_enabled:boolean};
const STATES=new Set(('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC').split(' '));
export async function GET(req:NextRequest){
 try{
  const {sellerId}=await authorized(req);
  const [profile,payout]=await Promise.all([
   db<Profile[]>('seller_tax_profiles?select=seller_id,collection_mode,registered_states,responsibility_confirmed_at,updated_at,notes&seller_id=eq.'+sellerId+'&limit=1'),
   db<Payout[]>('seller_payout_accounts?select=provider_account_id,onboarding_status,charges_enabled,payouts_enabled&seller_id=eq.'+sellerId+'&limit=1')
  ]);
  const account=payout[0];
  return json({tax:profile[0]||{collection_mode:'seller_managed',registered_states:[],responsibility_confirmed_at:null,notes:''},
   connect:{connected:Boolean(account?.provider_account_id),status:account?.onboarding_status||'not_started',
    chargesEnabled:account?.charges_enabled===true,payoutsEnabled:account?.payouts_enabled===true},
   checkoutNote:'Connect does not automatically register a seller for taxes. Seller taxes and Connect payment routing require verified readiness before marketplace selling is enabled.'});
 }catch(e){return failure(e)}
}
export async function PATCH(req:NextRequest){
 try{
  const {sellerId,userId}=await authorized(req,'manage');
  const data=await req.json() as Record<string,unknown>;
  const mode=data.collectionMode,states=data.registeredStates,ack=data.responsibilityConfirmed===true;
  if(mode!=='seller_managed'&&mode!=='connect_stripe_tax')throw new PortalError('Unknown seller tax mode.',400);
  if(!Array.isArray(states)||states.length>50||states.some(s=>typeof s!=='string'||!STATES.has(s)))
   throw new PortalError('Enter only valid US state abbreviations for actual registrations.',400);
  const registeredStates=[...new Set(states as string[])];
  const payout=await db<Payout[]>('seller_payout_accounts?select=provider_account_id,onboarding_status,charges_enabled,payouts_enabled&seller_id=eq.'+sellerId+'&limit=1');
  if(mode==='connect_stripe_tax'&&(!payout[0]?.provider_account_id||!payout[0].charges_enabled))
   throw new PortalError('Complete the seller Stripe Connect onboarding before choosing Connect Stripe Tax.',409);
  if(registeredStates.length>0&&!ack)throw new PortalError('Confirm tax responsibility before saving registered states.',400);
  const notes=safeTerm(data.notes,700);
  const row={seller_id:sellerId,collection_mode:mode,registered_states:registeredStates,
   responsibility_confirmed_at:ack?new Date().toISOString():null,
   last_reviewed_at:new Date().toISOString(),last_reviewed_by:userId,notes,updated_at:new Date().toISOString()};
  await db('seller_tax_profiles?on_conflict=seller_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([row])});
  return json({ok:true,tax:{collection_mode:mode,registered_states:registeredStates,notes},marketplaceCheckoutActive:false});
 }catch(e){return failure(e)}
}
