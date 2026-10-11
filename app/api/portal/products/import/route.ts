import {NextRequest} from 'next/server';import {authorized,db,failure,json,PortalError} from '@/lib/server/portal';import {parseCsv,uploadHeaders} from '@/lib/server/csv';
const allowed=new Set(uploadHeaders);
export async function POST(req:NextRequest){try{
 const {sellerId,userId}=await authorized(req,'manage');
 const type=req.headers.get('content-type')||'';if(!type.includes('multipart/form-data'))throw new PortalError('Upload a CSV file.');
 const form=await req.formData();const file=form.get('file');const mode=form.get('mode');if(!(file instanceof File))throw new PortalError('Choose a CSV file.');if(file.size>2_500_000)throw new PortalError('Upload up to 2.5MB or split into smaller CSV files.');
 let parsed:string[][];try{parsed=parseCsv(await file.text(),1000)}catch(e){throw new PortalError(e instanceof Error?e.message:'Cannot read CSV.')}if(parsed.length<2)throw new PortalError('CSV has no product rows.');
 const header=parsed[0].map(x=>x.toLowerCase().trim().replace(/_/g,' '));if(!header.includes('sku')||!header.includes('title')||!header.includes('price')||!header.includes('quantity'))throw new PortalError('CSV needs SKU, Title, Price and Quantity columns.');
 const idx=new Map(header.map((x,i)=>[x,i]));const errors:string[]=[];const seen=new Set<string>();const rows:Record<string,unknown>[]=[];
 for(let i=1;i<parsed.length;i++){
  const raw=parsed[i];const get=(s:string)=>(raw[idx.get(s)??-1]||'').trim();const sku=get('sku').slice(0,120);const title=get('title').slice(0,250);const price=Number(get('price').replace(/^\$/,''));const stock=Number(get('quantity'));
  if(!sku||!title||!Number.isFinite(price)||price<=0||price>100000||!Number.isInteger(stock)||stock<0||stock>100000){errors.push(`Row ${i+1}: missing SKU/title or invalid price/quantity`);continue}
  if(seen.has(sku)){errors.push(`Row ${i+1}: duplicate SKU in file`);continue}seen.add(sku);
  const image=get('image url'),back=get('back image url');if([image,back].some(x=>x&&!/^https:\/\//i.test(x))){errors.push(`Row ${i+1}: image URLs must begin with https://`);continue}
  const weight=get('weight oz');if(weight&&(!(Number(weight)>0)||Number(weight)>500)){errors.push(`Row ${i+1}: invalid weight`);continue}
  rows.push({seller_id:sellerId,source:'csv',source_item_id:sku,sku,title,description:get('description').slice(0,4000),price_cents:Math.round(price*100),stock,status:stock?'published':'sold_out',sport:get('sport').slice(0,80)||'Other Cards',team:get('team').slice(0,100),player:get('player').slice(0,120),card_year:get('year').slice(0,4),card_set:get('set').slice(0,120),card_number:get('card number').slice(0,40),condition:get('condition').slice(0,100),category:get('category').slice(0,120),image_url:image||null,back_image_url:back||null,weight_oz:weight?Number(weight):null,inventory_location:get('inventory location').slice(0,100),updated_at:new Date().toISOString()});
 }
 if(mode!=='apply')return json({ok:errors.length===0,mode:'preview',valid:rows.length,errors:errors.slice(0,25),unrecognizedColumns:header.filter(h=>!allowed.has(h)),sample:rows.slice(0,5).map(r=>({sku:r.sku,title:r.title,price_cents:r.price_cents,stock:r.stock}))});
 if(errors.length)throw new PortalError('Import has '+errors.length+' invalid rows. Preview and correct the CSV before importing.');
 if(rows.length>0){for(let i=0;i<rows.length;i+=100){await db('products?on_conflict=seller_id%2Csource%2Csource_item_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows.slice(i,i+100))})}}
 await db('bulk_jobs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({seller_id:sellerId,actor_user_id:userId,operation:'csv_import',status:'completed',rows_received:rows.length,rows_changed:rows.length})});
 return json({ok:true,imported:rows.length});
}catch(err){return failure(err)}}
