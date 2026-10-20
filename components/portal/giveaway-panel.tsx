'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
type Data={giveaway:{id:string;prize_title:string;prize_description:string;prize_image_url:string|null;approximate_retail_value_cents:number|null;organizer_contact:string;rules_text:string;starts_at:string|null;ends_at:string|null;entries_open:boolean;drawn_at:string|null};entryCount:number;confirmedCount:number;winner:{id:string;name:string;email:string}|null};
export function GiveawayPanel(){
 const photoRef=useRef<HTMLInputElement|null>(null),[photoUrl,setPhotoUrl]=useState('');
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{const r=await fetch('/api/portal/giveaway',{cache:'no-store'}),x=await r.json();
  if(!r.ok)throw Error(x.error||'Unable to load giveaway');setData(x);setPhotoUrl(x.giveaway.prize_image_url||'')},[]);
 useEffect(()=>{load().catch(e=>setError(e.message))},[load]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!data)return;setBusy(true);setError('');setNotice('');
  const fields=new FormData(e.currentTarget);const g=data.giveaway;
  const when=(s:string)=>{const v=String(fields.get(s)||'');return v?new Date(v).toISOString():null};
  const body={action:'save',prizeTitle:fields.get('prizeTitle'),prizeDescription:fields.get('prizeDescription'),
   prizeImageUrl:fields.get('prizeImageUrl'),arvCents:Math.round(Number(fields.get('arv'))*100),
   organizerContact:fields.get('organizerContact'),rules:fields.get('rules'),startsAt:when('startsAt'),endsAt:when('endsAt'),
   entriesOpen:fields.get('entriesOpen')==='on'};
  if(body.entriesOpen&&!confirm('The published photo, prize, contact, and official rules have been verified and reviewed. Open the public giveaway?')){setBusy(false);return}
  try{const r=await fetch('/api/portal/giveaway',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),x=await r.json();
  if(!r.ok)throw Error(x.error||'Could not save giveaway');setNotice('Giveaway settings saved.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Save failed')}finally{setBusy(false)}
 }
 async function uploadPhoto(){const file=photoRef.current?.files?.[0];if(!file){setError('Choose a real photograph of the signed card first.');return}
  setBusy(true);setError('');try{const form=new FormData();form.set('file',file);
  const r=await fetch('/api/portal/giveaway/photo',{method:'POST',body:form}),x=await r.json();
  if(!r.ok||!x.url)throw Error(x.error||'Could not upload photo');setPhotoUrl(x.url);setNotice('Photo uploaded. Save giveaway settings to use it.');
  }catch(e){setError(e instanceof Error?e.message:'Upload failed')}finally{setBusy(false)}
 }
 async function draw(){if(!confirm('Draw a winner from confirmed eligible entries? This cannot be reversed.'))return;
  setBusy(true);setError('');try{const r=await fetch('/api/portal/giveaway',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'draw'})});
  const x=await r.json();if(!r.ok)throw Error(x.error||'Draw unavailable');setNotice('Winner drawn. Check the operator alert email and verified result.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Draw failed')}finally{setBusy(false)}
 }
 if(!data)return <section className="portal-panel"><h2>Stan Musial Giveaway</h2><p>{error||'Loading giveaway...'}</p></section>;
 const g=data.giveaway;const local=(s:string|null)=>{if(!s)return '';const d=new Date(s);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
 return <div className="portal-panels"><section className="portal-panel"><h2>Stan Musial Giveaway</h2><p><strong>{data.confirmedCount}</strong> confirmed entries · {data.entryCount} submitted · {g.entries_open?'Entries enabled':'Entries closed'}.</p>
 <p>Before opening, add the real card photo, accurate prize value and description, sponsor mailing/contact information, and finalized official sweepstakes rules. No purchases or follows give additional chances.</p>
 {notice&&<p role="status" className="portal-alert">{notice}</p>}{error&&<p role="alert" className="portal-alert portal-alert-error">{error}</p>}
 <form className="portal-login-form" onSubmit={submit}>
 <label>Prize title<input name="prizeTitle" required minLength={10} maxLength={180} defaultValue={g.prize_title}/></label>
 <label>Exact card, autograph details and authentication status<textarea name="prizeDescription" required minLength={20} maxLength={1000} defaultValue={g.prize_description} rows={4}/></label>
 <label>Prize photo HTTPS URL<input name="prizeImageUrl" type="url" value={photoUrl} onChange={e=>setPhotoUrl(e.target.value)}/></label>
 <label>Upload actual signed card photograph (JPG, PNG, WebP)<input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp"/></label><button type="button" disabled={busy} className="button button-outline" onClick={uploadPhoto}>Upload photograph</button>{photoUrl&&<img src={photoUrl} alt="Current giveaway card photo" style={{maxWidth:240,width:"100%",height:"auto"}}/>}
 <label>Approximate retail value ($)<input name="arv" type="number" step="0.01" min="0.01" required defaultValue={g.approximate_retail_value_cents===null?'':String(g.approximate_retail_value_cents/100)}/></label>
 <label>Organizer contact, including address<input name="organizerContact" maxLength={500} defaultValue={g.organizer_contact}/></label>
 <label>Opens (local time)<input name="startsAt" type="datetime-local" defaultValue={local(g.starts_at)}/></label>
 <label>Closes (local time)<input name="endsAt" type="datetime-local" defaultValue={local(g.ends_at)}/></label>
 <label>Official rules<textarea name="rules" rows={12} maxLength={12000} defaultValue={g.rules_text} placeholder="No purchase necessary; eligibility; U.S. 18+; dates and times with timezone; clear entry method; limits; prize ARV; drawing and notification; odds; claim deadline; sponsor full contact/address; required publicity, privacy and Meta disclaimer..."/></label>
 <label><input name="entriesOpen" type="checkbox" defaultChecked={g.entries_open}/> Open entries after all details are legally reviewed</label>
 <button type="submit" disabled={busy} className="button button-primary">{busy?'Saving…':'Save giveaway settings'}</button>
 </form></section>
 <section className="portal-panel"><h2>Giveaway controls</h2><p>Public entry page: <a href="/giveaway" target="_blank" rel="noreferrer">View giveaway ↗</a></p>
 <p>The winner is selected from one verified entry per submitted email. Duplicate email entries are blocked; no purchase-based entries.</p>
 {g.drawn_at?<p>Winner drawn {new Date(g.drawn_at).toLocaleString()}. Contact: <strong>{data.winner?.name||'Recorded winner'}</strong> · <a href={'mailto:'+data.winner?.email}>{data.winner?.email}</a>. Confirm eligibility before sending the card.</p>:<button type="button" onClick={draw} disabled={busy||!g.ends_at||Date.now()<Date.parse(g.ends_at)} className="button button-outline">Draw winner after entries close</button>}
 </section></div>
}
