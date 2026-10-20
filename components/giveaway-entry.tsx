'use client';
import Script from 'next/script';import {useCallback,useEffect,useRef,useState} from 'react';
type Api={render:(e:HTMLElement,o:Record<string,unknown>)=>string;reset:(id:string)=>void};
const key=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
export function GiveawayEntry({isOpen}:{isOpen:boolean}){
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 const slot=useRef<HTMLDivElement|null>(null),widget=useRef<string|null>(null);
 const render=useCallback(()=>{const api=(window as Window&{turnstile?:Api}).turnstile;
  if(!api||!slot.current||widget.current||!key)return;
  widget.current=api.render(slot.current,{sitekey:key,action:'giveaway-entry',callback:(t:string)=>setToken(t),'expired-callback':()=>setToken(''),
   'error-callback':()=>{setToken('');return false}});
 },[]);
 useEffect(()=>{if(isOpen)render()},[render,isOpen]);
 if(!isOpen)return <div className="dealer-thanks"><h2>Giveaway details being finalized</h2><p>The Stan Musial card giveaway is coming soon. We will open free entries after the prize photo, value, and official rules have been published.</p></div>;
 if(done)return <div className="dealer-thanks"><h2>Check your inbox!</h2><p>Confirm your email with the link we sent. Only confirmed free entries are eligible for the drawing.</p></div>;
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');
  const f=new FormData(e.currentTarget);const b={name:f.get('name'),email:f.get('email'),
   age18:f.get('age18')==='on',usResident:f.get('usResident')==='on',agree:f.get('agree')==='on',
   marketing:f.get('marketing')==='on',turnstileToken:token};
  try{const r=await fetch('/api/giveaway/enter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
   const x=await r.json();if(!r.ok||!x.ok)throw Error(x.error||'Entry could not be submitted');setDone(true);
  }catch(x){setError(x instanceof Error?x.message:'Try again');setToken('');
   const api=(window as Window&{turnstile?:Api}).turnstile;if(widget.current)api?.reset(widget.current);
  }finally{setBusy(false)}
 }
 return <form className="dealer-interest-form" onSubmit={submit}>
 <label>Full name <input name="name" required minLength={2} maxLength={120} autoComplete="name"/></label>
 <label>Email address <input name="email" required type="email" maxLength={254} autoComplete="email"/></label>
 <label><input name="age18" type="checkbox" required/> I am at least 18 years old.</label>
 <label><input name="usResident" type="checkbox" required/> I live in the United States.</label>
 <label><input name="agree" type="checkbox" required/> I agree to the official giveaway rules.</label>
 <label><input name="marketing" type="checkbox"/> Optional: send me occasional Hometown Card Shop deals and new arrivals.</label>
 {key?<><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onLoad={render} strategy="afterInteractive"/><div ref={slot} aria-label="Security verification"/></>:<p>Security check is unavailable.</p>}
 {error&&<p role="alert" className="dealer-error">{error}</p>}
 <button type="submit" className="button button-primary" disabled={!token||busy}>{busy?'Entering…':'Enter giveaway for FREE →'}</button>
 <p className="dealer-form-note">No purchase or Facebook follow necessary. Neither improves odds. One entry per person, subject to the official rules.</p>
 </form>;
}
