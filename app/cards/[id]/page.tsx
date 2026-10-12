import Link from 'next/link';import {notFound} from 'next/navigation';import type {Metadata} from 'next';
import {formatMoney} from '@/lib/catalog';import {getCatalog,getCatalogItem,getProductGallery} from '@/lib/catalog-db';import {CardPhotoGallery} from '@/components/card-photo-gallery';import {AddToCart} from '@/components/add-to-cart';import {ProductCard} from '@/components/product-card';import {Icon} from '@/components/icons';
type Props={params:Promise<{id:string}>};
const origin='https://www.hometowncardshop.com';
function cardSummary(p:{title:string;year:string;set:string;number:string;player:string;team:string;condition:string;price:number}){
 const facts=[p.year,p.set,p.player,p.team,p.number?'Card #'+p.number:'',p.condition].filter(Boolean);
 return [p.title,facts.length?facts.join(' · '):'',formatMoney(p.price),'See current photos and availability at Hometown Card Shop.'].filter(Boolean).join('. ').slice(0,260);
}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {id}=await params;
 const p=await getCatalogItem(id);
 if(!p)return {title:'Card not found',robots:{index:false,follow:false}};
 const path='/cards/'+encodeURIComponent(p.id);
 return {title:p.title,description:cardSummary(p).slice(0,160),alternates:{canonical:path},
 openGraph:{title:p.title,description:cardSummary(p).slice(0,160),url:origin+path,type:'website',images:p.image?[{url:p.image,alt:p.title}]:undefined}};
}
export default async function CardDetail({params}:Props){const {id}=await params;const p=await getCatalogItem(id);if(!p)notFound();
 const album=p.productId?await getProductGallery(p.productId):[];
 const similar=(await getCatalog()).filter(x=>x.id!==p.id&&x.sport===p.sport&&x.image).slice(0,4);
 const productUrl=origin+'/cards/'+encodeURIComponent(p.id);
 const details=[p.year,p.set,p.player,p.team,p.number?'#'+p.number:''].filter(Boolean).join(' · ');
 const schema={
  '@context':'https://schema.org','@type':'Product',
  name:p.title,
  description:cardSummary(p),
  url:productUrl,
  ...(p.image?{image:[p.image]}:{}),
  ...(p.sku?{sku:p.sku}:{}),
  ...(p.sport?{category:p.sport+' trading cards'}:{}),
  offers:{'@type':'Offer',url:p.ebayUrl||productUrl,priceCurrency:'USD',price:(p.price/100).toFixed(2),
   availability:p.quantity>0?'https://schema.org/InStock':'https://schema.org/OutOfStock',
   seller:{'@type':'Organization',name:p.sellerName}}
 };
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/><div className="shell breadcrumbs"><Link href="/">Home</Link> / <Link href="/shop">Cards</Link> / <Link href={['Baseball','Football','Basketball'].includes(p.sport)?'/sports/'+p.sport.toLowerCase():'/shop?sport='+encodeURIComponent(p.sport)}>{p.sport}</Link> / <span>Item {p.id}</span></div>
 <section className="shell detail-layout"><div className="detail-media"><CardPhotoGallery title={p.title} front={p.image} back={p.backImage} extras={album.filter(x=>x.slot.startsWith('extra-')).map(x=>({url:x.url,label:'Additional card photo'}))}/><div className="photo-disclaimer">The card shown is the actual card associated with the listing where an original photo is available. Please review the photos for condition details.</div></div>
 <div className="detail-info"><div className="detail-kicker">{p.sport}{p.team?' / '+p.team:''}</div><h1>{p.title}</h1><div className="detail-price">{formatMoney(p.price)}</div><div className="detail-stock"><span className="stock-dot"/> {p.quantity>0?`${p.quantity} in our catalog · seller: ${p.sellerName}`:'Currently unavailable'}</div>
 <div className="seller-byline">From <Link href={'/sellers/'+p.sellerSlug}>{p.sellerName}</Link>{p.sellerSlug==='hometown-card-shop'?' · Amity, Arkansas':''}</div><div className="detail-divider"/><div className="detail-attributes">{[['Player',p.player],['Sport',p.sport],['Team',p.team],['Year',p.year],['Set',p.set],['Card no.',p.number],['Condition',p.condition],['SKU',p.sku]].filter(x=>x[1]).map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
 <div className="hcs-detail-description"><h2>About this card</h2><p>{p.description||('This '+p.sport.toLowerCase()+' card is listed from our Arkansas collection. '+(details?'Card details: '+details+'. ':'')+'Review the listing photos for the exact card and condition before ordering.')}</p></div><div className="detail-divider"/><AddToCart product={p} wide/>{process.env.NEXT_PUBLIC_CHECKOUT_ENABLED!=='true'?<div className="detail-preview-notice"><Icon name="shield" size={18}/> Online checkout isn't available yet. You can still find this card through the original eBay listing below.</div>:null}
 <div className="detail-links">{p.ebayUrl?<a href={p.ebayUrl} target="_blank" rel="noopener noreferrer">View this listing on eBay <Icon name="external" size={15}/></a>:null}<Link href="/shipping">Shipping & packaging <Icon name="arrow" size={15}/></Link></div>
 <div className="detail-bonus"><Icon name="gift" size={22}/><div><strong>We like throwing in a little extra.</strong><p>1 free card with any purchase, 5 at $10, 10 at $25 and 20 at $50. Terms on our <Link href="/help#rewards">rewards page</Link>.</p></div></div></div></section>
 <section className="section shell related"><div className="section-heading"><div><span className="kicker">KEEP DIGGING</span><h2>More from the {p.sport.toLowerCase()} box</h2></div><Link href={['Baseball','Football','Basketball'].includes(p.sport)?'/sports/'+p.sport.toLowerCase():'/shop?sport='+encodeURIComponent(p.sport)} className="subtle-link">Browse {p.sport.toLowerCase()} <Icon name="arrow" size={17}/></Link></div><div className="product-grid">{similar.map(x=><ProductCard key={x.id} product={x}/>)}</div></section></>;
}
