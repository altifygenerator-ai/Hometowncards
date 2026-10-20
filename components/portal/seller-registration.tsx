'use client';
import Script from 'next/script';import {useEffect,useRef,useState,useCallback} from 'react';
type Api={render:(e:HTMLElement,options:Record<string,unknown>)=>string;reset:(id:string)=>void};
const key=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
export function SellerRegistration(){
 const [token,setToken]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[complete,setComplete]=useState(false);
 const slot=useRef<HTMLDivElement|null>(null),widget=useRef<string|null>(null);
 const render=useCallback(()=>{const api=(window as Window&{turnstile?:Api}).turnstile;
  if(!api||!key||!slot.current||widget.current)return;
  widget.current=api.render(slot.current,{sitekey:key,action:'seller-register',callback:(t:string)=>setToken(t),
   'expired-callback':()=>setToken(''),'error-callback':()=>{setToken('');return false}});
 },[]);
 useEffect(()=>{render()},[render]);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setError('');setBusy(true);
  const values=Object.fromEntries(new FormData(e.currentTarget).entries());
  try{const r=await fetch('/api/seller/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,turnstileToken:token})});
   const b=await r.json();if(!r.ok||!b.ok)throw Error(b.error||'Registration failed');setComplete(true);
  }catch(x){setError(x instanceof Error?x.message:'Could not create account');setToken('');
   const api=(window as Window&{turnstile?:Api}).turnstile;if(widget.current)api?.reset(widget.current);
  }finally{setBusy(false);}
 }
 if(complete)return <div className="dealer-thanks"><h2>Check your email!</h2><p>Verify your account, then we can review your seller application. You'll receive access to inventory uploads, eBay sync, and your own storefront once approved.</p></div>;
 return <form onSubmit={submit} className="dealer-interest-form">
  <div className="dealer-form-grid">
   <label>Shop name<input name="shopName" minLength={3} maxLength={100} required placeholder="Your card shop name"/></label>
   <label>Email<input name="email" type="email" required autoComplete="email" maxLength={254}/></label>
   <label>Password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/></label>
  </div>
  <p className="dealer-form-note">Applications are reviewed before shops are made public. You'll need an email-verified account, your own inventory and shipping rules, and Stripe Connect for payouts. No purchase or membership payment is required to apply.</p>
  {key?<><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onLoad={render} strategy="afterInteractive"/><div ref={slot} aria-label="Security verification"/></>:<p>Secure registration is unavailable right now.</p>}
  {error&&<p role="alert" className="dealer-error">{error}</p>}
  <button className="button button-primary" type="submit" disabled={busy||!token}>{busy?'Registering…':'Apply to open your shop →'}</button>
 </form>;
}
