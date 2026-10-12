'use client';
import {useCallback,useEffect,useState} from 'react';
type Source={id:string;name:string;kind:string;connection:string;note:string;homepage:string};
type Comparison={id:string;provider:string;card_title:string;source_url:string|null;observed_kind:string;evidence_status:string;price_cents:number;observed_at:string|null;included_in_estimate:boolean;match_score:number;currency:string};
type Run={id:string;status:string;search_terms:string;suggested_price_cents:number|null;low_cents:number|null;high_cents:number|null;matched_sales:number;confidence:string;rationale:string;created_at:string};
type API={run:Run|null;history:Run[];comparables:Comparison[];sources:Source[];soldSearchUrl:string;lookupsEnabled:boolean;applyEnabled:boolean;note:string};
const dollars=(c:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export function PriceResearchPanel({id,sellerId,sitePriceCents,onPriceApplied}:{id:string;sellerId:string;sitePriceCents:number|null;onPriceApplied:()=>Promise<void>}){
 const [data,setData]=useState<API|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [manual,setManual]=useState({cardTitle:'',kind:'sold',priceDollars:'',sourceUrl:'',observedAt:'',notes:''});
 const url='/api/portal/products/'+id+'/pricing';
 const request=useCallback(async(path:string,init:RequestInit={})=>{
  const res=await fetch(path,{...init,headers:{'x-seller-id':sellerId,...init.headers},cache:'no-store'});
  const result=await res.json();if(!res.ok)throw Error(result.error||'Request failed.');return result;
 },[sellerId]);
 const refresh=useCallback(async()=>{setData(await request(url) as API)},[url,request]);
 useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:'Could not load pricing research.'))},[refresh]);
 async function act(name:string,fn:()=>Promise<void>){
  setBusy(name);setError('');setNotice('');
  try{await fn();await refresh()}catch(e){setError(e instanceof Error?e.message:'Pricing research could not complete.')}
  finally{setBusy('')}
 }
 const run=data?.run;
 return <section className="portal-panel hcs-pricing-panel">
  <h2>Card pricing research</h2>
  <p>This is the groundwork for verified sold-comparable pricing. Pricing services are not yet connected, and no AI or external lookup runs from this panel today.</p>
  {error&&<p role="alert" className="portal-alert portal-alert-error">{error}</p>}
  {notice&&<p role="status" className="portal-alert portal-alert-ok">{notice}</p>}
  <div className="portal-button-row">
   <button type="button" className="button button-outline" disabled={!!busy} onClick={()=>act('prepare',async()=>{
    await request(url,{method:'POST'});setNotice('Research record prepared. No external lookups or fees were triggered.');
   })}>{busy==='prepare'?'Preparing…':run?'Start another research case':'Prepare price research'}</button>
   {data?.soldSearchUrl&&<a className="button button-outline" href={data.soldSearchUrl} target="_blank" rel="noopener noreferrer">Check eBay sold listings ↗</a>}
  </div>
  {run&&<div className="hcs-pricing-result">
   <div className="hcs-pricing-heading"><strong>Latest research</strong><span>{run.status.replaceAll('_',' ')}</span></div>
   <p className="hcs-pricing-muted">Search identity: {run.search_terms||'Needs card identification'} · Started {new Date(run.created_at).toLocaleDateString()}</p>
   {run.status==='ready'&&run.suggested_price_cents!==null?<div className="hcs-pricing-values">
    <div><small>Suggested site price</small><strong>{dollars(run.suggested_price_cents)}</strong></div>
    <div><small>Comparable range</small><strong>{run.low_cents==null?'—':dollars(run.low_cents)} – {run.high_cents==null?'—':dollars(run.high_cents)}</strong></div>
    <div><small>Verified sales</small><strong>{run.matched_sales} · {run.confidence}</strong></div>
   </div>:<p><b>No supported price yet.</b> A suggestion requires at least three recent, matching, provider-verified sales. Guide prices and unverified references won't trigger repricing.</p>}
   {run.rationale&&<p>{run.rationale}</p>}
   {run.status==='ready'&&run.suggested_price_cents!==null&&data?.applyEnabled&&
    <button type="button" className="button button-primary" disabled={!!busy} onClick={()=>act('apply',async()=>{
     if(!confirm('Apply '+dollars(run.suggested_price_cents!)+' to this website listing only? Your eBay price will not change.'))return;
     await request(url+'/apply',{method:'POST',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({runId:run.id,confirm:true,expectedSitePriceCents:sitePriceCents})});
     await onPriceApplied();setNotice('Approved price applied to website listing only.');
    })}>{busy==='apply'?'Applying…':'Approve suggested site price'}</button>}
   <div className="portal-button-row"><button type="button" className="button button-outline" disabled={!!busy} onClick={()=>act('recalculate',async()=>{
    await request(url+'/recalculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:run.id})});
    setNotice('Evidence rechecked; no card price was changed.');
   })}>Recheck stored evidence</button></div>
  </div>}
  <h3>Comparable references</h3>
  {data?.comparables.length?<div className="hcs-price-comps">{data.comparables.map(x=><div key={x.id}>
   <strong>{x.card_title} · {x.currency==='USD'?dollars(x.price_cents):(x.price_cents/100).toFixed(2)+' '+x.currency}</strong>
   <p>{x.provider.replaceAll('_',' ')} · {x.observed_kind} · {x.evidence_status.replaceAll('_',' ')}{x.observed_at?' · '+new Date(x.observed_at).toLocaleDateString():''}{x.included_in_estimate?' · included in calculation':''}</p>
   {x.source_url&&<a href={x.source_url} target="_blank" rel="noopener noreferrer">View evidence ↗</a>}
  </div>)}</div>:<p className="hcs-pricing-muted">No comparable sales have been recorded for this card yet.</p>}
  {run&&<details className="hcs-manual-price-entry"><summary>Add a reference manually (unverified)</summary>
   <p>For organizing research. A manually entered number cannot be counted as a confirmed sale, even when marked "sold".</p>
   <form onSubmit={e=>{e.preventDefault();void act('manual',async()=>{
    await request(url+'/comparables',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({...manual,runId:run.id,priceDollars:Number(manual.priceDollars),currency:'USD'})});
    setManual({cardTitle:'',kind:'sold',priceDollars:'',sourceUrl:'',observedAt:'',notes:''});
    setNotice('Reference saved as unverified, without affecting any price.');
   })}}><div className="portal-form-grid">
    <label>Comparable card<input required maxLength={250} value={manual.cardTitle} onChange={e=>setManual(x=>({...x,cardTitle:e.target.value}))}/></label>
    <label>Observation type<select value={manual.kind} onChange={e=>setManual(x=>({...x,kind:e.target.value}))}><option value="sold">Reported sold</option><option value="asking">Asking price</option><option value="guide">Price guide value</option></select></label>
    <label>Price ($)<input required type="number" min=".01" step=".01" value={manual.priceDollars} onChange={e=>setManual(x=>({...x,priceDollars:e.target.value}))}/></label>
    <label>Date (optional)<input type="date" value={manual.observedAt} onChange={e=>setManual(x=>({...x,observedAt:e.target.value}))}/></label>
    <label>Source page URL<input type="url" placeholder="https://" value={manual.sourceUrl} onChange={e=>setManual(x=>({...x,sourceUrl:e.target.value}))}/></label>
   </div><button className="button button-outline" type="submit" disabled={!!busy}>{busy==='manual'?'Saving…':'Save unverified reference'}</button></form>
  </details>}
  <h3>Planned pricing sources</h3>
  <div className="hcs-pricing-sources">{data?.sources.map(x=><div key={x.id}>
   <div><strong>{x.name}</strong><small>{x.connection==='manual_available'?'Manual entry available':x.connection==='not_connected'?'Not connected':x.connection==='configured_but_disabled'?'Credentials present · disabled':'Credentials present · integration required'}</small></div>
   <p>{x.note}</p>
   <a href={x.homepage} target="_blank" rel="noopener noreferrer">Source information ↗</a>
  </div>)}</div>
  <p className="hcs-pricing-footnote">No background scraping, paid model request, price changes, or listing sync will occur from preparing a research case. Only explicit dealer-approved changes will be allowed after licensing and verification are ready.</p>
 </section>;
}
