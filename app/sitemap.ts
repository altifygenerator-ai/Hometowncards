import type {MetadataRoute} from 'next';import {getCatalog} from '@/lib/catalog-db';
const base=process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000';
export default async function sitemap():Promise<MetadataRoute.Sitemap> {if(process.env.NEXT_PUBLIC_STORE_LIVE!=='true')return [];
 const pages=['','/shop','/categories','/about','/help','/shipping'].map(path=>({url:base+path,changeFrequency:'weekly' as const,priority:path?0.6:1}));
 return [...pages,...(await getCatalog()).filter(p=>p.image).map(p=>({url:base+'/cards/'+p.id,changeFrequency:'weekly' as const,priority:0.5}))];}
