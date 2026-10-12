import {NextRequest} from 'next/server';
import {authorized,db,failure,json} from '@/lib/server/portal';
type Tier={code:string;display_name:string;monthly_fee_cents:number;sales_commission_bps:number};
type Membership={tier_code:string;status:string;current_period_end:string|null;cancel_at_period_end:boolean};
export async function GET(req:NextRequest){
 try{
  const c=await authorized(req);
  const [tiers,rows]=await Promise.all([
   db<Tier[]>('seller_pricing_tiers?select=code,display_name,monthly_fee_cents,sales_commission_bps&active=eq.true&order=monthly_fee_cents.asc'),
   db<Membership[]>('seller_memberships?select=tier_code,status,current_period_end,cancel_at_period_end&seller_id=eq.'+c.sellerId+'&limit=1')
  ]);
  const membership=rows[0]||null;
  const active=!!membership&&membership.status==='active'&&!!membership.current_period_end&&Date.parse(membership.current_period_end)>Date.now();
  return json({isFounder:c.isFounder,role:c.role,tiers,
    appliedPlan:c.isFounder?'founder':active?'starter':'payg',
    currentCommissionBps:c.isFounder||active?0:200,
    membership,membershipEnrollmentOpen:
    !c.isFounder&&process.env.SELLER_MEMBERSHIP_SIGNUPS_ENABLED==='true'&&
    process.env.SELLER_SIGNUPS_ENABLED==='true'&&process.env.STRIPE_MEMBERSHIP_TAX_READY==='true'});
 }catch(e){return failure(e)}
}
