import type {MetadataRoute} from 'next';
import {getCatalog} from '@/lib/catalog-db';
const origin='https://www.hometowncardshop.com';
export const revalidate=3600;
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 if(process.env.NEXT_PUBLIC_STORE_LIVE!=='true')return [];
 const pages=['','/shop','/categories','/sports/baseball','/sports/football','/sports/basketball','/about','/help','/shipping','/sellers/hometown-card-shop']
  .map(path=>({url:origin+path,changeFrequency:'weekly' as const,priority:path?0.7:1}));
 const products=await getCatalog();
 return [...pages,...products.filter(p=>p.quantity>0&&p.image).map(p=>({url:origin+'/cards/'+encodeURIComponent(p.id),changeFrequency:'weekly' as const,priority:0.5}))];
}
