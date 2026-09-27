import { pi, feedOut, json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Video podcasts = feeds tagged podcast:medium="video" in the Podcast Index.
//
// Podcast Index has no video ranking of its own, and its video catalog comes back unranked (max 1,000 shows).
// Its only popularity signal is the trend score on /podcasts/trending, so we rank by crossing the two:
//   top    = video shows in the trending list, by trend score
//   rising = video shows in the trending list for the last 3 days, by trend score
//   fresh  = video shows by newest episode (not a popularity ranking, labelled "New to watch")
// Genre filters use the trending list's own category filter, which is reliable.
// If too few video shows are trending (common for small genres), we say so and show the most active ones instead.

const HOUR = 3600 * 1000;
const cache = new Map();
async function cached(key, ttl, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const catalog = () => cached("catalog", HOUR, async () => {
  const d = await pi("/podcasts/bymedium", { medium: "video", max: 1000 });
  return new Map((d.feeds || []).map((f) => [String(f.id), feedOut(f)]));
});

const trending = (cat, since) => cached(`trend:${cat}:${since ? "3d" : "all"}`, 15 * 60 * 1000, async () => {
  const d = await pi("/podcasts/trending", {
    max: 1000,
    cat,
    since: since ? Math.floor(Date.now() / 1000) - 3 * 86400 : undefined,
  });
  return (d.feeds || []).map((f) => ({ ...feedOut(f), trendScore: f.trendScore || 0 }));
});

const MIN_RANKED = 3;

// Combine a trending entry with the catalog entry: keep whichever side actually has each detail
function merge(trend, video) {
  const out = { ...trend };
  for (const [k, v] of Object.entries(video || {})) {
    const empty = v == null || v === "" || v === 0 || (Array.isArray(v) && !v.length);
    const mine = out[k];
    const mineEmpty = mine == null || mine === "" || mine === 0 || (Array.isArray(mine) && !mine.length);
    if (!empty && (mineEmpty || k === "title" || k === "image" || k === "updated" || k === "episodeCount")) out[k] = v;
  }
  out.medium = "video";
  return out;
}
const day = 86400;

export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    const sort = ["fresh", "top", "rising"].includes(sp.get("sort")) ? sp.get("sort") : "fresh";
    const cat = (sp.get("cat") || "").replace(/[^A-Za-z &,-]/g, "").slice(0, 80);
    const now = Date.now() / 1000;
    const videos = await catalog();

    // Most recently active video shows (optionally within a genre)
    const active = async (withinDays) => {
      let list = [...videos.values()].filter((f) => f.updated && now - f.updated < withinDays * day);
      if (cat) {
        const inGenre = new Set((await trending(cat, false)).map((f) => String(f.id)));
        const wanted = cat.toLowerCase().split(",");
        list = list.filter((f) => inGenre.has(String(f.id)) || f.categories.some((c) => wanted.includes(c.toLowerCase())));
      }
      return list.sort((a, b) => b.updated - a.updated);
    };

    let shows;
    let basis = "trending";
    let note = null;
    if (sort === "fresh") {
      shows = await active(60);
      basis = "recency";
    } else {
      const trend = await trending(cat, sort === "rising");
      // Keep trending order (it's already sorted by trend score); take richer details from the catalog when we have them
      shows = trend
        .filter((f) => videos.has(String(f.id)))
        .map((f) => merge(f, videos.get(String(f.id))));
      if (shows.length < MIN_RANKED) {
        shows = await active(sort === "rising" ? 30 : 90);
        basis = "activity";
        note = "Not enough video shows are trending here to rank yet, so these are the most active ones.";
      }
    }
    const out = shows.slice(0, 48).map((f, i) => ({ ...f, rank: i + 1 }));
    return json({ feeds: out, shows: out, basis, note }, 1800);
  } catch (err) {
    return fail(err);
  }
}
