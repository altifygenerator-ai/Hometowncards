'use client';
import Script from 'next/script';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {CartLine} from '@/components/cart-provider';
type Api={render:(el:HTMLElement,o:Record<string,unknown>)=>string;reset:(id:string)=>void};
type Web=Window&{turnstile?:Api};
type Option={profileId:string;service:string;shippingClass:'economy'|'tracked'|'insured';tracked:boolean;insuranceCoverageCents:number;chargeCents:number;weightOz:number};
const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
const live=process.env.NEXT_PUBLIC_STORE_LIVE==='true'&&process.env.NEXT_PUBLIC_CHECKOUT_ENABLED==='true';
const money=(c:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export function CartCheckout({lines,bonusSport}:{lines:CartLine[];bonusSport:string}){
 const [busy,setBusy]=useState(false),[token,setToken]=useState(''),[error,setError]=useState('');
 const [options,setOptions]=useState<Option[]|null>(null),[selected,setSelected]=useState('');
 const [subtotal,setSubtotal]=useState<number|null>(null);
 const el=useRef<HTMLDivElement|null>(null),id=useRef<string|null>(null);
 const render=useCallback(()=>{
  const api=(window as Web).turnstile;
  if(!api||!el.current||id.current||!siteKey)return;
  id.current=api.render(el.current,{sitekey:siteKey,action:'checkout',
   callback:(value:string)=>{setToken(value);setError('')},
   'expired-callback':()=>setToken(''),'error-callback':()=>{setToken('');return false}});
 },[]);
 useEffect(()=>{if(live)render()},[render]);
 useEffect(()=>{
  if(!live||!lines.length)return;
  let active=true;const controller=new AbortController();
  setOptions(null);setSelected('');
  fetch('/api/shipping/options',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({lines:lines.map(x=>({id:x.id,quantity:x.quantity}))}),signal:controller.signal})
    .then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Rates unavailable');return x as {options:Option[];subtotalCents:number}})
    .then(data=>{if(active){setOptions(data.options);setSubtotal(data.subtotalCents);setSelected(data.options[0]?.profileId||'');}})
    .catch(e=>{if(active&&e.name!=='AbortError'){setOptions([]);setError(e instanceof Error?e.message:'Could not load shipping options.')}});
  return()=>{active=false;controller.abort()};
 },[lines]);
 async function submit(){
  if(!token||busy||!lines.length||!selected)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({lines:lines.map(x=>({id:x.id,quantity:x.quantity})),bonusSport,shippingProfileId:selected,turnstileToken:token})});
   const json=await response.json() as {url?:string;error?:string};
   if(!response.ok||!json.url)throw new Error(json.error||'Checkout is unavailable.');
   window.location.assign(json.url);
  }catch(e){setError(e instanceof Error?e.message:'Unable to begin checkout.');setToken('');
   const api=(window as Web).turnstile;if(api&&id.current)api.reset(id.current);
  }finally{setBusy(false)}
 }
 if(!live)return <><button className="button button-primary checkout-disabled" disabled>Secure checkout coming soon</button>
 <p className="checkout-explainer">Our online checkout counter will be opening soon.</p></>;
 const opt=options?.find(x=>x.profileId===selected);
 return <div className="cart-checkout-action">
  <section className="cart-shipping-choices" aria-label="Choose a shipping option">
   <strong>Shipping options</strong>
   {options===null?<p>Checking available shipping services…</p>:options.length===0?<p>Shipping isn’t configured for these cards yet. Please contact the shop.</p>:options.map(x=>
    <label key={x.profileId} className="cart-shipping-choice">
     <input type="radio" name="shippingProfile" checked={selected===x.profileId} onChange={()=>setSelected(x.profileId)}/>
     <span><b>{x.service}</b><small>{x.shippingClass==='economy'?'Low-cost letter · no package tracking':x.shippingClass==='insured'?'Tracking and insured coverage':'Tracked parcel'} · approx. {x.weightOz.toFixed(2)} oz</small></span>
     <b>{money(x.chargeCents)}</b>
    </label>)}
   {opt&&subtotal!==null&&<p className="cart-shipping-total">Merchandise + shipping: <strong>{money(subtotal+opt.chargeCents)}</strong> before applicable taxes.</p>}
  </section>
  {siteKey?<><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={render}/><div ref={el} aria-label="Security check"/></>:<p>Secure checkout is temporarily unavailable.</p>}
  {error&&<p className="portal-error" role="alert">{error}</p>}
  <button className="button button-primary" disabled={busy||!token||!selected||!lines.length} onClick={submit}>
   {busy?'Opening secure checkout…':'Continue to secure checkout →'}
  </button>
 </div>;
}
