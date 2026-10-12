import Link from 'next/link';import {getCatalog} from '@/lib/catalog-db';
export const metadata={title:'Shops at Hometown Card Shop',robots:{index:false,follow:true}};
export default async function Sellers(){const items=await getCatalog();const shops=new Map<string,{slug:string,name:string,count:number}>();for(const p of items){const prev=shops.get(p.sellerSlug);shops.set(p.sellerSlug,{slug:p.sellerSlug,name:p.sellerName,count:(prev?.count||0)+1});}
return <><section className="inner-hero"><div className="shell"><span className="kicker">THE PEOPLE BEHIND THE COUNTER</span><h1>Our shops.</h1><p>A closer look at the cards available from the shop.</p></div></section><section className="shell seller-list">{[...shops.values()].map(x=><Link key={x.slug} href={'/sellers/'+x.slug} className="seller-list-card"><span className="seller-initial">H</span><div><strong>{x.name}</strong><p>{x.count.toLocaleString('en-US')} individual listings · Browse this seller's collection</p></div><span>Visit the shop →</span></Link>)}</section></>

}
