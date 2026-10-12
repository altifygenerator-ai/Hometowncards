'use client';
import {useEffect,useState} from 'react';
type Lead={id:string;contact_name:string;email:string;shop_name:string;location:string;inventory_size:string;currently_selling:string;seller_plan_interest:string;notes:string;notification_status:string;created_at:string};
export function DealerInterestPanel(){
 const [items,setItems]=useState<Lead[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;fetch('/api/portal/dealer-interest',{cache:'no-store'})
 .then(async r=>{const x=await r.json();if(!r.ok)throw Error(x.error||'Could not load dealer interest');return x as {leads:Lead[]}})
 .then(d=>{if(active){setItems(d.leads);setLoading(false)}})
 .catch(e=>{if(active){setError(e instanceof Error?e.message:'Could not load dealer interest');setLoading(false)}});
 return()=>{active=false};},[]);
 return <section className="portal-panel"><h2>Interested dealers</h2><p>Each public inquiry is stored in Supabase and emailed to the shop inbox through Resend. This is a private lead list, not an approved seller directory.</p>
  {loading?<p>Loading inquiries…</p>:error?<p role="alert" className="portal-alert portal-alert-error">{error}</p>:
  <><p><strong>{items.length}</strong> recorded inquiries {items.length===100?'(latest 100)':''}.</p>
   {items.length===0?<p>No one has contacted us about becoming a dealer yet.</p>:
    <div className="portal-table-scroll"><table className="portal-table"><thead><tr><th>Received</th><th>Dealer</th><th>Collection</th><th>Plan</th><th>Email alert</th></tr></thead>
    <tbody>{items.map(l=><tr key={l.id}>
     <td>{new Date(l.created_at).toLocaleDateString('en-US')}</td>
     <td><strong>{l.shop_name||l.contact_name}</strong><br/>{l.shop_name&&l.contact_name}<br/>{l.location}<br/><a href={'mailto:'+encodeURIComponent(l.email)}>{l.email}</a>{l.notes&&<details><summary>Notes</summary><p>{l.notes}</p></details>}</td>
     <td>{l.inventory_size}<br/>{l.currently_selling}</td><td>{l.seller_plan_interest==='starter'?'$5.99 Starter':l.seller_plan_interest==='payg'?'2% per sale':'Undecided'}</td>
     <td>{l.notification_status}</td>
    </tr>)}</tbody></table></div>}</>}
 </section>;
}
