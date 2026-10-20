'use client';
import {useCallback,useEffect,useState} from 'react';
type App={id:string;shop_name:string;contact_email:string;status:string;created_at:string};
type Seller={id:string;slug:string;display_name:string;status:string;contact_email:string;created_at:string};
export function SellerApplicationsPanel(){
 const [apps,setApps]=useState<App[]>([]),[shops,setShops]=useState<Seller[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const refresh=useCallback(async()=>{
  const r=await fetch('/api/portal/seller-applications',{cache:'no-store'});const x=await r.json();
  if(!r.ok)throw Error(x.error||'Unable to load applications');setApps(x.applications);setShops(x.sellers);
 },[]);
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[refresh]);
 async function action(which:string,id:string){
  if(!window.confirm((which==='approve'?'Approve this dealer for account setup':which==='activate'?'Publish this seller shop after payout, tax and shipping verification':'Decline this application')+'?'))return;
  setBusy(id);setError('');
  try{const r=await fetch('/api/portal/seller-applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:which,...(which==='activate'?{sellerId:id}:{applicationId:id})})});const d=await r.json();if(!r.ok)throw Error(d.error||'Update failed');await refresh();}
  catch(e){setError(e instanceof Error?e.message:'Update failed');}finally{setBusy('');}
 }
 return <div className="portal-panels"><section className="portal-panel"><h2>Dealer applications</h2><p>Verify applicant email before approval. Approval creates a private seller workspace; public selling waits until Connect, shipping, and taxes are ready.</p>
 {error&&<p role="alert" className="portal-alert portal-alert-error">{error}</p>}
 {apps.length===0?<p>No dealer applications yet.</p>:apps.map(a=><div key={a.id} className="portal-profile"><strong>{a.shop_name}</strong><p>{a.contact_email} · {a.status} · {new Date(a.created_at).toLocaleDateString()}</p>
 {['received','review'].includes(a.status)&&<><button disabled={!!busy} className="button button-primary" onClick={()=>action('approve',a.id)}>Approve account</button> <button disabled={!!busy} className="button button-outline" onClick={()=>action('decline',a.id)}>Decline</button></>}</div>)}
 </section><section className="portal-panel"><h2>Independent shop launch checklist</h2>
 {shops.map(s=><div key={s.id} className="portal-profile"><strong>{s.display_name}</strong><p>/sellers/{s.slug} · {s.status}</p>
 {s.status==='pending'&&<button className="button button-primary" disabled={!!busy} onClick={()=>action('activate',s.id)}>Verify and publish shop</button>}</div>)}
 {shops.length===0&&<p>No outside sellers yet.</p>}</section></div>;
}
