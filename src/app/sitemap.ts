import type { MetadataRoute } from 'next'

const routes = ['', '/about', '/products', '/industries', '/services', '/company-profile', '/contact', '/quote']

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'
  return routes.map(path => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }))
}
