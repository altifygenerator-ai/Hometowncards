import Link from 'next/link';
import type {Metadata} from 'next';
import {searchProducts,sportsFor,getTeamOptions} from '@/lib/catalog';
import type {SearchFilters} from '@/lib/catalog';
import {getCatalog} from '@/lib/catalog-db';import {ProductCard} from '@/components/product-card';import {Icon} from '@/components/icons';
export const metadata:Metadata={title:'Sports Cards & Collectibles Marketplace',description:'Shop Hometown Card Shop cards and listings from approved independent sellers. Filter trading cards by sport, team, year, shop and price.',alternates:{canonical:'/shop'}};
type Props={searchParams:Promise<{[key:string]:string|string[]|undefined}>};
function first(p:string|string[]|undefined){return typeof p==='string'?p:''}
export default async function Shop({searchParams}:Props){const p=await searchParams;const filters:SearchFilters={search:first(p.search),sport:first(p.sport),team:first(p.team),year:first(p.year),sort:first(p.sort),page:first(p.page),seller:first(p.seller)};
 const catalog=await getCatalog();const sports=sportsFor(catalog);const {items,total,page,pages}=searchProducts(filters,catalog);
 const selectedSport=filters.sport||'All';
 const teams=getTeamOptions(selectedSport,catalog);const sellers=[...new Set(catalog.map(x=>x.sellerSlug))];
 function pageHref(n:number){const out=new URLSearchParams();for(const [k,v] of Object.entries(filters)){if(v && k!=='page')out.set(k,v)}out.set('page',String(n));return '/shop?'+out.toString();}
 return <><div className="shop-intro"><div className="shell"><span className="kicker">FLIP THROUGH THE BOXES</span><h1>What'll you find today?</h1><p>Browse our own cards and collections from approved independent sellers. Filter by sport, player, year, price, or shop. Each seller sets their own shipping and return policies.</p></div></div>
 <div className="shell breadcrumbs"><Link href="/">Home</Link> / <span>Browse the card boxes</span></div>
 <div className="shell shop-layout"><aside className="shop-sidebar"><div className="filter-label"><Icon name="filter" size={19}/> FILTER YOUR SEARCH</div><form action="/shop" className="filter-form">
  <label htmlFor="q">Player, set, or keyword</label><input id="q" type="search" name="search" defaultValue={filters.search||''} placeholder="e.g. Nolan Ryan, 1992..."/>
  <label htmlFor="sport">Sport / Category</label><select name="sport" id="sport" defaultValue={selectedSport}><option value="All">Everything</option>{sports.map(s=><option key={s.name} value={s.name}>{s.name} ({s.count.toLocaleString('en-US')})</option>)}</select>
  <label htmlFor="team">Team</label><select name="team" id="team" defaultValue={teams.some(x=>x.name===filters.team)?filters.team:''}><option value="">All teams</option>{teams.map(t=><option key={t.name} value={t.name}>{t.name} ({t.count})</option>)}</select>
  {sellers.length>1?<><label htmlFor="seller">Shop / Seller</label><select id="seller" name="seller" defaultValue={filters.seller||''}><option value="">Every seller</option>{sellers.map(id=><option value={id} key={id}>{catalog.find(x=>x.sellerSlug===id)?.sellerName||id}</option>)}</select></>:null}<label htmlFor="year">Card year</label><input name="year" id="year" inputMode="numeric" pattern="[0-9]{4}" placeholder="Any year" defaultValue={filters.year||''}/>
  <label htmlFor="sort">Sort by</label><select name="sort" id="sort" defaultValue={filters.sort||'newest'}><option value="newest">Newly listed</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="title">Name: A to Z</option><option value="year">Newest card year</option></select>
  <button className="button button-primary filter-apply" type="submit">Show matches <Icon name="arrow" size={17}/></button><Link className="clear-filter" href="/shop">Clear all filters</Link><Link className="clear-filter" href="/categories">See all categories</Link>
 </form><div className="filter-aside-note"><strong>Can't find that old favorite?</strong><p>Try a player name or card set. Not every card has a team assigned yet, but you can still search its full title.</p></div></aside>
 <div className="shop-results"><div className="results-top"><div><strong>{total.toLocaleString('en-US')} {total===1?'item':'items'}</strong><span>{selectedSport==='All'?'From the full collection':selectedSport}</span></div><span>Page {page} of {Math.max(1,pages)}</span></div>
 {items.length?<div className="product-grid">{items.map(item=><ProductCard key={item.id} product={item}/>)}</div>:<div className="empty-results"><h2>Nothing in that box yet.</h2><p>Try fewer filters or a broader player name. We have a lot of cards to go through.</p><Link href="/shop" className="button button-outline">Browse everything <Icon name="arrow" size={17}/></Link></div>}
 {pages>1?<nav className="pagination" aria-label="Shop pages">{page>1?<Link href={pageHref(page-1)}>← Previous</Link>:<span className="page-disabled">← Previous</span>}<span>{page.toLocaleString('en-US')} / {pages.toLocaleString('en-US')}</span>{page<pages?<Link href={pageHref(page+1)}>Next →</Link>:<span className="page-disabled">Next →</span>}</nav>:null}
 </div></div></>;
}
