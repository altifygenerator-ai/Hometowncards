import 'server-only';
import {db,PortalError} from '@/lib/server/portal';
import {getAccessToken,getConnection,tradingCall,xmlList,xmlText,ebayGetOrders} from '@/lib/server/ebay';
import {ebayItemAspects,ebayListingMetadata} from '@/lib/ebay-product-metadata';

type PageItem=Record<string,unknown>;
type Listing={id:string;categoryId:string;sku:string;title:string;price:number;quantity:number;category:string;image:string;back:string;sport:string;team:string;player:string;year:string;cardSet:string;cardNumber:string};
type Paged={items:Listing[];total:number;pages:number};
type Conn={seller_id:string;listing_page:number;listing_total:number|null;listing_pages:number|null;listing_started_at:string|null;
 last_order_sync_at:string|null;last_listing_sync_at:string|null;sync_mode:string;created_at:string};
const now=()=>new Date().toISOString();
function validHttps(s:string){return /^https:\/\//.test(s)?s:'';}
function mapListing(x:PageItem):Listing|null{
 const id=xmlText(x.ItemID),title=xmlText(x.Title);
 if(!/^\d{9,22}$/.test(id))return null;
 const categoryNode=x.PrimaryCategory as Record<string,unknown>|undefined;
 const categoryId=xmlText(categoryNode?.CategoryID).trim();
 // GetMyeBaySelling omits PrimaryCategory on many eBay accounts. Always send
 // title and listing details; the server-side SQL allowlist classifies items.
 // A missing title is not safe to import or hide automatically.
 if(title.length<2)return null;
 const price=Math.round(Number(xmlText((x.SellingStatus as Record<string,unknown>)?.CurrentPrice||x.StartPrice))*100);
 const availableText=xmlText(x.QuantityAvailable);
 const quantityAvailable=availableText===''?Number.NaN:Number(availableText);
 const quantity=Number.isFinite(quantityAvailable)&&quantityAvailable>=0
  ?quantityAvailable
  :Number(xmlText(x.Quantity)||0)-Number(xmlText((x.SellingStatus as Record<string,unknown>)?.QuantitySold)||0);
 // Allow zero-price unrelated listing records through to the SQL hide filter;
 // only verified cards or sports plates may be inserted, and those require a positive price.
 if(!Number.isInteger(price)||price<0||!Number.isInteger(quantity)||quantity<0)return null;
 const photos=x.PictureDetails as Record<string,unknown>|undefined;
 const images=xmlList(photos?.PictureURL as unknown).map(xmlText).filter(validHttps);
 const category=xmlText((x.PrimaryCategory as Record<string,unknown>)?.CategoryName).slice(0,120);
 const details=ebayListingMetadata(title,ebayItemAspects(x));
 const sport=details.sport||['Baseball','Basketball','Football','Hockey','Soccer','Golf','Racing'].find(s=>
  (title+' '+category).toLowerCase().includes(s.toLowerCase()))||'Other Cards';
 return {id,categoryId,sku:xmlText(x.SKU).slice(0,120),title:title.slice(0,250),price,quantity,category,sport,
  team:details.team,player:details.player,year:details.year,cardSet:details.cardSet,cardNumber:details.cardNumber,
  image:images[0]||validHttps(xmlText(photos?.GalleryURL)),back:images[1]||''};
}
async function getPage(access:string,page:number):Promise<Paged>{
 const root=await tradingCall<Record<string,unknown>>(access,'GetMyeBaySelling',
  '<DetailLevel>ReturnAll</DetailLevel><ActiveList><Include>true</Include>'+
  '<Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>'+page+'</PageNumber></Pagination></ActiveList>');
 const active=root.ActiveList as Record<string,unknown>|undefined;
 const pagination=active?.PaginationResult as Record<string,unknown>|undefined;
 const total=Number(xmlText(pagination?.TotalNumberOfEntries)||0);
 const pages=Number(xmlText(pagination?.TotalNumberOfPages)||0);
 if(!Number.isSafeInteger(total)||total<0||total>25000||!Number.isSafeInteger(pages)||pages<0||pages>125)
  throw new PortalError('eBay returned an unexpected listing count; sync was stopped.',409);
 const entries=(active?.ItemArray as Record<string,unknown>|undefined)?.Item;
 const raw=xmlList(entries as PageItem|PageItem[]|undefined);
 const items=raw.map(mapListing).filter((v):v is Listing=>v!==null);
 if(raw.length!==items.length)throw new PortalError('An eBay listing needs manual review; no partial page was imported.',409);
 return {items,total,pages:Math.max(1,pages)};
}
async function updateConnection(sellerId:string,patch:Record<string,unknown>){
 await db('ebay_connections?seller_id=eq.'+sellerId,{method:'PATCH',
  headers:{Prefer:'return=minimal'},body:JSON.stringify({...patch,updated_at:now()})});
}
async function rpc<T>(name:string,args:Record<string,unknown>){
 return db<T>('rpc/'+name,{method:'POST',body:JSON.stringify(args)});
}
/** Reconcile only eBay orders created AFTER the first account connection.
 * Existing listings' current available quantities already reflect older eBay purchases. */
export async function syncEbayOrders(sellerId:string,access:string,conn:Conn){
 if(!conn.last_order_sync_at)throw new PortalError('Please reconnect eBay to establish a safe initial stock baseline.',409);
 const windowEnd=Date.now(),cutoff=Math.max(Date.parse(conn.last_order_sync_at)-10*60*1000,Date.parse(conn.created_at));
 if(!Number.isFinite(cutoff)||windowEnd-cutoff>13*86400000)
  throw new PortalError('eBay order sync is more than 13 days behind. Review inventory before continuing.',409);
 const orders=await ebayGetOrders(access,Math.max(1,Math.ceil((windowEnd-cutoff)/86400000)+1));
 let applied=0,duplicates=0,conflicts=0,missing=0;
 for(const order of orders){
  const created=Date.parse(String(order.creationDate||''));
  // Don't subtract purchases whose stock was already included in initial inventory.
  if(!Number.isFinite(created)||created<Date.parse(conn.created_at))continue;
  if(order.orderPaymentStatus&&order.orderPaymentStatus!=='PAID')continue;
  for(const line of (Array.isArray(order.lineItems)?order.lineItems:[]) as Record<string,unknown>[]){
   const itemId=String(line.legacyItemId||'');
   const lineId=String(line.lineItemId||'');
   const q=Number(line.quantity);
   if(!/^\d{9,22}$/.test(itemId)||!lineId||!Number.isInteger(q)||q<=0)continue;
   const result=await rpc<string>('hcs_apply_ebay_order_line',{
    p_seller:sellerId,p_ebay_order:String(order.orderId),p_ebay_line:lineId,
    p_listing:itemId,p_quantity:q
   });
   if(result==='applied')applied++;
   else if(result==='duplicate')duplicates++;
   else if(result==='conflict')conflicts++;
   else if(result==='missing')missing++;
  }
 }
 await updateConnection(sellerId,{last_order_sync_at:new Date(windowEnd).toISOString()});
 return {applied,duplicates,conflicts,missing,totalOrders:orders.length};
}
/** One bounded import pass; repeat via dashboard until finished. */
export async function syncEbayListings(sellerId:string,access:string,conn:Conn){
 let page=Math.max(1,conn.listing_page||1),expected=conn.listing_total,starting=conn.listing_started_at;
 let imported=0,review=0,excluded=0,ignored=0,unknown=0,completed=false,processed=0,totalPages=1;
 // Three pages per request (up to 600 items); well within function timeout.
 for(let i=0;i<3;i++){
  const result=await getPage(access,page);totalPages=result.pages;
  if(expected!==null&&expected!==result.total)throw new PortalError('eBay inventory changed during import; start a fresh sync.',409);
  if(!starting)starting=now();
  if(expected===null)expected=result.total;
  if(result.items.length){
   const sums=await rpc<{created:number;updated:number;review:number;excluded:number;ignored:number;unknown:number}>('hcs_reconcile_ebay_cards_page',{
    p_seller:sellerId,p_items:result.items,p_synced_at:now()
   });
   imported+=sums.created+sums.updated;
   review+=sums.review;
   excluded+=sums.excluded;
   ignored+=sums.ignored;
   unknown+=sums.unknown;
   processed+=result.items.length;
  }
  page++;
  await updateConnection(sellerId,{listing_page:page,listing_total:expected,
   listing_pages:result.pages,listing_started_at:starting,last_error:review?'Stock overlaps a website checkout. Review affected cards.':null});
  if(page>result.pages){completed=true;break;}
 }
 if(completed){
  // Absence is not used to delete or hide an existing listing automatically.
  // Sellers can review discontinued eBay items; avoids mass delisting on transient snapshots.
  await updateConnection(sellerId,{listing_page:1,listing_total:null,listing_pages:null,listing_started_at:null,last_listing_sync_at:now()});
 }
 return {imported,review,excluded,ignored,unknown,processed,page:completed?null:page,totalPages,finished:completed};
}
function esc(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
type Outbox={id:string;source_item_id:string;sold_quantity:number;product_id:string};
type Product={id:string;stock:number;status:string;manual_paused:boolean;ebay_sync_excluded:boolean};
async function checkListing(access:string,id:string){
 const root=await tradingCall<Record<string,unknown>>(access,'GetItem',
  '<ItemID>'+esc(id)+'</ItemID><DetailLevel>ReturnAll</DetailLevel>');
 const item=root.Item as Record<string,unknown>|undefined;
 const sold=Number(xmlText((item?.SellingStatus as Record<string,unknown>|undefined)?.QuantitySold)||0);
 const qty=Number(xmlText(item?.Quantity)||0);
 const availableText=xmlText(item?.QuantityAvailable);
 const available=availableText===''?Number.NaN:Number(availableText);
 const remaining=Number.isFinite(available)&&available>=0?available:Math.max(0,qty-sold);
 const status=xmlText((item?.SellingStatus as Record<string,unknown>|undefined)?.ListingStatus);
 if(!Number.isFinite(remaining)||remaining<0||remaining>100000)return {remaining:-1,status};
 return {remaining,status};
}
export async function syncEbayWriteback(sellerId:string,access:string){
 const conn=await getConnection(sellerId);
 if(!conn||conn.sync_mode!=='two_way')return {completed:0,needsReview:0,disabled:true};
 const pending=await db<Outbox[]>('ebay_sale_outbox?select=id,source_item_id,sold_quantity,product_id&seller_id=eq.'+
  sellerId+'&state=in.(pending_connection,pending,needs_review)&order=created_at.asc&limit=15');
 let completed=0,needsReview=0;
 // group sales for same listing: don't revise one item several times
 const groups=new Map<string,Outbox[]>();
 for(const row of pending)groups.set(row.source_item_id,[...(groups.get(row.source_item_id)||[]),row]);
 for(const [listing,rows] of groups){
  try{
   const stockRows=await db<Product[]>('products?select=id,stock,status,manual_paused,ebay_sync_excluded&seller_id=eq.'+
    sellerId+'&source=eq.ebay&source_item_id=eq.'+listing+'&limit=1');
   const p=stockRows[0];if(!p)throw new Error('Linked card no longer exists in inventory');
   if(p.ebay_sync_excluded)throw new Error('Non-card listing: eBay writeback needs manual review.');
   const remote=await checkListing(access,listing);
   if(remote.remaining<0)throw new Error('Could not verify current eBay quantity');
   const totalSold=rows.reduce((a,b)=>a+b.sold_quantity,0);
   // Never increase eBay stock or overwrite a different eBay-side sale/restock.
   // We only revise when the remote-to-local difference EXACTLY equals our queued site sales.
   if(remote.remaining<p.stock)
    throw new Error('eBay inventory is lower than site stock. Reconcile eBay orders before writing back.');
   if(remote.remaining>p.stock&&remote.remaining-p.stock!==totalSold)
    throw new Error('Remote stock changed independently; manual review required to avoid overwriting another sale.');
   if(remote.remaining>p.stock){
    if(p.stock===0){
     if(remote.remaining>totalSold)throw new Error('eBay has additional stock; refusing to end listing blindly');
     await tradingCall(access,'EndFixedPriceItem',
      '<ItemID>'+esc(listing)+'</ItemID><EndingReason>NotAvailable</EndingReason>');
    }else{
     await tradingCall(access,'ReviseInventoryStatus',
      '<InventoryStatus><ItemID>'+esc(listing)+'</ItemID><Quantity>'+p.stock+'</Quantity></InventoryStatus>');
    }
   }
   for(const row of rows)await db('ebay_sale_outbox?id=eq.'+row.id,{method:'PATCH',
    headers:{Prefer:'return=minimal'},body:JSON.stringify({state:'completed',last_error:null,processed_at:now()})});
   completed+=rows.length;
  }catch(err){
   needsReview+=rows.length;
   console.error('eBay writeback needs review',listing,err instanceof Error?err.message:'unknown');
   for(const row of rows)await db('ebay_sale_outbox?id=eq.'+row.id,{method:'PATCH',headers:{Prefer:'return=minimal'},
    body:JSON.stringify({state:'needs_review',last_error:err instanceof Error?err.message.slice(0,400):'eBay update failed'})});
  }
 }
 await updateConnection(sellerId,{last_writeback_at:now()});
 return {completed,needsReview,disabled:false};
}
export async function performEbaySync(sellerId:string){
 const conn=await getConnection(sellerId);
 if(!conn||conn.status!=='connected')throw new PortalError('This seller has not connected eBay.',409);
 const token=await getAccessToken(sellerId);
 // FIRST pull sales to protect against a recent eBay sale, THEN pull listings,
 // FINALLY attempt site sale writebacks when explicitly enabled.
 const orders=await syncEbayOrders(sellerId,token,conn);
 const listings=await syncEbayListings(sellerId,token,conn);
 const writeback=await syncEbayWriteback(sellerId,token);
 return {orders,listings,writeback};
}
