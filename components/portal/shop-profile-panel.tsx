'use client';
import {useEffect,useState} from 'react';
type P={slug:string;display_name:string;status:string;bio:string;public_email:string|null;logo_url:string|null;region:string|null;customer_service_policy:string;returns_policy:string;handling_days:number};
export function ShopProfilePanel({sellerId}:{sellerId:string}){
 const [shop,setShop]=useState<P|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{let active=true;fetch('/api/portal/profile',{headers:{'x-seller-id':sellerId},cache:'no-store'})
  .then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Shop unavailable');return x.shop as P})
  .then(s=>{if(active)setShop(s)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[sellerId]);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');setNotice('');
  const fd=new FormData(e.currentTarget);
  const x={displayName:fd.get('displayName'),bio:fd.get('bio'),region:fd.get('region'),publicEmail:fd.get('publicEmail'),
   logoUrl:fd.get('logoUrl'),returnsPolicy:fd.get('returnsPolicy'),customerServicePolicy:fd.get('customerServicePolicy'),handlingDays:Number(fd.get('handlingDays'))};
  try{const r=await fetch('/api/portal/profile',{method:'PATCH',headers:{'Content-Type':'application/json','x-seller-id':sellerId},body:JSON.stringify(x)});
  const j=await r.json();if(!r.ok)throw Error(j.error||'Could not update shop');setNotice('Shop profile updated.');}
  catch(e){setError(e instanceof Error?e.message:'Shop update failed')}finally{setBusy(false)}
 }
 return <section className="portal-panel"><h2>Storefront and seller policies</h2>
 <p>Your own seller page is <a href={'/sellers/'+shop?.slug} target="_blank" rel="noreferrer">/sellers/{shop?.slug} ↗</a>. Only approved shops appear publicly. Buyers see your terms before buying.</p>
 {shop?.status&&<p>Current shop status: <strong>{shop.status}</strong>.</p>}
 {error&&<p role="alert" className="portal-alert portal-alert-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
 {shop?<form onSubmit={submit} className="portal-login-form">
 <label>Public shop name<input name="displayName" required minLength={3} maxLength={100} defaultValue={shop.display_name}/></label>
 <label>Shop description<textarea name="bio" rows={4} maxLength={2000} defaultValue={shop.bio}/></label>
 <label>City/Region<input name="region" maxLength={150} defaultValue={shop.region||''}/></label>
 <label>Public contact email<input name="publicEmail" type="email" maxLength={254} defaultValue={shop.public_email||''}/></label>
 <label>Logo URL (HTTPS)<input name="logoUrl" type="url" maxLength={1400} defaultValue={shop.logo_url||''}/></label>
 <label>Processing time (business days)<input name="handlingDays" type="number" min={0} max={30} required defaultValue={shop.handling_days}/></label>
 <label>Returns and refunds policy<textarea name="returnsPolicy" rows={5} maxLength={3500} defaultValue={shop.returns_policy}/></label>
 <label>Customer service/shipping policy<textarea name="customerServicePolicy" rows={5} maxLength={3500} defaultValue={shop.customer_service_policy}/></label>
 <button type="submit" className="button button-primary" disabled={busy}>{busy?'Saving…':'Save storefront'}</button></form>:!error?<p>Loading shop profile…</p>:null}
 </section>;
}
