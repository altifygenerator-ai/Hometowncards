const origin='https://www.hometowncardshop.com';
export const dynamic='force-static';
export function GET(){
 const feeds=['/sitemap-pages.xml','/sitemap-products.xml'];
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+feeds.map(path=>'<sitemap><loc>'+origin+path+'</loc></sitemap>').join('')+'</sitemapindex>';
 return new Response(xml,{status:200,headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'}});
}
