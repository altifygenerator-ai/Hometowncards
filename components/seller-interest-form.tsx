'use client';
import Script from 'next/script';
import {useCallback,useEffect,useRef,useState} from 'react';
type Api={render:(element:HTMLElement,options:Record<string,unknown>)=>string;reset:(id:string)=>void};
type W=Window&{turnstile?:Api};
const key=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
export function SellerInterestForm(){
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 const ref=useRef<HTMLDivElement|null>(null),widget=useRef<string|null>(null);
 const render=useCallback(()=>{
  const api=(window as W).turnstile;
  if(!api||widget.current||!ref.current||!key)return;
  widget.current=api.render(ref.current,{sitekey:key,action:'seller-interest',
   callback:(v:string)=>setToken(v),'expired-callback':()=>setToken(''),
   'error-callback':()=>{setToken('');return false}});
 },[]);
 useEffect(()=>{render()},[render]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError('');
  const body=Object.fromEntries(new FormData(e.currentTarget).entries());
  try{
   const r=await fetch('/api/seller-interest',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...body,turnstileToken:token})});
   const data=await r.json() as {ok?:boolean;error?:string};
   if(!r.ok||!data.ok)throw Error(data.error||'Could not submit the form.');
   setDone(true);
  }catch(e){
   setError(e instanceof Error?e.message:'Please try again.');
   setToken('');
   if(widget.current)(window as W).turnstile?.reset(widget.current);
  }finally{setBusy(false)}
 }
 if(done)return <section className="dealer-thanks" role="status"><span className="kicker">MESSAGE RECEIVED</span>
  <h2>Thanks for reaching out.</h2><p>Your interest is on our list. We’ll be in touch as we get ready to welcome more card dealers.</p></section>;
 return <form className="dealer-interest-form" onSubmit={submit}>
  <div className="dealer-form-grid">
   <label>Your name <span aria-hidden="true">*</span><input name="contactName" required maxLength={120} autoComplete="name" placeholder="Your name"/></label>
   <label>Email <span aria-hidden="true">*</span><input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com"/></label>
   <label>Shop / seller name<input name="shopName" maxLength={120} placeholder="Your shop name (if you have one)"/></label>
   <label>City and state<input name="location" maxLength={120} placeholder="Where are you based?"/></label>
   <label>Rough inventory size <span aria-hidden="true">*</span><select name="inventorySize" required defaultValue=""><option value="" disabled>Select a range</option>
     <option>Under 100 cards</option><option>100–999 cards</option><option>1,000–4,999 cards</option><option>5,000–19,999 cards</option><option>20,000+ cards</option></select></label>
   <label>Where do you sell now? <span aria-hidden="true">*</span><select name="currentlySelling" required defaultValue=""><option value="" disabled>Choose one</option>
     <option>eBay</option><option>Other online marketplaces</option><option>Card shows / local sales</option><option>My own website</option><option>Not selling yet</option></select></label>
  </div>
  <fieldset className="dealer-plan-choice"><legend>Which seller plan would interest you?</legend>
   <label><input type="radio" name="planInterest" value="payg" defaultChecked/> Pay As You Sell — 2% per sale, $0 monthly</label>
   <label><input type="radio" name="planInterest" value="starter"/> Starter — $5.99/month, 0% marketplace commission</label>
   <label><input type="radio" name="planInterest" value="undecided"/> Still deciding</label>
  </fieldset>
  <label>Anything else about your cards or shop? <textarea name="notes" maxLength={1200} rows={4} placeholder="Sports, graded cards, vintage collections, what you would like to see..."/></label>
  <div className="dealer-honeypot" aria-hidden="true"><label>Leave this blank<input tabIndex={-1} autoComplete="off" name="website"/></label></div>
  <p className="dealer-form-note">This is an interest form, not seller registration. There’s no fee and no obligation. We’ll use your details only to follow up about selling here.</p>
  {key?<><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={render}/><div ref={ref} aria-label="Security check"/></>:
   <p>Our secure contact form is temporarily unavailable.</p>}
  {error&&<p role="alert" className="dealer-error">{error}</p>}
  <button type="submit" className="button button-primary" disabled={busy||!key||!token}>
   {busy?'Sending…':'Tell us you’re interested →'}
  </button>
 </form>;
}
