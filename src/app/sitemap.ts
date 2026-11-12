import type { MetadataRoute } from 'next'

const routes = ['', '/products', '/industries', '/services', '/about', '/contact', '/quote']

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'
  return routes.map(path => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }))
}
