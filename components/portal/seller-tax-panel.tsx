'use client';
import {useCallback,useEffect,useState} from 'react';
type Profile={collection_mode:'seller_managed'|'connect_stripe_tax';registered_states:string[];responsibility_confirmed_at:string|null;notes:string};
type Read={tax:Profile;connect:{connected:boolean;status:string;chargesEnabled:boolean;payoutsEnabled:boolean};checkoutNote:string};
export function SellerTaxPanel({sellerId,isFounder}:{sellerId:string;isFounder:boolean}){
 const [data,setData]=useState<Read|null>(null),[states,setStates]=useState(''),[mode,setMode]=useState<Profile['collection_mode']>('seller_managed'),[ack,setAck]=useState(false),[notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const r=await fetch('/api/portal/taxes',{headers:{'x-seller-id':sellerId},cache:'no-store'});
  const json=await r.json() as Read&{error?:string};
  if(!r.ok)throw Error(json.error||'Tax setup unavailable.');
  setData(json);setStates(json.tax.registered_states.join(', '));setMode(json.tax.collection_mode);
  setAck(!!json.tax.responsibility_confirmed_at);setNotes(json.tax.notes||'');
 },[sellerId]);
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:'Could not load seller taxes.'))},[load]);
 async function save(){
  if(!data)return;
  setBusy(true);setError('');setNotice('');
  try{
   const registeredStates=states.toUpperCase().split(/[,\s]+/).filter(Boolean);
   const r=await fetch('/api/portal/taxes',{method:'PATCH',headers:{'Content-Type':'application/json','x-seller-id':sellerId},
    body:JSON.stringify({collectionMode:mode,registeredStates,responsibilityConfirmed:ack,notes})});
   const json=await r.json() as {error?:string};
   if(!r.ok)throw Error(json.error||'Could not save tax preferences.');
   setNotice('Tax preferences saved. Seller payment onboarding and verification are separate.');
   await load();
  }catch(e){setError(e instanceof Error?e.message:'Unable to save.')}finally{setBusy(false)}
 }
 return <section className="portal-panel">
  <h2>Tax responsibility &amp; Stripe Connect</h2>
  <p>{isFounder?'Your shop calculates Arkansas tax from official Arkansas jurisdiction files. Payments go to Hometown Card Shop’s own Stripe account.':
   'Your seller account uses Stripe Connect for its payments when approved. Seller tax calculations are separate from Stripe payouts.'}</p>
  {!data?<p>Loading seller tax settings…</p>:<>
   <p><b>Stripe Connect:</b> {data.connect.connected?data.connect.status:'Not connected'} · Charges {data.connect.chargesEnabled?'enabled':'not enabled'} · Payouts {data.connect.payoutsEnabled?'enabled':'not enabled'}</p>
   {!isFounder&&<label>Seller tax calculation mode<select value={mode} onChange={e=>setMode(e.target.value as Profile['collection_mode'])}>
    <option value="seller_managed">Seller-managed tax reporting</option>
    <option value="connect_stripe_tax" disabled={!data.connect.chargesEnabled}>Stripe Tax on seller’s connected account (requires its own registration)</option>
   </select></label>}
   <label>States where the business is already registered to collect sales tax (comma-separated, e.g. AR, TX)
    <input value={states} onChange={e=>setStates(e.target.value)} placeholder="Leave blank until actually registered"/>
   </label>
   <label>Seller tax notes<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value.slice(0,700))}/></label>
   <label className="hcs-seller-tax-ack"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>
    <span>I understand I must confirm tax registrations and filing responsibilities before sales tax is collected.</span></label>
   <p><small>Stripe Connect does not register sellers for sales tax, decide who is the marketplace facilitator, or file returns automatically. Connected seller checkout remains off until payment routing, tax, refunds and settlement tests are completed.</small></p>
   {error&&<p className="portal-error" role="alert">{error}</p>}
   {notice&&<p role="status">{notice}</p>}
   <button className="button button-primary" disabled={busy} onClick={save}>{busy?'Saving…':'Save seller tax preferences'}</button>
  </>}
 </section>;
}