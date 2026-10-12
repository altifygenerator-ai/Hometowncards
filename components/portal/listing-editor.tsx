'use client';
import Link from 'next/link';
import {PriceResearchPanel} from '@/components/portal/price-research-panel';
import {useCallback,useEffect,useState} from 'react';
type Listing={id:string;source:string;source_item_id:string;sku:string;title:string;description:string;price_cents:number;price_override_cents:number|null;stock:number;status:string;needs_review:boolean;manual_paused:boolean;sport:string;team:string;player:string;card_year:string;card_set:string;card_number:string;condition:string;category:string;inventory_location:string;seller_notes:string;image_url:string|null;back_image_url:string|null;manual_image_url:string|null;manual_back_image_url:string|null};
type Photo={id:string;slot:string;public_url:string};
type Detail={product:Listing;photos:Photo[]};
const aiEnabled=process.env.NEXT_PUBLIC_AI_CARD_TOOLS_ENABLED==='true';
type CardAi={title:string;sport:string;player:string;team:string;year:string;set:string;cardNumber:string;variant:string;conditionNotes:string;confidence:string;soldSearchTerms:string};
const fields=[['title','Listing title'],['sport','Sport / category'],['player','Player'],['team','Team'],['card_year','Card year'],['card_set','Set / series'],['card_number','Card number'],['condition','Condition'],['category','eBay category'],['inventory_location','Bin / box location']] as const;
async function prepareCardPhoto(file:File):Promise<File>{
 const supported=['image/jpeg','image/png','image/webp'].includes(file.type);
 if(supported&&file.size<=3_700_000)return file;
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file)}catch{throw Error('This photo format could not be opened. Please select a JPG, PNG or WebP picture.')}
 try{
  for(const [longest,quality] of [[2200,.86],[1800,.80],[1400,.73],[1200,.65]]){
   const scale=Math.min(1,longest/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext('2d');if(!ctx)throw Error('Browser image resizing is unavailable.');
   ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
   if(blob&&blob.size<=3_700_000)return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
  }
  throw Error('This photo is too large to upload. Please reduce its resolution.');
 }finally{bitmap.close()}
}
export function ListingEditor({id,sellerId}:{id:string;sellerId:string}){
 const [ai,setAi]=useState<CardAi|null>(null),[analyzing,setAnalyzing]=useState(false);
 const [detail,setDetail]=useState<Detail|null>(null),[form,setForm]=useState<Partial<Listing>>({}),[price,setPrice]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[uploading,setUploading]=useState('');
 const load=useCallback(async()=>{
  const r=await fetch('/api/portal/products/'+id,{headers:{'x-seller-id':sellerId},cache:'no-store'});
  const d=await r.json() as Detail&{error?:string};if(!r.ok)throw Error(d.error||'Unable to open card.');
  setDetail(d);setForm(d.product);setPrice(((d.product.price_override_cents??d.product.price_cents)/100).toFixed(2));
 },[id,sellerId]);
 useEffect(()=>{void load().catch(e=>setError(e.message))},[load]);
 const send=async(url:string,init:RequestInit)=>{const r=await fetch(url,{...init,headers:{'x-seller-id':sellerId,...init.headers}});const d=await r.json();
  if(!r.ok)throw Error(d.error||'The change could not be saved.');return d;};
 async function save(){if(!form||!detail)return;setBusy(true);setError('');setMessage('');
  try{
   const amount=Number(price);if(!Number.isFinite(amount)||amount<=0||amount>1000000)throw Error('Enter a valid site price.');
   const patch:Record<string,unknown>={price_override_cents:Math.round(amount*100),manual_paused:form.manual_paused===true,needs_review:form.needs_review===true};
   for(const [key] of fields)patch[key]=form[key]??'';
   patch.description=form.description||'';patch.seller_notes=form.seller_notes||'';
   if(detail.product.source!=='ebay')patch.stock=Number(form.stock);
   await send('/api/portal/products/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});
   await load();setMessage('Listing changes saved.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to save')}finally{setBusy(false)}
 }
 async function upload(slot:string,file?:File){
  if(!file)return;setUploading(slot);setError('');setMessage('');
  try{const data=new FormData();const prepared=await prepareCardPhoto(file);data.append('file',prepared);data.append('slot',slot);
   await send('/api/portal/products/'+id+'/images',{method:'POST',body:data});
   await load();setMessage('Photo uploaded. It will appear on the storefront after its image cache refreshes.');
  }catch(e){setError(e instanceof Error?e.message:'Upload failed')}finally{setUploading('')}
 }
 async function remove(slot:string){
  if(!confirm('Remove this uploaded photo? Your original eBay image, if present, will still be available.'))return;
  setUploading(slot);setError('');setMessage('');
  try{await send('/api/portal/products/'+id+'/images',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({slot})});
   await load();setMessage('Uploaded photo removed.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to remove photo')}finally{setUploading('')}
 }
 async function identify(){
  setError('');setMessage('');setAnalyzing(true);setAi(null);
  try{const res=await send('/api/portal/products/'+id+'/identify',{method:'POST'});
   setAi(res.suggestion as CardAi);
  }catch(e){setError(e instanceof Error?e.message:'AI analysis is unavailable')}
  finally{setAnalyzing(false)}
 }
 function applyAi(){
  if(!ai)return;
  setForm(old=>({...old,title:ai.title||old.title,sport:ai.sport||old.sport,
   player:ai.player||old.player,team:ai.team||old.team,card_year:ai.year||old.card_year,
   card_set:ai.set||old.card_set,card_number:ai.cardNumber||old.card_number}));
  setMessage('AI suggestions copied into the editor. Review the details, then click Save listing changes.');
 }
  if(!detail)return <div className="portal-panel">{error?<p role="alert">{error}</p>:<p>Loading card details…</p>}</div>;
 const item=detail.product,sourceId=item.source==='ebay'?item.source_item_id:item.id;
 const primary=form.manual_image_url||item.image_url;
 const secondary=form.manual_back_image_url||item.back_image_url;
 const bySlot=new Map(detail.photos.map(x=>[x.slot,x]));
 return <div className="hcs-listing-editor">
  <div className="hcs-editor-bar"><Link href="/admin/dashboard">← Back to inventory</Link><a href={'/cards/'+encodeURIComponent(sourceId)} target="_blank" rel="noreferrer">View customer listing ↗</a></div>
  <header className="portal-panel"><span className="kicker">EDIT CARD LISTING</span><h1>{item.title}</h1>
   <p>SKU: {item.sku} · {item.source==='ebay'?'eBay-synced: site edits remain separate from source stock and price':'Direct shop listing'}</p>
   {item.needs_review&&<p className="hcs-editor-warning">This card is hidden from the storefront until you upload or verify its photo and mark it reviewed.</p>}
  </header>
  {error&&<p role="alert" className="portal-alert portal-alert-error">{error}</p>}
  {message&&<p role="status" className="portal-alert portal-alert-ok">{message}</p>}
  <section className="portal-panel">
   <h2>Listing photos</h2><p>Upload JPG, PNG, or WebP photos. Large phone photos are automatically optimized to fit the upload limit. The site keeps your uploaded photos separate from eBay, so an eBay sync won't erase them.</p>
   <div className="hcs-editor-photo-grid">
    {['front','back',...Array.from({length:8},(_,i)=>'extra-'+(i+1))].map(slot=>{
     const custom=bySlot.get(slot),fallback=slot==='front'?primary:slot==='back'?secondary:null;
     const src=custom?.public_url||fallback;
     return <div className="hcs-editor-photo" key={slot}>
      <strong>{slot==='front'?'Front / cover':slot==='back'?'Back':('Additional '+slot.slice(-1))}</strong>
      <div className="hcs-editor-photo-preview">{src?<a href={src} target="_blank" rel="noreferrer" title="Open full photo"><img src={src} alt={slot+' image'} referrerPolicy="no-referrer"/></a>:<span>No photo yet</span>}</div>
      <label className="hcs-photo-upload">Upload / replace
       <input aria-label={'Upload '+slot+' photo'} type="file" accept="image/*" disabled={!!uploading} onChange={e=>{void upload(slot,e.target.files?.[0]);e.target.value=''}}/>
      </label>
      {custom&&<button type="button" className="hcs-photo-remove" onClick={()=>remove(slot)} disabled={!!uploading}>Remove uploaded photo</button>}
      {uploading===slot&&<small>Uploading…</small>}
     </div>})}
   </div>
  </section>
  <section className="portal-panel"><h2>AI card assistance (optional)</h2>
   <p>Identify visible card details from the front photo, then compare similar <em>sold</em> listings. AI is not a price guide and never updates your listing unless you review and save changes yourself.</p>
   {aiEnabled?<button className="button button-outline" disabled={analyzing||!!uploading} onClick={identify}>{analyzing?'Identifying card…':'Identify this card from photo'}</button>:
    <p>AI identification is currently off. An OpenAI API key and explicit activation are required before this tool can be used.</p>}
   {ai&&<div className="hcs-ai-result">
    <strong>Photo identification · {ai.confidence} confidence</strong>
    <p><b>{ai.title||'Title uncertain'}</b></p>
    <p>{[ai.year,ai.set,ai.cardNumber,ai.player,ai.team,ai.variant].filter(Boolean).join(' · ')}</p>
    {ai.conditionNotes&&<p>Visible condition notes: {ai.conditionNotes}</p>}
    {ai.soldSearchTerms&&<a target="_blank" rel="noreferrer" className="corner-text-link" href={'https://www.ebay.com/sch/i.html?_nkw='+encodeURIComponent(ai.soldSearchTerms)+'&LH_Sold=1&LH_Complete=1'}>Review sold listings for comparable cards ↗</a>}
    <div className="portal-button-row"><button className="button button-outline" onClick={applyAi}>Copy suggested details into editor</button></div>
    <small>Verify the year, set, card number, parallel and actual condition before pricing. This tool does not supply verified sale prices.</small>
   </div>}
  </section>
  <PriceResearchPanel id={id} sellerId={sellerId} sitePriceCents={detail.product.price_override_cents} onPriceApplied={load}/>
  <section className="portal-panel"><h2>Card details</h2>
   <div className="portal-form-grid">
    {fields.map(([key,label])=><label key={key}>{label}<input value={String(form[key]??'')} maxLength={key==='title'?250:120}
     onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/></label>)}
    <label>Site price ($)<input type="number" min=".01" max="1000000" step=".01" value={price} onChange={e=>setPrice(e.target.value)}/></label>
    <label>Available stock {item.source==='ebay'?'(controlled by eBay)':''}<input type="number" min="0" value={form.stock??0} disabled={item.source==='ebay'} onChange={e=>setForm(v=>({...v,stock:Number(e.target.value)}))}/></label>
    <label>Show on storefront<select value={form.manual_paused?'no':'yes'} onChange={e=>setForm(v=>({...v,manual_paused:e.target.value==='no'}))}><option value="yes">Show</option><option value="no">Hide</option></select></label>
    <label>Photo review<select value={form.needs_review?'needs_review':'approved'} onChange={e=>setForm(v=>({...v,needs_review:e.target.value==='needs_review'}))}>
     <option value="needs_review">Needs review — hidden</option><option value="approved">Photo verified — publish</option>
    </select></label>
   </div>
   <label className="hcs-editor-area">Description<textarea rows={5} value={form.description||''} maxLength={4000} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label>
   <label className="hcs-editor-area">Private seller notes<textarea rows={3} value={form.seller_notes||''} onChange={e=>setForm(v=>({...v,seller_notes:e.target.value}))}/></label>
   <div className="portal-button-row"><button className="button button-primary" disabled={busy||!!uploading} onClick={save}>{busy?'Saving…':'Save listing changes'}</button>
   <a className="button button-outline" href={'/cards/'+encodeURIComponent(sourceId)} target="_blank" rel="noreferrer">Preview as customer ↗</a></div>
   <p className="hcs-editor-help">Updates to an eBay-sourced listing here don't change its active eBay listing. Card quantities must be updated through the eBay sync.</p>
  </section>
 </div>;
}
