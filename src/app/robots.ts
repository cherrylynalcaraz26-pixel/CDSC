import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/dashboard', '/portal', '/login', '/accounting', '/crm', '/inventory', '/purchase-orders', '/sales-orders', '/warehouse', '/settings', '/users'] },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'}/sitemap.xml`,
  }
}
