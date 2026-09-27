import { pi, feedOut } from "./podcastindex";
import { podcastOk, podcastScore, dedupeShows } from "./quality";

// Podcast search from two sources, merged:
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

export async function searchShows(qIn, countryIn = "us") {
  const q = String(qIn || "").trim().slice(0, 100);
  const country = /^[a-z]{2}$/.test(String(countryIn).toLowerCase()) ? String(countryIn).toLowerCase() : "us";
  if (q.length < 2) return [];
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
  return feeds;
}
