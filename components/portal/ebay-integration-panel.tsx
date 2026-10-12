'use client';
import {useCallback,useEffect,useState} from 'react';

type EbayStatus={
 configured:boolean;connected:boolean;
 pendingWriteback:number;
 account:null|{username:string|null;status:string;mode:'import_only'|'two_way';
 lastListingSync:string|null;lastOrderSync:string|null;lastWriteback:string|null;
 nextPage:number;totalPages:number|null;lastError:string|null};
};
type SyncResult={ok:boolean;orders:{applied:number;duplicates:number;conflicts:number;missing:number};
 listings:{imported:number;review:number;processed:number;page:number|null;totalPages:number;finished:boolean};
 writeback:{completed:number;needsReview:number;disabled:boolean}};
export function EbayIntegrationPanel({sellerId}:{sellerId:string}){
 const [data,setData]=useState<EbayStatus|null>(null),[busy,setBusy]=useState(false),
 [error,setError]=useState(''),[notice,setNotice]=useState('');
 const request=useCallback(async(method:string,body?:unknown)=>{
  const r=await fetch('/api/portal/ebay',{method,
   headers:{'x-seller-id':sellerId,...(body?{'Content-Type':'application/json'}:{})},
   body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const result=await r.json();
  if(!r.ok)throw Error(result.error||'eBay action was not successful.');
  return result;
 },[sellerId]);
 const reload=useCallback(async()=>setData(await request('GET') as EbayStatus),[request]);
 useEffect(()=>{void reload().catch(e=>setError(e instanceof Error?e.message:'eBay status unavailable.'))},[reload]);
 async function act(task:()=>Promise<void>){
  setBusy(true);setNotice('');setError('');
  try{await task()}catch(e){setError(e instanceof Error?e.message:'Could not complete eBay request.')}
  finally{setBusy(false)}
 }
 function connect(){void act(async()=>{
  const out=await request('POST',{action:'connect'}) as {url:string};
  if(!out.url.startsWith('https://auth.ebay.com/'))throw Error('Unexpected eBay authorization URL.');
  window.location.assign(out.url);
 })}
 function synchronize(){void act(async()=>{
  let pages=0,done=false,created=0,orderSales=0,flagged=0,writebacks=0;
  // Keep each invocation below the serverless function timeout; work in 3-page blocks.
  while(!done&&pages<50){
   const result=await request('POST',{action:'sync'}) as SyncResult;
   pages++;
   done=result.listings.finished;created+=result.listings.imported;
   orderSales+=result.orders.applied;flagged+=result.orders.conflicts+result.listings.review;
   writebacks+=result.writeback.completed;
   setNotice('Synced '+created+' listings; '+(result.listings.page?
    'continuing on page '+result.listings.page+' of '+result.listings.totalPages:'listing pass complete')+'…');
  }
  setNotice('eBay sync '+(done?'completed.':'paused after 50 batches.')+
    ' Listings updated: '+created+'. eBay sales imported: '+orderSales+
    '. Website sales written back: '+writebacks+'. Needs review: '+flagged+'.');
  await reload();
 })}
 function switchMode(){void act(async()=>{
  const mode=data?.account?.mode==='two_way'?'import_only':'two_way';
  if(mode==='two_way'&&!window.confirm(
   'Enable two-way eBay inventory updates? When a linked card sells on your website, its eBay quantity may be reduced or its listing ended. Only enable this after confirming the imported inventory matches your eBay account.'))return;
  await request('POST',{action:'mode',mode});
  setNotice(mode==='two_way'?'Two-way eBay sale updates enabled.':'Website to eBay updates paused; imports remain available.');
  await reload();
 })}
 function reset(){void act(async()=>{
  if(!window.confirm('Restart eBay listing import at page one? This will not delete existing cards.'))return;
  await request('POST',{action:'reset'});setNotice('Starting a fresh listing pass.');await reload();
 })}
 function disconnect(){void act(async()=>{
  if(!window.confirm('Disconnect eBay? Existing website listings stay online; eBay will no longer be updated automatically.'))return;
  await request('DELETE');setNotice('eBay disconnected. You may continue selling on this website.');await reload();
 })}
 const when=(s:string|null|undefined)=>s?new Date(s).toLocaleString():'Not yet';
 return <section className="portal-panel">
  <h2>eBay inventory synchronization</h2>
  <p>Connect eBay if you want listings and purchases synced between your eBay account and this shop.
   <strong> eBay is entirely optional.</strong> You can still add cards directly or import CSV files without an eBay account.</p>
  {!data?<p>Checking eBay status…</p>:
   !data.configured?<p>eBay Production API settings must be added to Vercel before you can connect an account.
    The direct listing tools remain available.</p>:
   !data.connected?<button className="button button-primary" disabled={busy} onClick={connect}>
    Connect my eBay seller account</button>:
   <>
    <p><strong>Connected account:</strong> {data.account?.username||'eBay seller'} · {data.account?.status}</p>
    <p><strong>Listing sync:</strong> {when(data.account?.lastListingSync)} ·
     <strong> Order sync:</strong> {when(data.account?.lastOrderSync)}</p>
    {data.account?.totalPages&&<p>Import in progress: page {data.account.nextPage} of {data.account.totalPages}.</p>}
    <p><strong>Website sales awaiting eBay update:</strong> {data.pendingWriteback}</p>
    <p><strong>Sync mode:</strong> {data.account?.mode==='two_way'?'Two-way sale coordination':'Import-only (safe first step)'}</p>
    {data.account?.lastError&&<p className="portal-error">Last eBay issue: {data.account.lastError}</p>}
    <div className="portal-actions">
     <button className="button button-primary" disabled={busy} onClick={synchronize}>{busy?'Syncing…':'Sync eBay listings and sales now'}</button>
     <button className="button button-outline" disabled={busy} onClick={switchMode}>
      {data.account?.mode==='two_way'?'Pause website → eBay updates':'Enable two-way sales updates'}</button>
     <button className="button button-outline" disabled={busy} onClick={reset}>Restart listing import</button>
     <button className="button button-outline" disabled={busy} onClick={disconnect}>Disconnect eBay</button>
    </div>
    <p>Sync never deletes your website listings just because a listing is missing from an eBay response.
     A genuine paid eBay order reduces local stock once. Website sales can update the matching eBay listing after you enable two-way mode.
     Any conflicts appear for manual review.</p>
   </>}
  {error&&<p role="alert" className="portal-error">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}
