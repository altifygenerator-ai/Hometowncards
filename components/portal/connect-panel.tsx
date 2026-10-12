'use client';
import {useEffect,useState} from 'react';
export function ConnectPanel({sellerId}:{sellerId:string}){
 const [data,setData]=useState<{onboardingOpen:boolean;status:{onboarding_status:string;charges_enabled:boolean;payouts_enabled:boolean}|null}|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;fetch('/api/portal/connect',{headers:{'x-seller-id':sellerId},cache:'no-store'}).then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error);return x}).then(x=>{if(active)setData(x)}).catch(e=>{if(active)setError(e.message||'Not available')});return()=>{active=false}},[sellerId]);
 async function start(){setBusy(true);setError('');try{
  const r=await fetch('/api/portal/connect',{method:'POST',headers:{'x-seller-id':sellerId}});
  const x=await r.json();if(!r.ok||!x.url)throw Error(x.error||'Could not start Stripe onboarding');window.location.assign(x.url);
 }catch(e){setError(e instanceof Error?e.message:'Unavailable');setBusy(false)}}
 return <section className="portal-panel"><h2>Stripe dealer payouts</h2><p>Each independent dealer will connect their own Stripe Express account. Your payout details stay with Stripe.</p>
 {data?.status&&<p>Account: {data.status.onboarding_status} · Card payments: {data.status.charges_enabled?'Enabled':'Pending'} · Payouts: {data.status.payouts_enabled?'Enabled':'Pending'}</p>}
 {data?.onboardingOpen?<button className="button button-primary" onClick={start} disabled={busy}>{busy?'Opening Stripe…':'Set up Stripe payouts'}</button>:
 <p>Dealer payout enrollment will open once new seller invitations begin.</p>}
 {error&&<p role="alert" className="portal-error">{error}</p>}</section>;
}
