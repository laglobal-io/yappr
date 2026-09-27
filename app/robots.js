// /robots.txt: let search engines in, keep them out of API routes
export default function robots() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://yappr.fm";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }], sitemap: `${site}/sitemap.xml` };
}
