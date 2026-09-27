import { pi, feedOut, json, fail } from "@/lib/podcastindex";
import { podcastOk, podcastScore, dedupeShows } from "@/lib/quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/search?q=history&country=us
// Two sources, merged:
//   1. Apple's podcast search, whose order reflects popularity (so "the daily" finds The Daily first)
//   2. Podcast Index, the open catalog of every public podcast feed (millions of shows)
// Apple hits are matched to Podcast Index (which is what we play from); the rest are ranked by quality.
async function apple(q, country) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 3500);
    const res = await fetch(`https://itunes.apple.com/search?media=podcast&entity=podcast&limit=25&country=${country}&term=${encodeURIComponent(q)}`, { signal: ac.signal, cache: "no-store" });
    clearTimeout(t);
    if (!res.ok) return [];
    const d = await res.json();
    return (d.results || []).map((r) => String(r.collectionId)).filter(Boolean);
  } catch {
    return [];
  }
}

export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const rawCountry = (sp.get("country") || "us").toLowerCase();
    const country = /^[a-z]{2}$/.test(rawCountry) ? rawCountry : "us";
    if (q.length < 2) return json({ feeds: [] }, 60);

    const [appleIds, idx] = await Promise.all([apple(q, country), pi("/search/byterm", { q, max: 60, similar: "" }).catch(() => ({ feeds: [] }))]);
    const found = (idx.feeds || []).map((f) => ({ ...feedOut(f), itunesId: f.itunesId ? String(f.itunesId) : "", dead: f.dead === 1 }));
    const byItunes = new Map(found.filter((f) => f.itunesId).map((f) => [f.itunesId, f]));

    // Popular Apple hits that the text search missed: look them up directly (a few, in parallel)
    const missing = appleIds.filter((id) => !byItunes.has(id)).slice(0, 8);
    const extra = await Promise.all(missing.map((id) => pi("/podcasts/byitunesid", { id }).then((d) => (d.feed && d.feed.id ? { ...feedOut(d.feed), itunesId: id, dead: d.feed.dead === 1 } : null)).catch(() => null)));
    extra.filter(Boolean).forEach((f) => byItunes.set(f.itunesId, f));

    const ranked = appleIds.map((id) => byItunes.get(id)).filter(Boolean);
    const rankedIds = new Set(ranked.map((f) => String(f.id)));
    const now = Date.now() / 1000;
    const rest = found.filter((f) => !rankedIds.has(String(f.id))).sort((a, b) => podcastScore(b, now) - podcastScore(a, now));

    const feeds = dedupeShows([...ranked, ...rest].filter(podcastOk)).slice(0, 40);
    return json({ feeds }, 600);
  } catch (err) {
    return fail(err);
  }
}
