import Link from 'next/link';
import {db} from '@/lib/server/portal';
import {GiveawayEntry} from '@/components/giveaway-entry';
export const dynamic='force-dynamic';
export const metadata={title:'Stan Musial Autograph Card Giveaway | Hometown Card Shop',description:'A free-entry giveaway for a signed Stan Musial baseball card. No purchase necessary. Follow the official rules.'};
type G={prize_title:string;prize_description:string;prize_image_url:string|null;approximate_retail_value_cents:number|null;rules_text:string;organizer_contact:string;facebook_page_url:string|null;starts_at:string|null;ends_at:string|null;entries_open:boolean;drawn_at:string|null};
export default async function Giveaway({searchParams}:{searchParams:Promise<{entry?:string}>}){
 const params=await searchParams;
 const items=await db<G[]>('shop_giveaways?select=prize_title,prize_description,prize_image_url,approximate_retail_value_cents,rules_text,organizer_contact,facebook_page_url,starts_at,ends_at,entries_open,drawn_at&slug=eq.stan-musial-autograph&limit=1');
 const g=items[0];const now=Date.now();
 const isOpen=!!g?.entries_open&&!!g?.rules_text&&g.approximate_retail_value_cents!==null&&!!g.starts_at&&!!g.ends_at&&now>=Date.parse(g.starts_at)&&now<Date.parse(g.ends_at);
 return <><section className="inner-hero"><div className="shell"><span className="kicker">COLLECTOR GIVEAWAY</span><h1>Win a signed Stan Musial card.</h1><p>One lucky collector. One card with real baseball history. No purchase necessary.</p></div></section>
 <section className="shell dealer-landing"><div className="dealer-grid">
 <div className="dealer-benefits"><span className="kicker">THE PRIZE</span><h2>{g?.prize_title||'Autographed Stan Musial baseball card'}</h2>
 {g?.prize_image_url?<img src={g.prize_image_url} alt={g.prize_title} style={{maxWidth:340,width:'100%',height:'auto'}}/>:<p>Photos and specific card details will appear before entries open.</p>}
 <p>{g?.prize_description}</p>
 {g?.approximate_retail_value_cents!==null&&g?.approximate_retail_value_cents!==undefined?<p>Approximate retail value: ${(g.approximate_retail_value_cents/100).toFixed(2)}.</p>:null}
 {g?.ends_at&&<p>Entry deadline: {new Date(g.ends_at).toLocaleString('en-US',{timeZone:'America/Chicago',dateStyle:'full',timeStyle:'short'})} Central.</p>}
 <p><strong>Want to shop too?</strong> Browse thousands of cards and free bonus cards with purchases from Hometown Card Shop itself. Purchases never count as entries or improve your odds.</p>
 <Link href="/shop" className="button button-outline">Shop all cards →</Link>
 {g?.facebook_page_url&&<p><a href={g.facebook_page_url} target="_blank" rel="noopener noreferrer" className="button button-outline">Follow Hometown Card Shop on Facebook ↗</a><br/><small>Following is optional and does not count as an entry or affect your chances of winning.</small></p>}
 {g?.rules_text&&<details style={{marginTop:24}}><summary><strong>Official Giveaway Rules</strong></summary><p style={{whiteSpace:'pre-wrap'}}>{g.rules_text}</p></details>}
 {g?.organizer_contact&&<p>Organizer: {g.organizer_contact}</p>}
 <p className="dealer-form-note">Not sponsored, endorsed, administered by or associated with Facebook. Facebook is released from liability by participants to the extent permitted by law.</p>
 </div><section className="dealer-form-wrap"><span className="kicker">FREE ENTRY</span>
 {params.entry==='confirmed'?<div className="dealer-thanks"><h2>Entry confirmed!</h2><p>Your free entry is now verified. Thanks for joining.</p></div>:params.entry==='expired'||params.entry==='invalid'?<p role="alert">This confirmation link is invalid or expired.</p>:null}
 <GiveawayEntry isOpen={isOpen}/></section></div></section></>;
}
