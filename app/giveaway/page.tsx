import Link from 'next/link';
import {db} from '@/lib/server/portal';
import {GiveawayEntry} from '@/components/giveaway-entry';
import {GiveawayCountdown} from '@/components/giveaway-countdown';
import {MUSIAL_GIVEAWAY_END_LABEL,MUSIAL_GIVEAWAY_CLOSING_INSTANT} from '@/lib/giveaway-config';
export const dynamic='force-dynamic';
export const metadata={title:'Win a Signed 1962 Topps Stan Musial #50 | Hometown Card Shop',description:'Free entry for a chance to win a 1962 Topps #50 Stan Musial card bearing an on-card signature. Closes December 1, 2026 at 11:59 PM Central. No purchase necessary.'};
type G={prize_title:string;prize_description:string;prize_image_url:string|null;approximate_retail_value_cents:number|null;rules_text:string;organizer_contact:string;facebook_page_url:string|null;starts_at:string|null;ends_at:string|null;entries_open:boolean;drawn_at:string|null};
export default async function Giveaway({searchParams}:{searchParams:Promise<{entry?:string}>}){
 const params=await searchParams;
 const items=await db<G[]>('shop_giveaways?select=prize_title,prize_description,prize_image_url,approximate_retail_value_cents,rules_text,organizer_contact,facebook_page_url,starts_at,ends_at,entries_open,drawn_at&slug=eq.stan-musial-autograph&limit=1');
 const g=items[0];const now=Date.now();
 const isOpen=!!g?.entries_open&&!!g?.prize_image_url&&!!g?.rules_text&&g.approximate_retail_value_cents!==null&&!!g.starts_at&&!!g.ends_at&&now>=Date.parse(g.starts_at)&&now<Date.parse(g.ends_at)&&now<MUSIAL_GIVEAWAY_CLOSING_INSTANT;
 const ended=now>=MUSIAL_GIVEAWAY_CLOSING_INSTANT||!!g?.drawn_at;
 const frontPhoto=g?.prize_image_url||'/images/giveaway/stan-musial-front.jpg';
 const prizePhotos=[
  {src:frontPhoto,alt:'Front of the 1962 Topps #50 Stan Musial giveaway card showing the on-card signature',label:'Front / signature'},
  {src:'/images/giveaway/stan-musial-back.jpg',alt:'Back of the 1962 Topps #50 Stan Musial giveaway card',label:'Back / 1962 Topps #50'}
 ];
 return <><section className="inner-hero giveaway-hero"><div className="shell"><span className="kicker">FREE COLLECTOR GIVEAWAY</span><h1>Win a signed Stan Musial card.</h1><p>One lucky collector. One card with baseball history. No purchase or Facebook follow necessary.</p><div className="giveaway-clock-wrap"><p><strong>Closes: {MUSIAL_GIVEAWAY_END_LABEL}</strong></p><GiveawayCountdown/><a href="#enter-musial-giveaway" className="button button-primary">{isOpen?'Enter for free →':ended?'Giveaway ended':'See giveaway details ↓'}</a></div></div></section>
 <section className="shell dealer-landing"><div className="dealer-grid">
 <div className="dealer-benefits giveaway-prize"><span className="kicker">THE PRIZE</span><h2>{g?.prize_title||'1962 Topps #50 Stan Musial signed card'}</h2>
 <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14,maxWidth:720,alignItems:'start'}}>
  {prizePhotos.map((photo)=><figure key={photo.src} style={{margin:0}}><img src={photo.src} alt={photo.alt} style={{display:'block',width:'100%',height:'auto',maxHeight:520,objectFit:'contain',borderRadius:12}}/><figcaption style={{fontSize:13,marginTop:7,opacity:.72}}>{photo.label}</figcaption></figure>)}
 </div>
 <p>{g?.prize_description||'1962 Topps #50 Stan Musial card bearing an on-card signature. The exact card shown in the prize photos will be awarded.'}</p>
 {g?.approximate_retail_value_cents!==null&&g?.approximate_retail_value_cents!==undefined?<p>Approximate retail value: ${(g.approximate_retail_value_cents/100).toFixed(2)}. Estimated value is not a guarantee of resale value.</p>:null}
 <p><strong>Entry deadline: {MUSIAL_GIVEAWAY_END_LABEL}</strong></p><div className="giveaway-howto"><h3>How it works</h3><p>1. Enter your name and email for free.</p><p>2. Verify your entry using the link in your email.</p><p>3. One confirmed eligible entry will be drawn randomly after entries close.</p></div>
 <p><strong>Want to shop too?</strong> Browse thousands of cards and free bonus cards with purchases from Hometown Card Shop itself. Purchases never count as entries or improve your odds.</p>
 <Link href="/shop" className="button button-outline">Shop all cards →</Link>
 {g?.facebook_page_url&&<p><a href={g.facebook_page_url} target="_blank" rel="noopener noreferrer" className="button button-outline">Follow Hometown Card Shop on Facebook ↗</a><br/><small>Following is optional and does not count as an entry or affect your chances of winning.</small></p>}
 {g?.rules_text&&<details style={{marginTop:24}}><summary><strong>Official Giveaway Rules</strong></summary><p style={{whiteSpace:'pre-wrap'}}>{g.rules_text}</p></details>}
 {g?.organizer_contact&&<p>Organizer: {g.organizer_contact}</p>}
 <p className="dealer-form-note">Not sponsored, endorsed, administered by or associated with Facebook. Facebook is released from liability by participants to the extent permitted by law.</p>
 </div><section className="dealer-form-wrap" id="enter-musial-giveaway"><span className="kicker">FREE ENTRY</span><h2>{ended?'Giveaway ended':isOpen?'Enter the drawing':'Entries opening soon'}</h2>
 {params.entry==='confirmed'?<div className="dealer-thanks"><h2>Entry confirmed!</h2><p>Your free entry is now verified. Thanks for joining.</p></div>:params.entry==='expired'||params.entry==='invalid'?<p role="alert">This confirmation link is invalid or expired.</p>:null}
 {params.entry!=='confirmed'&&<GiveawayEntry isOpen={isOpen} isEnded={ended}/>}</section></div></section></>;
}
