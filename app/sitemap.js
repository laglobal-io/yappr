import { trendingFeeds, withTimeout } from "@/lib/lists";

// /sitemap.xml: main pages, evergreen topics, and currently trending shows. Refreshed every 6 hours.
export const revalidate = 21600;
const TOPICS = ["AI", "Politics", "Economy", "Climate", "Space", "Crypto", "Startups", "NFL", "NBA", "Soccer", "Movies", "Music", "Mental Health", "Parenting", "Fitness", "True Crime", "History", "Science"];

export default async function sitemap() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://yappr.fm";
  const now = new Date();
  const pages = ["", "/terms", "/privacy", "/submit"].map((p) => ({ url: `${site}${p}`, lastModified: now, changeFrequency: p ? "monthly" : "hourly", priority: p ? 0.3 : 1 }));
  const topics = TOPICS.map((t) => ({ url: `${site}/topic/${encodeURIComponent(t)}`, lastModified: now, changeFrequency: "daily", priority: 0.6 }));
  const shows = ((await withTimeout(trendingFeeds(""), 8000)) || []).map((f) => ({ url: `${site}/show/${f.id}`, lastModified: f.updated ? new Date(f.updated * 1000) : now, changeFrequency: "daily", priority: 0.7 }));
  return [...pages, ...topics, ...shows];
}
