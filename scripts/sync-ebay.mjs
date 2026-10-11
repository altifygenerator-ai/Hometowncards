#!/usr/bin/env node
/** One-way eBay -> Supabase sync. To run on a server job AFTER OAuth is configured.
 * Safe behavior:
 * - OAuth user token, seller's GetMyeBaySelling active listing pages.
 * - Complete-page consistency guards BEFORE marking missing items unavailable.
 * - Update title/price/stock/photos for active listings.
 * - Preserve existing enrichment (player, sport, team, set) where already known.
 * - Never modify eBay listings; website -> eBay sale coordination remains disabled.
 */
import fs from 'node:fs';
import {XMLParser} from 'fast-xml-parser';
const env=process.env;
const required=['EBAY_CLIENT_ID','EBAY_CLIENT_SECRET','EBAY_REFRESH_TOKEN','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
for(const k of required)if(!env[k]){console.error(`Missing ${k}`);process.exit(1)}
const snapshot=JSON.parse(fs.readFileSync(new URL('../lib/products.json',import.meta.url),'utf8'));
const known=new Map(snapshot.map(p=>[p.id,p]));
const dbKnown=new Map(); // Preserve merchant edits already stored in Supabase.
const teams=[...new Set(snapshot.map(p=>p.team).filter(Boolean))].sort((a,b)=>b.length-a.length);
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',textNodeName:'#text',trimValues:true});
function xmlEscape(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function str(x){return x==null?'':String(typeof x==='object'?(x['#text']??x['@_value']??''):x)}
function list(x){return Array.isArray(x)?x:(x?[x]:[])}
function parsePrice(x){return Math.round(Math.max(0,Number(str(x))||0)*100)}
function guessSport(title,category){const c=category.toLowerCase();for(const sport of ['Baseball','Football','Basketball','Hockey','Golf','Soccer'])if(c.includes(sport.toLowerCase())||new RegExp(`\\b${sport}\\b`,'i').test(title))return sport;return c.includes('trading card')?'Other Cards':'Collectibles'}
function guessTeam(title){return teams.find(t=>new RegExp('(^|[^A-Za-z])'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^A-Za-z])','i').test(title))||''}
function mapItem(x){const id=str(x.ItemID);if(!id)return null;const previous=known.get(id);const saved=dbKnown.get(id);
 const title=str(x.Title)||previous?.title||'';const cat=str(x.PrimaryCategory?.CategoryName)||previous?.category||'';
 const images=list(x.PictureDetails?.PictureURL).map(str).filter(s=>s.startsWith('https://'));const gallery=str(x.PictureDetails?.GalleryURL);
 const price=parsePrice(x.SellingStatus?.CurrentPrice||x.StartPrice);
 const available=str(x.QuantityAvailable);let stock=available?Number(available):NaN;if(!Number.isFinite(stock)||stock<0)stock=Math.max(0,Number(str(x.Quantity)||0)-Number(str(x.SellingStatus?.QuantitySold)||0));
 return {source:'ebay',source_item_id:id,sku:str(x.SKU)||saved?.sku||previous?.sku||id,title,price_cents:price||saved?.price_cents||previous?.price||0,stock,category:cat,
 sport:saved?.sport||previous?.sport||guessSport(title,cat),team:saved?.team||previous?.team||guessTeam(title),player:saved?.player||previous?.player||'',card_year:saved?.card_year||previous?.year||'',card_set:saved?.card_set||previous?.set||'',card_number:saved?.card_number||previous?.number||'',condition:saved?.condition||previous?.condition||'',
 image_url:images[0]||gallery||saved?.image_url||previous?.image||null,back_image_url:images[1]||saved?.back_image_url||previous?.backImage||null,
 ebay_url:`https://www.ebay.com/itm/${id}`,status:stock>0?'published':'sold_out',needs_review:saved?.needs_review??false,last_source_sync:new Date().toISOString(),updated_at:new Date().toISOString()};
}
async function token(){const auth=Buffer.from(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`).toString('base64');const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:env.EBAY_REFRESH_TOKEN,scope:'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.fulfillment'});const r=await fetch('https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body});if(!r.ok)throw new Error('eBay refresh token failed ('+r.status+')');const j=await r.json();return j.access_token}
async function getPage(access,page){const request=`<?xml version="1.0" encoding="utf-8"?><GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents"><DetailLevel>ReturnAll</DetailLevel><ActiveList><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination></ActiveList></GetMyeBaySellingRequest>`;const r=await fetch('https://api.ebay.com/ws/api.dll',{method:'POST',headers:{'Content-Type':'text/xml','X-EBAY-API-CALL-NAME':'GetMyeBaySelling','X-EBAY-API-SITEID':'0','X-EBAY-API-COMPATIBILITY-LEVEL':'1400','X-EBAY-API-IAF-TOKEN':access},body:request});if(!r.ok)throw new Error(`eBay page ${page} HTTP ${r.status}`);const root=parser.parse(await r.text()).GetMyeBaySellingResponse;if(!root||str(root.Ack)==='Failure')throw new Error(`eBay page ${page} failure: ${str(root?.Errors?.LongMessage).slice(0,180)}`);const a=root.ActiveList||{};const total=Number(str(a.PaginationResult?.TotalNumberOfEntries)||0),pages=Number(str(a.PaginationResult?.TotalNumberOfPages)||0);return {items:list(a.ItemArray?.Item).map(mapItem).filter(Boolean),total,pages};}
async function db(method,path,body,extra={}){const r=await fetch(env.SUPABASE_URL+'/rest/v1/'+path,{method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error(`Supabase ${method} ${r.status}: ${(await r.text()).slice(0,200)}`);return r.status===204?null:r.json()}
const sellerRows=await db('GET','sellers?slug=eq.hometown-card-shop&select=id&limit=1');if(sellerRows.length!==1)throw new Error('Founding seller not configured');const sellerId=sellerRows[0].id;
const existing=[];for(let offset=0;offset<15000;offset+=1000){const rows=await db('GET',`products?select=source_item_id,status,sku,price_cents,sport,team,player,card_year,card_set,card_number,condition,image_url,back_image_url,needs_review&seller_id=eq.${sellerId}&source=eq.ebay&offset=${offset}&limit=1000`);existing.push(...rows);for(const row of rows)dbKnown.set(row.source_item_id,row);if(rows.length<1000)break;}
const access=await token();const first=await getPage(access,1);const all=[...first.items];const pages=Math.max(1,first.pages);
if(pages>100||first.total>15000)throw new Error('Listing count outside configured safety limits');
for(let page=2;page<=pages;page++){const next=await getPage(access,page);if(next.total!==first.total||next.pages!==pages)throw new Error('Listings changed mid-sync; abort without writing.');all.push(...next.items)}
const ids=new Set(all.map(x=>x.source_item_id));if(ids.size!==first.total)throw new Error(`Incomplete eBay response: ${ids.size} unique IDs, expected ${first.total}. No database changes made.`);
const oldActive=existing.filter(x=>x.status==='published').length;
if(oldActive>100 && all.length<oldActive*.7)throw new Error('Safety abort: major drop (>30%) from last active inventory, manual review required.');
for(let i=0;i<all.length;i+=100)await db('POST','products?on_conflict=seller_id%2Csource%2Csource_item_id',all.slice(i,i+100).map(x=>({...x,seller_id:sellerId})),{'Prefer':'resolution=merge-duplicates,return=minimal'});
const missing=existing.filter(x=>x.status==='published'&&!ids.has(x.source_item_id)).map(x=>x.source_item_id);
for(const id of missing)await db('PATCH',`products?seller_id=eq.${sellerId}&source=eq.ebay&source_item_id=eq.${encodeURIComponent(id)}`,{stock:0,status:'sold_out',updated_at:new Date().toISOString()},{Prefer:'return=minimal'});
console.log(JSON.stringify({fetched:all.length,updated:all.length,deactivated:missing.length,completed:new Date().toISOString()}));
