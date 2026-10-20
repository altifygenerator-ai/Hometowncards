'use client';
import Script from 'next/script';
import {useCallback,useEffect,useRef,useState} from 'react';

type TurnstileApi={render:(element:HTMLElement,options:Record<string,unknown>)=>string;reset:(id:string)=>void};
type TurnstileWindow=Window & {turnstile?:TurnstileApi};
const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
export function PortalLogin(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [token,setToken]=useState('');
 const slot=useRef<HTMLDivElement|null>(null),widget=useRef<string|null>(null);
 const renderChallenge=useCallback(()=>{
  const api=(window as TurnstileWindow).turnstile;
  if(!api||!slot.current||widget.current||!siteKey)return;
  widget.current=api.render(slot.current,{sitekey:siteKey,action:'admin-login',
    callback:(value:string)=>{setToken(value);setError('')},
    'expired-callback':()=>setToken(''),
    'error-callback':()=>{setToken('');return false}
  });
 },[]);
 useEffect(()=>{renderChallenge()},[renderChallenge]);
 async function submit(e:React.FormEvent){
  e.preventDefault();setError('');
  if(!token){setError('Please complete the security check.');return}
  setBusy(true);
  try{
   const r=await fetch('/api/portal/session',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({email,password,turnstileToken:token})});
   const data=await r.json();
   if(!r.ok)throw new Error(data.error||'Sign-in failed.');
   if(data.pending){setError('Your seller application is waiting for review. Once approved, sign in here to set up your shop.');return;}
   window.location.assign('/admin/dashboard');
  }catch(e){
   setError(e instanceof Error?e.message:'Sign in could not be completed.');
   setToken('');
   const api=(window as TurnstileWindow).turnstile;
   if(api&&widget.current)api.reset(widget.current);
  }finally{setBusy(false)}
 }
 return <form className="portal-login-form" onSubmit={submit}>
  <label>Email address<input required autoComplete="username" type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
  <label>Password<input required autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
  {siteKey?<><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={renderChallenge}/><div ref={slot} className="portal-turnstile" aria-label="Security verification"/></>:
    <p className="portal-login-foot" role="status">Secure shopkeeper sign-in is being configured.</p>}
  {error&&<p role="alert" className="portal-error">{error}</p>}
  <button type="submit" className="button button-primary" disabled={busy||!siteKey||!token}>{busy?'Checking…':'Open my dashboard →'}</button>
  <p className="portal-login-foot">Authorized shopkeepers only. Every sign-in is protected by a security check.</p>
 </form>
}
