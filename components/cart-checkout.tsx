'use client';
import Script from 'next/script';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {CartLine} from '@/components/cart-provider';
type Api={render:(el:HTMLElement,o:Record<string,unknown>)=>string;reset:(id:string)=>void};
type Web=Window&{turnstile?:Api};
const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
const live=process.env.NEXT_PUBLIC_STORE_LIVE==='true'&&process.env.NEXT_PUBLIC_CHECKOUT_ENABLED==='true';
export function CartCheckout({lines,bonusSport}:{lines:CartLine[];bonusSport:string}){
 const [busy,setBusy]=useState(false),[token,setToken]=useState(''),[error,setError]=useState('');
 const el=useRef<HTMLDivElement|null>(null),id=useRef<string|null>(null);
 const render=useCallback(()=>{
  const api=(window as Web).turnstile;
  if(!api||!el.current||id.current||!siteKey)return;
  id.current=api.render(el.current,{sitekey:siteKey,action:'checkout',
   callback:(value:string)=>{setToken(value);setError('')},
   'expired-callback':()=>setToken(''),'error-callback':()=>{setToken('');return false}});
 },[]);
 useEffect(()=>{if(live)render()},[render]);
 async function submit(){
  if(!token||busy||!lines.length)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/checkout',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({lines:lines.map(x=>({id:x.id,quantity:x.quantity})),bonusSport,turnstileToken:token})});
   const json=await response.json() as {url?:string;error?:string};
   if(!response.ok||!json.url)throw new Error(json.error||'Checkout is unavailable.');
   window.location.assign(json.url);
  }catch(e){
   setError(e instanceof Error?e.message:'Unable to begin checkout.');
   setToken('');
   const api=(window as Web).turnstile;if(api&&id.current)api.reset(id.current);
  }finally{setBusy(false)}
 }
 if(!live)return <><button className="button button-primary checkout-disabled" disabled>Secure checkout coming soon</button>
 <p className="checkout-explainer">Our online checkout counter will be opening soon.</p></>;
 return <div className="cart-checkout-action">
  {siteKey?<><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={render}/><div ref={el} aria-label="Security check"/></>:<p>Secure checkout is temporarily unavailable.</p>}
  {error&&<p className="portal-error" role="alert">{error}</p>}
  <button className="button button-primary" disabled={busy||!token||!lines.length} onClick={submit}>
   {busy?'Opening secure checkout…':'Continue to secure checkout →'}
  </button>
 </div>;
}
