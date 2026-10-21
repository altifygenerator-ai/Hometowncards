'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import {MUSIAL_GIVEAWAY_END_UTC,MUSIAL_GIVEAWAY_END_LABEL} from '@/lib/giveaway-config';
const RULES_DRAFT = `HOMETOWN CARD SHOP STAN MUSIAL AUTOGRAPH CARD GIVEAWAY — OFFICIAL RULES DRAFT (COMPLETE AND REVIEW BEFORE OPENING)

1. NO PURCHASE NECESSARY. A purchase, visit to a store, or Facebook follow is not required and does not increase the chance of winning. This giveaway is free to enter.
2. Sponsor: Hometown Card Shop, [ENTER FULL MAILING ADDRESS], Amity, Arkansas. Questions: [ENTER PUBLIC CONTACT EMAIL].
3. Eligibility: Open only to legal residents of the 50 United States and District of Columbia who are 18 or older at entry, excluding the Sponsor's owners, employees and their immediate household members. Void where prohibited.
4. Entry period: Entries open [ENTER START DATE & TIME CENTRAL] and close [ENTER END DATE & TIME CENTRAL].
5. How to enter: Visit https://www.hometowncardshop.com/giveaway, provide a valid name and email, certify eligibility, accept these official rules, and submit the free entry form. Click the email confirmation link before the entry deadline. Limit one entry per person. Duplicate or fraudulent entries may be disqualified.
6. Prize: One autographed Stan Musial baseball card. Exact year, manufacturer, condition, autograph authentication status, and photos: [ENTER EXACT CARD DESCRIPTION]. Approximate retail value: [ENTER DOLLAR VALUE]. No substitution or cash alternative unless required by law.
7. Winner selection: One entry will be selected at random from eligible, confirmed entries after the deadline. Odds depend on the number of eligible entries received.
8. Winner contact: The Sponsor will email the selected entrant within [ENTER NUMBER] business days. The entrant must reply within [ENTER NUMBER] days and complete any legally required eligibility verification. If a winner cannot be contacted or is ineligible, the Sponsor may select an alternate at random.
9. Delivery and taxes: Sponsor pays standard shipping to the winner's eligible US address. Winner is responsible for any taxes applicable to the prize. Sponsor may require documentation where legally required.
10. Privacy: Personal data collected for administering the promotion is used to verify entries, select and contact the winner, and deliver the prize. Marketing emails are optional and require separate affirmative consent. See https://www.hometowncardshop.com/privacy.
11. General: Sponsor may disqualify entries associated with fraud, automated abuse or rule violations. Any changes or cancellation must comply with applicable law; Sponsor will not substitute a different prize arbitrarily.
12. Facebook disclaimer: This promotion is not sponsored, endorsed, administered by, or associated with Facebook/Meta. Entrants release Facebook to the extent permitted by applicable law.

DRAFT ONLY — obtain review of Arkansas prize-promotion rules before publishing.`;

