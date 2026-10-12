const origin='https://www.hometowncardshop.com';
export const dynamic='force-static';
const paths=['','/shop','/categories','/sports/baseball','/sports/football','/sports/basketball','/about','/help','/shipping','/sellers/hometown-card-shop'];
export function GET(){
 const entries=paths.map(path=>'<url><loc>'+origin+path+'</loc><changefreq>weekly</changefreq><priority>'+(path?'0.7':'1.0')+'</priority></url>').join('');
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries+'</urlset>';
 return new Response(xml,{status:200,headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'}});
}
