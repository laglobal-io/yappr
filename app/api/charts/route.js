import { json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/charts?country=us  → Apple Podcasts top 50 for that country (public feed, no key needed).
// Rank is the position in the list. Tapping a show looks it up in Podcast Index by Apple ID.
export async function GET(request) {
  try {
    const raw = (new URL(request.url).searchParams.get("country") || "us").toLowerCase();
    const country = /^[a-z]{2}$/.test(raw) ? raw : "us";
    const res = await fetch(`https://rss.marketingtools.apple.com/api/v2/${country}/podcasts/top/50/podcasts.json`, {
      cache: "no-store",
      headers: { "User-Agent": "Yappr/1.0" },
    });
    if (!res.ok) {
      const err = new Error(res.status === 404 ? "Charts aren't available for that country." : `The charts service returned ${res.status}. Try again in a bit.`);
      err.status = 502;
      throw err;
    }
    const data = await res.json();
    const shows = ((data.feed && data.feed.results) || []).map((r, i) => ({
      rank: i + 1,
      itunesId: String(r.id),
      title: r.name || "Untitled show",
      author: r.artistName || "",
      image: (r.artworkUrl100 || "").replace(/\/\d+x\d+bb\./, "/600x600bb."),
    }));
    return json({ country, shows }, 3600);
  } catch (err) {
    return fail(err);
  }
}
