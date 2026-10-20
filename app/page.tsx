import Link from 'next/link';
import type {Metadata} from 'next';
export const metadata:Metadata={title:{absolute:'Hometown Card Shop | Sports Cards, Vintage Singles & Trading Cards'},description:'Shop thousands of baseball, football, basketball and vintage trading cards from Amity, Arkansas. Real cards, fair prices, and free bonus cards with Hometown Card Shop purchases.',alternates:{canonical:'/'}};
import {recommended} from '@/lib/catalog';
import {getCatalog} from '@/lib/catalog-db';
import {ProductCard} from '@/components/product-card';
import {shelvesWithCounts} from '@/lib/categories';
import {RewardSteps} from '@/components/reward-steps';
import {Icon} from '@/components/icons';

const storefrontSchema={
 '@context':'https://schema.org','@type':'OnlineStore','@id':'https://www.hometowncardshop.com/#store',
 name:'Hometown Card Shop',url:'https://www.hometowncardshop.com/',
 logo:'https://www.hometowncardshop.com/images/hometown-card-shop-mark.svg',
 image:'https://www.hometowncardshop.com/images/hometown-card-shop-cover.svg',
 description:'An Arkansas-based online shop for baseball, football, basketball and vintage trading card collectors.',
 address:{'@type':'PostalAddress',addressLocality:'Amity',addressRegion:'AR',addressCountry:'US'}
};
export default async function Home(){
 const products=await getCatalog();
 const featured=recommended(11,products);const cards=featured.slice(0,3);const picks=featured.length>=11?featured.slice(3):featured.slice(0,8);
 const shelves=shelvesWithCounts(products).filter(s=>s.count>0);
 const featuredNames=['Baseball','Football','Basketball','Other trading cards','Sports memorabilia'];
 const selected=[...shelves].sort((a,b)=>featuredNames.indexOf(a.name)-featuredNames.indexOf(b.name)).slice(0,5);
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(storefrontSchema)}}/>
 <section className="corner-hero"><div className="shell corner-hero-layout"><div className="corner-copy"><div className="corner-pretitle"><span>WELCOME IN</span><span>AMITY, ARKANSAS</span><span>EST. 2026</span></div><div className="hand-underline"><span>Pull up a stool. Stay awhile.</span></div><h1>A little card shop.<br/><em>A whole lot to look through.</em></h1><p>Dig through the boxes like you would at the card shop down the road. Real cards, fair prices, easy browsing, and free bonus cards with purchases from our own Hometown Card Shop shelves.</p><div className="corner-actions"><Link className="button button-primary" href="/shop">Dig through the boxes <Icon name="arrow" size={17}/></Link><Link className="corner-text-link" href="/categories">See every shelf →</Link></div><div className="corner-bottom-note"><span className="vintage-star">★</span><span><b>{products.length.toLocaleString('en-US')} individual listings</b><br/>Real cards from the shop, ready to browse</span></div></div>
 <div className="corner-art" aria-label="A few actual cards from the store"><div className="corner-art-header"><span>FROM THE CARD BOXES</span><span>NO. 001</span></div><div className="corner-cards">
 {cards.map((c,i)=><div className={`corner-card corner-card-${i}`} key={c.id}>{c.image?<img src={c.image} alt={c.title}/>:<span>YOUR NEXT FIND</span>}</div>)}
 </div><div className="corner-art-foot"><span>Good things come in little packages.</span><span>H.C.S. / AR</span></div></div></div></section>
 <section className="bonus-sign"><div className="shell"><div className="bonus-sign-top"><div><span className="kicker">OUR GOOD OLD-FASHIONED THANK-YOU</span><h2>Free cards with <em>our</em> purchases.</h2><p>Buy cards directly from Hometown Card Shop and we tuck free bonus cards into your shipment. Other sellers have their own offers and shipping policies.</p></div><div className="bonus-seal" aria-label="No minimum purchase">NO<br/><strong>MINIMUM</strong></div></div><RewardSteps/></div></section>
 <section className="section shelves-section"><div className="shell"><div className="section-heading"><div><span className="kicker">PULL OUT A BOX</span><h2>What are you hunting for?</h2><p>Start with the shelf. Then narrow it down by team, player, year, or set.</p></div><Link className="subtle-link" href="/categories">See all categories <Icon name="arrow" size={17}/></Link></div><div className="shelf-feature-grid">{selected.map((s,i)=><Link href={'/shop?sport='+encodeURIComponent(s.sport||'')} key={s.slug} className={`shelf-feature shelf-feature-${i}`}><span className="shelf-feature-index">BOX / {String(i+1).padStart(2,'0')}</span><span className="shelf-feature-icon" aria-hidden="true">{s.emoji}</span><strong>{s.name}</strong><span className="shelf-feature-total">{s.count.toLocaleString('en-US')} to look through</span><span className="shelf-feature-next">→</span></Link>)}</div></div></section>
 <section className="section featured vintage-featured"><div className="shell"><div className="section-heading"><div><span className="kicker">FRESH FROM THE BOXES</span><h2>A few worth flipping through.</h2><p>Real cards from our shelves, not sample listings.</p></div><Link href="/shop" className="subtle-link">Browse the whole shop <Icon name="arrow" size={17}/></Link></div><div className="product-grid">{picks.map(p=><ProductCard product={p} key={p.id}/>)}</div><div className="center-action"><Link href="/shop" className="button button-outline">See all {products.length.toLocaleString('en-US')} listings <Icon name="arrow" size={17}/></Link></div></div></section>
 <section className="brand-cover-strip" aria-label="Hometown Card Shop sports and trading cards"><div className="shell"><img src="/images/hometown-card-shop-cover.svg" width="1200" height="400" loading="lazy" alt="Hometown Card Shop sports and trading cards – buy, sell, trade"/></div></section>
 <section className="corner-story"><div className="shell corner-story-grid"><div className="corner-story-badge"><img src="/images/hometown-card-shop-mark.svg" alt="Hometown Card Shop Arkansas sports trading card logo" width="240" height="235"/><span>ROOTED IN ARKANSAS</span></div><div><span className="kicker">NOT A BIG-BOX CARD STORE</span><h2>The shop&apos;s online.<br/>The hometown feel stays.</h2><p>We're starting with thousands of real cards and keeping the best parts of an old-school card shop: plenty to look through, straightforward prices, and folks who enjoy collecting.</p><p>We're rooted in Arkansas, and we want collectors to feel welcome wherever they're from.</p><Link href="/about" className="corner-text-link">More about the shop →</Link></div></div></section>
 <div className="shell seller-interest-whisper">Have cards you’d like to sell here someday? <Link href="/sell">Let us know you’re interested →</Link></div>
 </>;
}
