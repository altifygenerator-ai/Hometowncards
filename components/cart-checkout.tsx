'use client';
import Script from 'next/script';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {CartLine} from '@/components/cart-provider';
type Api={render:(el:HTMLElement,o:Record<string,unknown>)=>string;reset:(id:string)=>void};
type Web=Window&{turnstile?:Api};
type Option={profileId:string;service:string;shippingClass:'economy'|'tracked'|'insured';tracked:boolean;insuranceCoverageCents:number;chargeCents:number;weightOz:number};
type Address={name:string;line1:string;line2:string;city:string;state:string;postalCode:string;country:'US'};
type TaxQuote={taxCents:number;rate:number;totalCents:number;fingerprint:string};
const STATE_CHOICES:ReadonlyArray<readonly [string,string]>=[
 ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
 ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],
 ['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
 ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
 ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],
 ['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],
 ['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],
 ['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],
 ['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],['TN','Tennessee'],
 ['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],['WA','Washington'],
 ['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],['DC','District of Columbia'],
];
const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
const live=process.env.NEXT_PUBLIC_STORE_LIVE==='true'&&process.env.NEXT_PUBLIC_CHECKOUT_ENABLED==='true';
const money=(c:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export function CartCheckout({lines,bonusSport}:{lines:CartLine[];bonusSport:string}){
 const [busy,setBusy]=useState(false),[quoting,setQuoting]=useState(false);
 const [token,setToken]=useState(''),[error,setError]=useState('');
 const [options,setOptions]=useState<Option[]|null>(null),[selected,setSelected]=useState('');
 const [subtotal,setSubtotal]=useState<number|null>(null);
 const [address,setAddress]=useState<Address>({name:'',line1:'',line2:'',city:'',state:'AR',postalCode:'',country:'US'});
 const [tax,setTax]=useState<TaxQuote|null>(null);
 const el=useRef<HTMLDivElement|null>(null),id=useRef<string|null>(null);
 const abort=useRef<AbortController|null>(null);
 const render=useCallback(()=>{
  const api=(window as Web).turnstile;
  if(!api||!el.current||id.current||!siteKey)return;
  id.current=api.render(el.current,{sitekey:siteKey,action:'checkout',
   callback:(value:string)=>{setToken(value);setError('')},
   'expired-callback':()=>setToken(''),'error-callback':()=>{setToken('');return false}});
 },[]);
 useEffect(()=>{if(live)render()},[render]);
 useEffect(()=>{
  if(!lines.length)return;
  let active=true;const controller=new AbortController();
  setOptions(null);setSelected('');setTax(null);
  fetch('/api/shipping/options',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({lines:lines.map(x=>({id:x.id,quantity:x.quantity}))}),signal:controller.signal})
    .then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Rates unavailable');return x as {options:Option[];subtotalCents:number}})
    .then(data=>{if(active){setOptions(data.options);setSubtotal(data.subtotalCents);setSelected(data.options[0]?.profileId||'');}})
    .catch(e=>{if(active&&e.name!=='AbortError'){setOptions([]);setError(e instanceof Error?e.message:'Could not load shipping options.')}});
  return()=>{active=false;controller.abort()};
 },[lines]);
 useEffect(()=>()=>{abort.current?.abort()},[]);
 const opt=options?.find(x=>x.profileId===selected);
 const fingerprint=JSON.stringify({state:address.state,selected,subtotal,shipping:opt?.chargeCents});
 const addressComplete=address.name.trim().length>=2&&address.line1.trim().length>=5&&address.city.trim().length>=2&&/^\d{5}(-\d{4})?$/.test(address.postalCode);
 const currentTax=tax?.fingerprint===fingerprint?tax:null;
 function editAddress(field:keyof Address,value:string){
  if(field==='state'){abort.current?.abort();setQuoting(false);setTax(null);}
  setError('');
  setAddress(a=>({...a,[field]:field==='state'?value.toUpperCase():value}));
 }
 // Recalculate automatically when the destination state, price or shipping service changes.
 useEffect(()=>{
  if(!opt||subtotal===null||!/^[A-Z]{2}$/.test(address.state))return;
  const controller=new AbortController();
  abort.current?.abort();abort.current=controller;
  setQuoting(true);setTax(null);setError('');
  const fingerprintAtRequest=fingerprint;
  fetch('/api/tax/quote',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({state:address.state,subtotalCents:subtotal,shippingCents:opt.chargeCents}),
   signal:controller.signal})
   .then(async response=>{const data=await response.json() as Partial<TaxQuote>&{error?:string};
    if(!response.ok||typeof data.taxCents!=='number'||typeof data.totalCents!=='number')
     throw Error(data.error||'Unable to calculate state sales tax.');
    return data;})
   .then(data=>{if(!controller.signal.aborted)setTax({taxCents:data.taxCents!,rate:data.rate??0,
     totalCents:data.totalCents!,fingerprint:fingerprintAtRequest});})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to calculate state sales tax.');})
   .finally(()=>{if(!controller.signal.aborted)setQuoting(false);});
  return()=>controller.abort();
 },[address.state,selected,subtotal,opt?.chargeCents]);
 async function submit(){
  if(!live||!token||busy||!lines.length||!selected||!currentTax||!addressComplete)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({lines:lines.map(x=>({id:x.id,quantity:x.quantity})),bonusSport,shippingProfileId:selected,
     address,turnstileToken:token})});
   const data=await response.json() as {url?:string;error?:string};
   if(!response.ok||!data.url)throw Error(data.error||'Checkout is unavailable.');
   window.location.assign(data.url);
  }catch(e){setError(e instanceof Error?e.message:'Unable to begin checkout.');setToken('');
   const api=(window as Web).turnstile;if(api&&id.current)api.reset(id.current);
  }finally{setBusy(false)}
 }
 const field=(key:keyof Address,label:string,props:{autoComplete?:string;placeholder?:string;pattern?:string}={})=><label key={key}>{label}
  {key==='state'?<select name="state" value={address.state} autoComplete="shipping address-level1" onChange={e=>editAddress('state',e.target.value)}>
   {STATE_CHOICES.map(([code,name])=><option value={code} key={code}>{name} ({code})</option>)}
  </select>:<input name={key} type="text" value={address[key]} onChange={e=>editAddress(key,e.target.value)}
   autoComplete={props.autoComplete||'off'} placeholder={props.placeholder||''}
   maxLength={key==='line1'?160:key==='line2'?90:key==='postalCode'?10:120}
   required={key!=='line2'} pattern={props.pattern} inputMode={key==='postalCode'?'numeric':undefined}/>}
 </label>;
 const rateText=currentTax?address.state+' state base tax ('+(currentTax.rate*100).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')+'%)':'State sales tax';
 return <div className="cart-checkout-action">
  <section className="cart-shipping-choices" aria-label="Choose shipping">
   <strong>Shipping options</strong>
   {options===null?<p>Checking available shipping services…</p>:
    options.length===0?<p>Shipping isn’t configured for these cards yet. Please contact the shop.</p>:
    options.map(x=><label key={x.profileId} className="cart-shipping-choice">
     <input type="radio" name="shippingProfile" checked={selected===x.profileId}
      onChange={()=>{abort.current?.abort();setQuoting(false);setTax(null);setSelected(x.profileId)}}/>
     <span><b>{x.service}</b><small>{x.shippingClass==='economy'?'Low-cost letter · no package tracking':x.shippingClass==='insured'?'Tracking and insured coverage':'Tracked parcel'} · approx. {x.weightOz.toFixed(2)} oz</small></span>
     <b>{money(x.chargeCents)}</b>
    </label>)}
  </section>
  <section className="hcs-checkout-address" aria-labelledby="hcs-shipping-heading">
   <h3 id="hcs-shipping-heading">Delivery address</h3>
   <p>Sales tax is estimated automatically using your delivery state’s base rate. We don't add separate city or county taxes.</p>
   <div className="hcs-checkout-address-grid">
    {field('name','Full name',{autoComplete:'shipping name'})}
    {field('line1','Street address',{autoComplete:'shipping address-line1'})}
    {field('line2','Apartment or unit (optional)',{autoComplete:'shipping address-line2'})}
    {field('city','City',{autoComplete:'shipping address-level2'})}
    {field('state','State (2 letters)',{autoComplete:'shipping address-level1',placeholder:'AR',pattern:'[A-Za-z]{2}'})}
    {field('postalCode','ZIP code',{autoComplete:'shipping postal-code',placeholder:'71921',pattern:'[0-9]{5}(-[0-9]{4})?'})}
   </div>
   <p className="hcs-checkout-address-help">United States shipping only. A regular five-digit ZIP code is fine. Your delivery address is saved with the order.</p>
  </section>
  {quoting&&<p className="checkout-explainer" role="status">Updating state sales tax…</p>}
  {currentTax&&opt&&subtotal!==null&&<div className="hcs-tax-preview" role="status">
   <div><span>Cards</span><strong>{money(subtotal)}</strong></div>
   <div><span>Shipping</span><strong>{money(opt.chargeCents)}</strong></div>
   <div><span>{rateText}</span><strong>{money(currentTax.taxCents)}</strong></div>
   <div className="hcs-tax-total"><span>Total due at payment</span><strong>{money(currentTax.totalCents)}</strong></div>
   <small>The shop recalculates prices, shipping and tax before creating the payment.</small>
  </div>}
  {!live?<><button className="button button-primary checkout-disabled" disabled>Secure checkout coming soon</button>
   <p className="checkout-explainer">Online payments are not enabled yet.</p></>:
   <>
    {siteKey?<><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={render}/><div ref={el} aria-label="Security check"/></>:<p>Security verification is temporarily unavailable.</p>}
    {error&&<p className="portal-error" role="alert">{error}</p>}
    <button className="button button-primary" disabled={busy||!token||!currentTax||!selected||!lines.length||!addressComplete}
      onClick={submit}>{busy?'Opening secure checkout…':'Pay securely with Stripe →'}</button>
    {!currentTax&&<p className="checkout-explainer">Choose your state and finish the delivery address to continue.</p>}
   </>}
 </div>;
}