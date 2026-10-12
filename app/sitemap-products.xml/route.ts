import {getCatalog} from '@/lib/catalog-db';
const origin='https://www.hometowncardshop.com';
export const revalidate=900;
export async function GET(){
 try {
  const cards=await getCatalog();
  const seen=new Set<string>();
  const entries:string[]=[];
  for(const card of cards){
   if(card.quantity<=0||!card.image||!card.id)continue;
   const url=origin+'/cards/'+encodeURIComponent(card.id);
   if(seen.has(url))continue;
   seen.add(url);
   entries.push('<url><loc>'+url+'</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>');
  }
  const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.join('')+'</urlset>';
  return new Response(xml,{status:200,headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, s-maxage=900, stale-while-revalidate=3600'}});
 }catch(err){
  console.error('Product sitemap temporarily unavailable',err instanceof Error?err.message:'Inventory lookup failed');
  return new Response('Product sitemap temporarily unavailable',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Retry-After':'300'}});
 }
}
