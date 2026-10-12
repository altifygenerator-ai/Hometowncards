import type { MetadataRoute } from 'next';
import { getCatalog } from '@/lib/catalog-db';

const baseUrl = 'https://www.hometowncardshop.com';
const contentUpdated = new Date('2026-10-11T00:00:00-05:00');
export const revalidate = 900;

const routes = [
  { path: '/', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/shop', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/categories', priority: 0.85, changeFrequency: 'weekly' as const },
  { path: '/sports/baseball', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/sports/football', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/sports/basketball', priority: 0.9, changeFrequency: 'weekly' as const },
  { path: '/about', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/help', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/shipping', priority: 0.6, changeFrequency: 'monthly' as const },
  { path: '/sellers/hometown-card-shop', priority: 0.65, changeFrequency: 'weekly' as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = routes.map((route) => ({
    url: baseUrl + route.path,
    lastModified: contentUpdated,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Follow the same Next.js MetadataRoute pattern as the tourism sites.
  // Inventory is best-effort: a database outage cannot break the core sitemap.
  try {
    const products = await getCatalog();
    const seen = new Set<string>();
    const productRoutes: MetadataRoute.Sitemap = [];
    for (const product of products) {
      if (!product.id || !product.image || product.quantity <= 0) continue;
      const url = baseUrl + '/cards/' + encodeURIComponent(product.id);
      if (seen.has(url)) continue;
      seen.add(url);
      productRoutes.push({
        url,
        changeFrequency: 'weekly',
        priority: 0.5,
      });
    }
    return [...staticRoutes, ...productRoutes];
  } catch (error) {
    console.error('Sitemap catalog lookup failed; serving core URLs:', error instanceof Error ? error.message : 'unknown error');
    return staticRoutes;
  }
}
