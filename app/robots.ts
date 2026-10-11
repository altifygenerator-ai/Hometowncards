import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{const live=process.env.NEXT_PUBLIC_STORE_LIVE==='true';return {rules:live?{userAgent:'*',allow:'/',disallow:['/admin','/api/']}:{userAgent:'*',disallow:'/'},sitemap:live?`${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`:undefined};}
