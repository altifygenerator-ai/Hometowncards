'use client';
import {useEffect,useState} from 'react';
import {ConnectPanel} from '@/components/portal/connect-panel';
type MemberData={isFounder:boolean;role:string;currentCommissionBps:number;appliedPlan:string;
 membershipEnrollmentOpen:boolean;membership:{status:string;current_period_end:string|null;cancel_at_period_end:boolean}|null;
 tiers:Array<{code:string;display_name:string;monthly_fee_cents:number;sales_commission_bps:number}>};
export function MembershipPanel({sellerId}:{sellerId:string}){
 const [data,setData]=useState<MemberData|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;fetch('/api/portal/membership',{headers:{'x-seller-id':sellerId},cache:'no-store'}).then(async r=>{
  const x=await r.json();if(!r.ok)throw Error(x.error||'Unable to load pricing');return x;
 }).then(x=>{if(live)setData(x)}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Unable to load membership')});return()=>{live=false}},[sellerId]);
 async function action(which:'checkout'|'portal'){
  setBusy(true);setError('');
  try{const res=await fetch('/api/portal/membership/'+which,{method:'POST',headers:{'x-seller-id':sellerId}});const x=await res.json();
   if(!res.ok||!x.url)throw Error(x.error||'Billing request failed');window.location.assign(x.url);
  }catch(e){setError(e instanceof Error?e.message:'Billing request failed');setBusy(false)}
 }
 return <div className="portal-panels">
  <section className="portal-panel"><h2>Seller pricing</h2>
   <p>Two ways to sell at Hometown Card Shop. Card processing and shipping are separate from the marketplace commission.</p>
   {data?.tiers?.map(t=><div className="portal-profile" key={t.code}><strong>{t.display_name}</strong>
    <p>{t.monthly_fee_cents===0?'No monthly membership':(t.monthly_fee_cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})+' per month'} · {t.sales_commission_bps/100}% per merchandise sale</p>
   </div>)}
   {!data&&!error&&<p>Loading your plan…</p>}
   {error&&<p role="alert" className="portal-alert portal-alert-error">{error}</p>}
  </section>
  {data&&<section className="portal-panel"><h2>Your plan</h2>
   <p><strong>{data.isFounder?'Founding shop · No platform fees':data.appliedPlan==='starter'?'Starter Member':'Pay As You Sell'}</strong></p>
   <p>Marketplace commission: <strong>{data.currentCommissionBps/100}%</strong> of merchandise sales. Past order fees remain locked at the plan applied when purchased.</p>
   {data.membership&&<p>Subscription: {data.membership.status}. {data.membership.current_period_end?'Current period ends '+new Date(data.membership.current_period_end).toLocaleDateString('en-US')+'.':''}{data.membership.cancel_at_period_end?' Scheduled to cancel at period end.':''}</p>}
   {data.isFounder?<p>Your original shop is permanently exempt from marketplace commissions and seller subscriptions.</p>:
    <>{data.membership&&data.role==='owner'&&<button disabled={busy} className="button button-outline" onClick={()=>action('portal')}>Manage billing and cancellation</button>}
    {!data.membership&&data.membershipEnrollmentOpen&&data.role==='owner'&&<button disabled={busy} className="button button-primary" onClick={()=>action('checkout')}>Join Starter for $5.99/month</button>}
    {!data.membership&&!data.membershipEnrollmentOpen&&<p>Membership enrollment opens when we begin welcoming additional sellers.</p>}</>}
  </section>}
  {data&&!data.isFounder&&data.role==='owner'&&<ConnectPanel sellerId={sellerId}/>}
 </div>;
}
