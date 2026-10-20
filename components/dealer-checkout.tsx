'use client';
import Script from 'next/script';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {CartLine} from '@/components/cart-provider';
type Api={render:(el:HTMLElement,o:Record<string,unknown>)=>string;reset:(id:string)=>void};
const key=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
export function DealerCheckout({sellerId,lines}:{sellerId:string;lines:CartLine[]}){
 const [busy,setBusy]=useState(false),[token,setToken]=useState(''),[error,setError]=useState('');
 const [open,setOpen]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;fetch('/api/dealer/checkout',{cache:'no-store'}).then(r=>r.json()).then(x=>{if(active){setOpen(x.available===true);setLoading(false)}}).catch(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 const slot=useRef<HTMLDivElement|null>(null),widget=useRef<string|null>(null);
 const render=useCallback(()=>{const api=(window as Window&{turnstile?:Api}).turnstile;
  if(!api||!slot.current||widget.current||!key)return;
  widget.current=api.render(slot.current,{sitekey:key,action:'checkout',callback:(t:string)=>setToken(t),'expired-callback':()=>setToken(''),
   'error-callback':()=>{setToken('');return false}});
 },[]);
 useEffect(()=>{if(open)render()},[render,open]);
 async function checkout(){if(!token||busy)return;setBusy(true);setError('');
  try{const r=await fetch('/api/dealer/checkout',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({sellerId,lines:lines.map(l=>({id:l.id,quantity:l.quantity})),turnstileToken:token})});
   const data=await r.json();if(!r.ok||!data.url)throw Error(data.error||'Dealer checkout unavailable');
   window.location.assign(data.url);
  }catch(e){setError(e instanceof Error?e.message:'Unable to open checkout');setToken('');
   if(widget.current)(window as Window&{turnstile?:Api}).turnstile?.reset(widget.current);
   setBusy(false);}
 }
 if(!open)return <p className="summary-fine" role="status">{loading?'Checking seller checkout…':'This independent seller\'s checkout is being prepared. Your cards are saved in this deal, and no payment can be taken yet.'}</p>;
 return <div><p className="summary-fine">Each seller handles their own fulfillment. Final shipping and tax amounts are shown before you pay, securely through the seller's Stripe account.</p>
 {key?<><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onLoad={render} strategy="afterInteractive"/>
 <div ref={slot} aria-label="Security verification"/></>:<p>Checkout security check is unavailable.</p>}
 {error&&<p role="alert" className="portal-alert portal-alert-error">{error}</p>}
 <button className="button button-primary" type="button" disabled={!token||busy} onClick={checkout}>{busy?'Opening checkout…':'Checkout this seller deal →'}</button>
 </div>;
}
