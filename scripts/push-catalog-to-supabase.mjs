#!/usr/bin/env node
/** Snapshot seeder for marketplace schema v2. Safe upsert per (seller, source, source_item_id).
 * Only against a dedicated DB AFTER applying supabase/schema.sql. Never turns on payments.
 */
import fs from 'node:fs';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');process.exit(1)}
const root=`${url}/rest/v1/`;const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
async function fetchDb(path,options={}){const res=await fetch(root+path,{...options,headers:{...headers,...options.headers}});if(!res.ok)throw new Error(`${path}: ${res.status} ${(await res.text()).slice(0,400)}`);return res.status===204?null:res.json()}
const sellers=await fetchDb('sellers?slug=eq.hometown-card-shop&select=id&limit=1');
if(sellers.length!==1)throw new Error('Founding seller not configured; apply marketplace schema first.');
const sellerId=sellers[0].id;
const src=JSON.parse(fs.readFileSync(new URL('../lib/products.json',import.meta.url),'utf8'));
const rows=src.map(p=>({seller_id:sellerId,source:'ebay',source_item_id:p.id,sku:p.sku,title:p.title,price_cents:p.price,stock:p.quantity,status:p.quantity?'published':'sold_out',sport:p.sport,team:p.team,player:p.player,card_year:p.year,card_set:p.set,card_number:p.number,category:p.category,condition:p.condition,image_url:p.image||null,back_image_url:p.backImage||null,ebay_url:p.ebayUrl,needs_review:false}));
for(let i=0;i<rows.length;i+=100){await fetchDb('products?on_conflict=seller_id%2Csource%2Csource_item_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows.slice(i,i+100))});console.log('Seeded',Math.min(i+100,rows.length),'/',rows.length)}
console.log('Seed complete; NOT LIVE. Complete seller eBay authorization, checkout reservations and stock reconciliation first.');
