import {NextRequest,NextResponse} from 'next/server';import {authorized,db,failure} from '@/lib/server/portal';import {toCsv,uploadHeaders} from '@/lib/server/csv';
export async function GET(req:NextRequest){try{
 const {sellerId}=await authorized(req);const rows:Record<string,unknown>[]=[];
 for(let offset=0;offset<30000;offset+=1000){const part=await db<Record<string,unknown>[]>(`products?select=sku,title,description,price_cents,price_override_cents,stock,sport,team,player,card_year,card_set,card_number,condition,category,image_url,back_image_url,weight_oz,inventory_location&seller_id=eq.${sellerId}&order=created_at.asc&offset=${offset}&limit=1000`);rows.push(...part);if(part.length<1000)break}
 const columns=rows.map(p=>[p.sku,p.title,p.description,(Number(p.price_override_cents??p.price_cents)/100).toFixed(2),p.stock,p.sport,p.team,p.player,p.card_year,p.card_set,p.card_number,p.condition,p.category,p.image_url,p.back_image_url,p.weight_oz,p.inventory_location]);
 return new NextResponse(toCsv(uploadHeaders,columns as (string|number|null|undefined)[][]),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="hometown-card-shop-inventory.csv"','Cache-Control':'no-store'}});
}catch(e){return failure(e)}}
