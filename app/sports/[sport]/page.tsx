import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {getCatalog} from '@/lib/catalog-db';
import {ProductCard} from '@/components/product-card';
import {Icon} from '@/components/icons';
import {recommended} from '@/lib/catalog';

const sports={
 baseball:{
  name:'Baseball',
  heading:'Baseball Cards',
  intro:'Browse baseball trading cards from our Arkansas card shop, from classic sets and longtime favorites to newer finds. Filter the full selection by player, team and year.',
  description:'Shop baseball cards, vintage baseball singles and collectible player cards at Hometown Card Shop. Browse real listings by player, team, year and set.',
 },
 football:{
  name:'Football',
  heading:'Football Cards',
  intro:'Find football trading cards by player, team, season and set. From older collections to more recent cards, these are actual listed singles from our boxes.',
  description:'Shop football cards and collectible NFL player singles at Hometown Card Shop. Explore available sports cards by player, team, set and year.',
 },
 basketball:{
  name:'Basketball',
  heading:'Basketball Cards',
  intro:'Flip through available basketball trading cards, browse favorite players and discover additions for your personal collection. Every listing reflects our current stock.',
  description:'Browse basketball cards, player singles and collectible trading cards at Hometown Card Shop in Arkansas. Find cards by year, set, team and player.',
 },
} as const;
type SportKey=keyof typeof sports;
type Props={params:Promise<{sport:string}>};
export function generateStaticParams(){return Object.keys(sports).map(sport=>({sport}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {sport}=await params;
 if(!(sport in sports))return {title:'Cards not found',robots:{index:false,follow:false}};
 const item=sports[sport as SportKey];
 return {title:item.heading+' for Sale',description:item.description,alternates:{canonical:'/sports/'+sport},openGraph:{title:item.heading+' | Hometown Card Shop',description:item.description}};
}
export default async function SportLanding({params}:Props){
 const {sport}=await params;
 if(!(sport in sports))notFound();
 const item=sports[sport as SportKey];
 const items=(await getCatalog()).filter(p=>p.sport.toLowerCase()===sport.toLowerCase());
 return <>
  <section className="inner-hero"><div className="shell">
   <span className="kicker">A BOX WORTH FLIPPING THROUGH</span>
   <h1>{item.heading}</h1>
   <p>{item.intro}</p>
  </div></section>
  <div className="shell breadcrumbs"><Link href="/">Home</Link> / <Link href="/categories">Categories</Link> / <span>{item.heading}</span></div>
  <section className="section shell">
   <div className="section-heading"><div>
    <span className="kicker">REAL CARDS, READY TO BROWSE</span><h2>{items.length.toLocaleString('en-US')} {item.name.toLowerCase()} card listings</h2>
    <p>See photos, card details and prices. Find your next favorite in the collection.</p>
   </div><Link href={'/shop?sport='+encodeURIComponent(item.name)} className="subtle-link">Search all {item.name.toLowerCase()} cards <Icon name="arrow" size={17}/></Link></div>
   {items.length?<div className="product-grid">{recommended(16,items).map(p=><ProductCard product={p} key={p.id}/>)}</div>:<p>We're still filling this box. Come back soon for more cards.</p>}
   <div className="center-action"><Link className="button button-primary" href={'/shop?sport='+encodeURIComponent(item.name)}>Browse every {item.name.toLowerCase()} listing <Icon name="arrow" size={17}/></Link></div>
  </section>
  <section className="section shell"><h2>Explore more trading cards</h2><p>Looking for something else? Browse <Link href="/sports/baseball">baseball</Link>, <Link href="/sports/football">football</Link>, <Link href="/sports/basketball">basketball</Link> or <Link href="/categories">every shelf</Link> in the card shop.</p></section>
 </>;
}
