import { pi, feedOut, json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Video podcasts: feeds tagged podcast:medium="video" in the Podcast Index.
// Podcast Index has no video ranking, so we rank this catalog ourselves:
//   fresh  = newest episodes first (Trending)
//   top    = established shows still publishing, most episodes first (Top)
//   rising = newer shows (under 40 episodes) posting recently (Rising)
let cache = { at: 0, feeds: [] };

async function catalog() {
  if (Date.now() - cache.at < 3600 * 1000 && cache.feeds.length) return cache.feeds;
  const data = await pi("/podcasts/bymedium", { medium: "video", max: 1000 });
  cache = { at: Date.now(), feeds: (data.feeds || []).map(feedOut) };
  return cache.feeds;
}

export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    const sort = ["fresh", "top", "rising"].includes(sp.get("sort")) ? sp.get("sort") : "fresh";
    const cats = (sp.get("cat") || "").toLowerCase().split(",").map((c) => c.trim()).filter(Boolean);
    const now = Date.now() / 1000;
    const day = 86400;

    let feeds = (await catalog()).filter((f) => f.updated);
    if (cats.length) feeds = feeds.filter((f) => f.categories.some((c) => cats.includes(c.toLowerCase())));

    if (sort === "fresh") {
      feeds = feeds.filter((f) => now - f.updated < 60 * day).sort((a, b) => b.updated - a.updated);
    } else if (sort === "top") {
      feeds = feeds.filter((f) => now - f.updated < 180 * day).sort((a, b) => (b.episodeCount || 0) - (a.episodeCount || 0));
    } else {
      feeds = feeds.filter((f) => now - f.updated < 30 * day && (f.episodeCount || 0) <= 40).sort((a, b) => b.updated - a.updated);
    }
    const shows = feeds.slice(0, 48).map((f, i) => ({ rank: i + 1, ...f }));
    return json({ feeds: shows, shows }, 1800);
  } catch (err) {
    return fail(err);
  }
}
