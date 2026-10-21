'use client';
import Script from 'next/script';import {useCallback,useEffect,useRef,useState} from 'react';
type Api={render:(e:HTMLElement,o:Record<string,unknown>)=>string;reset:(id:string)=>void};
const key=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
export function MarketingSignup(){
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const slot=useRef<HTMLDivElement|null>(null),widget=useRef<string|null>(null);
 const render=useCallback(()=>{const api=(window as Window&{turnstile?:Api}).turnstile;if(!api||!slot.current||widget.current||!key)return;widget.current=api.render(slot.current,{sitekey:key,action:'marketing-signup',callback:(t:string)=>setToken(t),'expired-callback':()=>setToken(''),'error-callback':()=>{setToken('');return false}})},[]);
 useEffect(()=>{render()},[render]);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;setBusy(true);setMessage('');setError('');const f=new FormData(form);
  try{const r=await fetch('/api/marketing/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.get('email'),consent:f.get('consent')==='on',turnstileToken:token})});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not join the list.');setMessage(d.message||'Check your email to confirm.');form.reset();setToken('')}
  catch(e){setError(e instanceof Error?e.message:'Could not join the list.');const api=(window as Window&{turnstile?:Api}).turnstile;if(widget.current)api?.reset(widget.current)}
  finally{setBusy(false)}
 }
 return <section className="footer-newsletter"><h3>Notes from the card counter</h3><p>New sellers, fresh cards, and the occasional shop special.</p><form onSubmit={submit}><label className="sr-only" htmlFor="marketing-email">Email address</label><input id="marketing-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="Your email address" required/><label className="newsletter-consent"><input type="checkbox" name="consent" required/> Send me occasional Hometown Card Shop updates. I can unsubscribe anytime.</label>{key?<><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onLoad={render} strategy="afterInteractive"/><div ref={slot} aria-label="Security verification"/></>:<p>Signup is temporarily unavailable.</p>}<button type="submit" disabled={!token||busy}>{busy?'Joining…':'Join the list'}</button>{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}</form></section>
}