function buildMusialRules(form:HTMLFormElement){
 const f=new FormData(form);
 const title=String(f.get('prizeTitle')||'').trim()||'[ENTER PRIZE TITLE]';
 const prize=String(f.get('prizeDescription')||'').trim()||'[ENTER AUTHENTICATED CARD DETAILS]';
 const contact=String(f.get('organizerContact')||'').trim()||'[ENTER SPONSOR NAME, PUBLIC MAILING ADDRESS AND EMAIL]';
 const arv=Number(f.get('arv'));
 const value=Number.isFinite(arv)&&arv>0?'{id:string;prize_title:string;prize_description:string;prize_image_url:string|null;approximate_retail_value_cents:number|null;organizer_contact:string;facebook_page_url:string|null;rules_text:string;starts_at:string|null;ends_at:string|null;entries_open:boolean;drawn_at:string|null};entryCount:number;confirmedCount:number;winner:{id:string;name:string;email:string}|null};
export function GiveawayPanel(){
 const formRef=useRef<HTMLFormElement|null>(null);
 const photoRef=useRef<HTMLInputElement|null>(null),[photoUrl,setPhotoUrl]=useState(''),[draftRules,setDraftRules]=useState('');
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{const r=await fetch('/api/portal/giveaway',{cache:'no-store'}),x=await r.json();
  if(!r.ok)throw Error(x.error||'Unable to load giveaway');setData(x);setPhotoUrl(x.giveaway.prize_image_url||'');setDraftRules(x.giveaway.rules_text||'')},[]);
 useEffect(()=>{load().catch(e=>setError(e.message))},[load]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!data)return;setBusy(true);setError('');setNotice('');
  const fields=new FormData(e.currentTarget);const g=data.giveaway;
  const when=(s:string)=>{const v=String(fields.get(s)||'');return v?new Date(v).toISOString():null};
  const body={action:'save',prizeTitle:fields.get('prizeTitle'),prizeDescription:fields.get('prizeDescription'),
   prizeImageUrl:fields.get('prizeImageUrl'),arvCents:String(fields.get('arv')||'').trim()?Math.round(Number(fields.get('arv'))*100):null,
   organizerContact:fields.get('organizerContact'),facebookPageUrl:fields.get('facebookPageUrl'),rules:fields.get('rules'),startsAt:when('startsAt'),endsAt:MUSIAL_GIVEAWAY_END_UTC,
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
 <form ref={formRef} className="portal-login-form" onSubmit={submit}>
 <label>Prize title<input name="prizeTitle" required minLength={10} maxLength={180} defaultValue={g.prize_title}/></label>
 <label>Exact card, autograph details and authentication status<textarea name="prizeDescription" required minLength={20} maxLength={1000} defaultValue={g.prize_description} rows={4}/></label>
 <label>Prize photo HTTPS URL<input name="prizeImageUrl" type="url" value={photoUrl} onChange={e=>setPhotoUrl(e.target.value)}/></label>
 <label>Upload actual signed card photograph (JPG, PNG, WebP)<input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp"/></label><button type="button" disabled={busy} className="button button-outline" onClick={uploadPhoto}>Upload photograph</button>{photoUrl&&<img src={photoUrl} alt="Current giveaway card photo" style={{maxWidth:240,width:"100%",height:"auto"}}/>}
 <label>Approximate retail value ($)<input name="arv" type="number" step="0.01" min="0.01" defaultValue={g.approximate_retail_value_cents===null?'':String(g.approximate_retail_value_cents/100)}/></label>
 <label>Official Hometown Card Shop Facebook page URL (optional)<input name="facebookPageUrl" type="url" defaultValue={g.facebook_page_url||''} placeholder="https://www.facebook.com/..."/></label>
 <label>Organizer contact, including address<input name="organizerContact" maxLength={500} defaultValue={g.organizer_contact}/></label>
 <label>Opens (local time)<input name="startsAt" type="datetime-local" defaultValue={local(g.starts_at)}/></label>
 <p><strong>Fixed entry deadline:</strong> {MUSIAL_GIVEAWAY_END_LABEL}. Entries will close automatically, including if you forget to switch them off.</p>
 <label>Official rules<textarea name="rules" rows={12} maxLength={12000} value={draftRules} onChange={e=>setDraftRules(e.target.value)} placeholder="No purchase necessary; eligibility; U.S. 18+; dates and times with timezone; clear entry method; limits; prize ARV; drawing and notification; odds; claim deadline; sponsor full contact/address; required publicity, privacy and Meta disclaimer..."/></label>
 <button type="button" className="button button-outline" onClick={()=>{if(formRef.current&&(!draftRules||confirm("Replace rules with an editable draft using your current prize and sponsor fields?")))setDraftRules(buildMusialRules(formRef.current))}}>Generate rules from these details</button> <button type="button" className="button button-outline" onClick={()=>{if(!draftRules||confirm("Replace draft with an editable sample rules checklist?"))setDraftRules(RULES_DRAFT)}}>Insert editable rules draft</button>
 <label><input name="entriesOpen" type="checkbox" defaultChecked={g.entries_open}/> Open entries after all details are legally reviewed</label>
 <button type="submit" disabled={busy} className="button button-primary">{busy?'Saving…':'Save giveaway settings'}</button>
 </form></section>
 <section className="portal-panel"><h2>Giveaway controls</h2><p>Public entry page: <a href="/giveaway" target="_blank" rel="noreferrer">View giveaway ↗</a></p>
 <p>The winner is selected from one verified entry per submitted email. Duplicate email entries are blocked; no purchase-based entries.</p>
 {g.drawn_at?<p>Winner drawn {new Date(g.drawn_at).toLocaleString()}. Contact: <strong>{data.winner?.name||'Recorded winner'}</strong> · <a href={'mailto:'+data.winner?.email}>{data.winner?.email}</a>. Confirm eligibility before sending the card.</p>:<button type="button" onClick={draw} disabled={busy||!g.ends_at||Date.now()<Date.parse(g.ends_at)} className="button button-outline">Draw winner after entries close</button>}
 </section></div>
}
+arv.toFixed(2):'[ENTER RETAIL VALUE]';
 const start=String(f.get('startsAt')||'');
 const opening=start?new Date(start).toLocaleString('en-US',{dateStyle:'long',timeStyle:'short',timeZone:'America/Chicago'})+' Central':'[ENTER OFFICIAL OPENING DATE AND TIME CENTRAL]';
 return [
  'HOMETOWN CARD SHOP — STAN MUSIAL CARD GIVEAWAY — OFFICIAL RULES (REVIEW BEFORE PUBLISHING)',
  '1. No purchase or payment is necessary to enter or win. A purchase, review, referral, Facebook like, share, or follow does not increase the odds of winning.',
  '2. Sponsor and contact: '+contact+'.',
  '3. Eligibility: Open to legal residents of the 50 United States and Washington, DC who are at least 18 years old at entry. Sponsor, employees, and members of their immediate households are ineligible. Void where prohibited by law.',
  '4. Entry period: Opens '+opening+'. Closes December 1, 2026 at 11:59 PM Central Standard Time (exclusive cutoff December 2, 2026 at 12:00 AM CST). Sponsor server records determine timing.',
  '5. To enter: Visit https://www.hometowncardshop.com/giveaway and submit the free entry form with your name, valid email, eligibility certifications and acceptance of these rules. Verify the entry by clicking the email link before the entry deadline. Limit one entry per person. Duplicate, automated, false or otherwise invalid submissions may be disqualified. No additional entries for buying, sharing, or following.',
  '6. Prize: One '+title+'. Description: '+prize+'. Approximate retail value (ARV): '+value+'. One prize total. No cash alternative. Prize is awarded as described, subject to verification and applicable law.',
  '7. Drawing and odds: One winner will be selected at random from all timely confirmed, eligible entries after December 1, 2026. Chances depend on the number of eligible verified entries.',
  '8. Winner notification: Sponsor will contact the randomly selected entrant by email within five business days of the drawing. Winner must respond within seven calendar days after the notice and satisfy any reasonable age, residence, and eligibility checks. If unreachable or ineligible, Sponsor may randomly choose an alternate.',
  '9. Delivery and taxes: Sponsor will cover standard shipping to an eligible United States mailing address. The winner is responsible for taxes due on the prize, if any, and any documentation required by applicable law.',
  '10. Personal information: Names and email addresses are used for giveaway administration, verification, contacting the winner and prize fulfillment. Optional advertising emails require a separate unchecked opt-in. See https://www.hometowncardshop.com/privacy.',
  '11. General: Sponsor may disqualify fraudulent or automated entries, or entries violating these rules. This promotion is subject to applicable laws. Sponsor will administer winner selection fairly and retain a record of the drawing.',
  '12. Facebook: This giveaway is not sponsored, endorsed, administered by, or associated with Meta or Facebook. Entrants release Facebook from claims connected with this promotion to the extent allowed by law.'
 ].join('\\n\\n');
}
type Data={giveaway:{id:string;prize_title:string;prize_description:string;prize_image_url:string|null;approximate_retail_value_cents:number|null;organizer_contact:string;facebook_page_url:string|null;rules_text:string;starts_at:string|null;ends_at:string|null;entries_open:boolean;drawn_at:string|null};entryCount:number;confirmedCount:number;winner:{id:string;name:string;email:string}|null};
export function GiveawayPanel(){
 const photoRef=useRef<HTMLInputElement|null>(null),[photoUrl,setPhotoUrl]=useState(''),[draftRules,setDraftRules]=useState('');
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{const r=await fetch('/api/portal/giveaway',{cache:'no-store'}),x=await r.json();
  if(!r.ok)throw Error(x.error||'Unable to load giveaway');setData(x);setPhotoUrl(x.giveaway.prize_image_url||'');setDraftRules(x.giveaway.rules_text||'')},[]);
 useEffect(()=>{load().catch(e=>setError(e.message))},[load]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(!data)return;setBusy(true);setError('');setNotice('');
  const fields=new FormData(e.currentTarget);const g=data.giveaway;
  const when=(s:string)=>{const v=String(fields.get(s)||'');return v?new Date(v).toISOString():null};
  const body={action:'save',prizeTitle:fields.get('prizeTitle'),prizeDescription:fields.get('prizeDescription'),
   prizeImageUrl:fields.get('prizeImageUrl'),arvCents:String(fields.get('arv')||'').trim()?Math.round(Number(fields.get('arv'))*100):null,
   organizerContact:fields.get('organizerContact'),facebookPageUrl:fields.get('facebookPageUrl'),rules:fields.get('rules'),startsAt:when('startsAt'),endsAt:MUSIAL_GIVEAWAY_END_UTC,
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
 <label>Approximate retail value ($)<input name="arv" type="number" step="0.01" min="0.01" defaultValue={g.approximate_retail_value_cents===null?'':String(g.approximate_retail_value_cents/100)}/></label>
 <label>Official Hometown Card Shop Facebook page URL (optional)<input name="facebookPageUrl" type="url" defaultValue={g.facebook_page_url||''} placeholder="https://www.facebook.com/..."/></label>
 <label>Organizer contact, including address<input name="organizerContact" maxLength={500} defaultValue={g.organizer_contact}/></label>
 <label>Opens (local time)<input name="startsAt" type="datetime-local" defaultValue={local(g.starts_at)}/></label>
 <p><strong>Fixed entry deadline:</strong> {MUSIAL_GIVEAWAY_END_LABEL}. Entries will close automatically, including if you forget to switch them off.</p>
 <label>Official rules<textarea name="rules" rows={12} maxLength={12000} value={draftRules} onChange={e=>setDraftRules(e.target.value)} placeholder="No purchase necessary; eligibility; U.S. 18+; dates and times with timezone; clear entry method; limits; prize ARV; drawing and notification; odds; claim deadline; sponsor full contact/address; required publicity, privacy and Meta disclaimer..."/></label>
 <button type="button" className="button button-outline" onClick={()=>{if(!draftRules||confirm("Replace draft with an editable sample rules checklist?"))setDraftRules(RULES_DRAFT)}}>Insert editable rules draft</button>
 <label><input name="entriesOpen" type="checkbox" defaultChecked={g.entries_open}/> Open entries after all details are legally reviewed</label>
 <button type="submit" disabled={busy} className="button button-primary">{busy?'Saving…':'Save giveaway settings'}</button>
 </form></section>
 <section className="portal-panel"><h2>Giveaway controls</h2><p>Public entry page: <a href="/giveaway" target="_blank" rel="noreferrer">View giveaway ↗</a></p>
 <p>The winner is selected from one verified entry per submitted email. Duplicate email entries are blocked; no purchase-based entries.</p>
 {g.drawn_at?<p>Winner drawn {new Date(g.drawn_at).toLocaleString()}. Contact: <strong>{data.winner?.name||'Recorded winner'}</strong> · <a href={'mailto:'+data.winner?.email}>{data.winner?.email}</a>. Confirm eligibility before sending the card.</p>:<button type="button" onClick={draw} disabled={busy||!g.ends_at||Date.now()<Date.parse(g.ends_at)} className="button button-outline">Draw winner after entries close</button>}
 </section></div>
}
