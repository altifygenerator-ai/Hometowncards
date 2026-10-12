import type {MetadataRoute} from 'next';
const origin='https://www.hometowncardshop.com';
export default function robots():MetadataRoute.Robots{
 const live=process.env.NEXT_PUBLIC_STORE_LIVE==='true';
 return {
  rules:live?{userAgent:'*',allow:'/',disallow:['/admin/','/api/']}:{userAgent:'*',disallow:'/'},
  ...(live?{sitemap:origin+'/sitemap.xml'}:{})
 };
}
