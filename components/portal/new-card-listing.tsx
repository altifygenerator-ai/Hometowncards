'use client';
import Link from 'next/link';
import {useState} from 'react';
export function NewCardListing({sellerId}:{sellerId:string}){
 const [fields,setFields]=useState({title:'',sku:'',sport:'Baseball',team:'',player:'',card_year:'',card_set:'',card_number:'',condition:'',category:'',inventory_location:'',description:'',price:'1.00',stock:'1'});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const labels:[keyof typeof fields,string][]=[['title','Card title'],['sku','SKU / collection ID'],['price','Card price ($)'],['stock','Quantity'],['sport','Sport'],['player','Player'],['team','Team'],['card_year','Year'],['card_set','Set'],['card_number','Card number'],['condition','Condition'],['category','Category'],['inventory_location','Bin / box']];
 async function submit(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{const r=await fetch('/api/portal/products',{method:'POST',headers:{'Content-Type':'application/json','x-seller-id':sellerId},
   body:JSON.stringify({...fields,stock:Number(fields.stock)})});const d=await r.json() as {id?:string;error?:string};
   if(!r.ok||!d.id)throw Error(d.error||'Unable to save the new card.');
   window.location.assign('/admin/listings/'+d.id+'?seller='+sellerId);
  }catch(e){setError(e instanceof Error?e.message:'Unable to save the card')}finally{setBusy(false)}
 }
 return <div className="hcs-listing-editor"><div className="hcs-editor-bar"><Link href="/admin/dashboard">← Back to inventory</Link></div>
  <section className="portal-panel"><span className="kicker">DIRECT SHOP LISTING</span><h1>Add a card</h1>
  <p>List a card directly on Hometown Card Shop without creating an eBay listing. Add details here, then upload photos and mark the card reviewed before it appears for shoppers.</p>
  {error&&<p role="alert" className="portal-alert portal-alert-error">{error}</p>}
  <form onSubmit={submit}><div className="portal-form-grid">{labels.map(([key,label])=><label key={key}>{label}
   <input required={['title','sku','price','stock'].includes(key)} type={key==='stock'||key==='price'?'number':'text'}
    min={key==='stock'?'0':key==='price'?'0.01':undefined} step={key==='price'?'0.01':key==='stock'?'1':undefined}
    value={fields[key]} onChange={e=>setFields(f=>({...f,[key]:e.target.value}))}/></label>)}</div>
   <label className="hcs-editor-area">Description<textarea rows={4} value={fields.description} onChange={e=>setFields(f=>({...f,description:e.target.value}))}/></label>
   <button className="button button-primary" disabled={busy} type="submit">{busy?'Creating listing…':'Create listing and add photos →'}</button>
  </form></section></div>;
}
