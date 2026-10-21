import Link from 'next/link';
import type {Metadata} from 'next';
// Giveaway enrollment status is read from Supabase at request time, not at build time.
export const dynamic='force-dynamic';
export const metadata:Metadata={title:{absolute:'Hometown Card Shop | Sports Cards & Collectibles Marketplace'},description:'Shop Hometown Card Shop’s own cards alongside listings from independent sellers. Browse sports cards, vintage singles, and trading cards from Arkansas and beyond. Bonus cards apply only to purchases sold by Hometown Card Shop.',alternates:{canonical:'/'}};
import {recommended} from '@/lib/catalog';
import {getCatalog} from '@/lib/catalog-db';
import {ProductCard} from '@/components/product-card';
import {shelvesWithCounts} from '@/lib/categories';
import {RewardSteps} from '@/components/reward-steps';
import {Icon} from '@/components/icons';
import {CategoryIcon} from '@/components/category-icon';
import {db} from '@/lib/server/portal';
import {MUSIAL_GIVEAWAY_CLOSING_INSTANT,MUSIAL_GIVEAWAY_END_LABEL} from '@/lib/giveaway-config';

const storefrontSchema={
 '@context':'https://schema.org','@type':'OnlineStore','@id':'https://www.hometowncardshop.com/#store',
 name:'Hometown Card Shop',url:'https://www.hometowncardshop.com/',
 logo:'https://www.hometowncardshop.com/images/hometown-card-shop-mark.svg',
 image:'https://www.hometowncardshop.com/images/hometown-card-shop-cover.svg',
 description:'An Arkansas-based card marketplace with Hometown Card Shop inventory and approved independent sellers.',
 address:{'@type':'PostalAddress',addressLocality:'Amity',addressRegion:'AR',addressCountry:'US'}
};
export default async function Home(){
 const [products,giveaways]=await Promise.all([getCatalog(),db<Array<{starts_at:string|null;ends_at:string|null;entries_open:boolean;rules_text:string;prize_image_url:string|null;approximate_retail_value_cents:number|null}>>('shop_giveaways?select=starts_at,ends_at,entries_open,rules_text,prize_image_url,approximate_retail_value_cents&slug=eq.stan-musial-autograph&limit=1')]);
 const giveaway=giveaways[0];const now=Date.now();
 const giveawayLive=!!giveaway?.entries_open&&!!giveaway?.rules_text&&!!giveaway?.prize_image_url&&giveaway.approximate_retail_value_cents!==null&&!!giveaway.starts_at&&!!giveaway.ends_at&&now>=Date.parse(giveaway.starts_at)&&now<Date.parse(giveaway.ends_at)&&now<MUSIAL_GIVEAWAY_CLOSING_INSTANT;
 const cardHighlights=recommended(11,products);const cards=cardHighlights.slice(0,3);const picks=cardHighlights.length>=11?cardHighlights.slice(3):cardHighlights.slice(0,8);
 const shelves=shelvesWithCounts(products);
 const priority=['baseball','football','basketball','other-trading-cards','pokemon','magic','yugioh','one-piece','sports-memorabilia'];
 const stocked=shelves.filter(s=>s.count>0);
 const featuredShelves=priority.map(id=>stocked.find(s=>s.slug===id)).filter((s):s is (typeof stocked)[number]=>Boolean(s));
 const otherStocked=stocked.filter(s=>!priority.includes(s.slug)).sort((a,b)=>b.count-a.count);
 const selected=[...featuredShelves,...otherStocked].slice(0,8);
 const comingSoon=['pokemon','magic','yugioh','one-piece','non-sport'].map(id=>shelves.find(s=>s.slug===id)).filter((s):s is (typeof shelves)[number]=>Boolean(s&&s.count===0));
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(storefrontSchema)}}/>
 <section className="corner-hero"><div className="shell corner-hero-layout"><div className="corner-copy"><div className="corner-pretitle"><span>WELCOME IN</span><span>AMITY, ARKANSAS</span><span>EST. 2026</span></div><div className="hand-underline"><span>Pull up a stool. Stay awhile.</span></div><h1>A little card shop.<br/><em>A whole lot to look through.</em></h1><p>Browse our own cards alongside approved independent sellers. Dig for old favorites, visit each seller's storefront, and see their shipping details before you pay. Free bonus cards are included with purchases from our Hometown Card Shop shelves.</p><div className="corner-actions"><Link className="button button-primary" href="/shop">Dig through the boxes <Icon name="arrow" size={17}/></Link><Link className="corner-text-link" href="/categories">See every shelf →</Link></div><div className="corner-bottom-note"><span className="vintage-star">★</span><span><b>{products.length.toLocaleString('en-US')} individual listings</b><br/>Hometown cards and independent seller listings</span></div></div>
 <div className="corner-art" aria-label="A few actual cards from the store"><div className="corner-art-header"><span>FROM THE CARD BOXES</span><span>NO. 001</span></div><div className="corner-cards">
 {cards.map((c,i)=><div className={`corner-card corner-card-${i}`} key={c.id}>{c.image?<img src={c.image} alt={c.title}/>:<span>YOUR NEXT FIND</span>}</div>)}
 </div><div className="corner-art-foot"><span>Good things come in little packages.</span><span>H.C.S. / AR</span></div></div></div></section>
 <section className="section"><div className="shell"><div className="portal-panel" style={{padding:24,marginTop:20,marginBottom:20}}><span className="kicker">{giveawayLive?'FREE ENTRY · GIVEAWAY OPEN':'COLLECTOR GIVEAWAY'}</span><h2>Stan Musial autographed card giveaway</h2><p>{giveawayLive?'Enter for your chance to win a signed Stan Musial baseball card. No purchase required, and buying or following does not improve your odds.':'The free-entry Stan Musial giveaway is coming soon. Prize details and rules will be published before entries open.'} <strong>Closes {MUSIAL_GIVEAWAY_END_LABEL}.</strong></p><Link href="/giveaway" className="button button-outline">{giveawayLive?'Enter giveaway free →':'See giveaway details →'}</Link></div></div></section><section className="bonus-sign"><div className="shell"><div className="bonus-sign-top"><div><span className="kicker">OUR GOOD OLD-FASHIONED THANK-YOU</span><h2>Free cards with <em>our</em> purchases.</h2><p>Buy cards directly from Hometown Card Shop and we tuck free bonus cards into your shipment. Other sellers have their own offers and shipping policies.</p></div><div className="bonus-seal" aria-label="No minimum purchase">NO<br/><strong>MINIMUM</strong></div></div><RewardSteps/></div></section>
 <section className="section shelves-section"><div className="shell"><div className="section-heading"><div><span className="kicker">PULL OUT A BOX</span><h2>What are you hunting for?</h2><p>Start with the shelf. Then narrow it down by team, player, year, or set.</p></div><Link className="subtle-link" href="/categories">See all categories <Icon name="arrow" size={17}/></Link></div><div className="shelf-feature-grid">{selected.map((s,i)=><Link href={'/shop?sport='+encodeURIComponent(s.sport||'')} key={s.slug} className={`shelf-feature shelf-feature-${i}`}><span className="shelf-feature-index">BOX / {String(i+1).padStart(2,'0')}</span><span className="shelf-feature-icon" aria-hidden="true"><CategoryIcon slug={s.slug}/></span><strong>{s.name}</strong><span className="shelf-feature-total">{s.count.toLocaleString('en-US')} to look through</span><span className="shelf-feature-next">→</span></Link>)}</div>{comingSoon.length>0?<div className="shelf-coming-soon"><div><strong>More trading-card shelves</strong><span>These boxes open automatically as sellers add cards.</span></div><div className="shelf-coming-soon-items">{comingSoon.map(s=><span key={s.slug} className="shelf-coming-soon-chip"><CategoryIcon slug={s.slug}/> {s.name} <small>Coming soon</small></span>)}</div></div>:null}</div></section>
 <section className="section featured vintage-featured"><div className="shell"><div className="section-heading"><div><span className="kicker">FRESH FROM THE BOXES</span><h2>A few worth flipping through.</h2><p>Real listings from Hometown Card Shop and approved dealers.</p></div><Link href="/shop" className="subtle-link">Browse the whole shop <Icon name="arrow" size={17}/></Link></div><div className="product-grid">{picks.map(p=><ProductCard product={p} key={p.id}/>)}</div><div className="center-action"><Link href="/shop" className="button button-outline">See all {products.length.toLocaleString('en-US')} listings <Icon name="arrow" size={17}/></Link></div></div></section>
 <section className="brand-cover-strip" aria-label="Hometown Card Shop sports and trading cards"><div className="shell"><img src="/images/hometown-card-shop-cover.svg" width="1200" height="400" loading="lazy" alt="Hometown Card Shop sports and trading cards – buy, sell, trade"/></div></section>
 <section className="corner-story"><div className="shell corner-story-grid"><div className="corner-story-badge"><img src="/images/hometown-card-shop-mark.svg" alt="Hometown Card Shop Arkansas sports trading card logo" width="240" height="235"/><span>ROOTED IN ARKANSAS</span></div><div><span className="kicker">NOT A BIG-BOX CARD STORE</span><h2>The shop&apos;s online.<br/>The hometown feel stays.</h2><p>Hometown Card Shop is our own card shop and part of a growing marketplace for approved independent dealers. Every listing comes from real inventory, with straightforward prices and seller storefronts. We’re keeping the best parts of the old-school card shop: plenty to look through and folks who enjoy collecting.</p><p>We're rooted in Arkansas, and we want collectors to feel welcome wherever they're from.</p><Link href="/about" className="corner-text-link">More about the shop →</Link></div></div></section>
 <div className="shell seller-interest-whisper">Have cards you’d like to sell? <Link href="/sell">Apply to open your own shop →</Link></div>
 </>;
}
