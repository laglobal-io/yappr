import { pi, feedOut, itemOut, json, fail } from "@/lib/podcastindex";
import { podcastOk } from "@/lib/quality";
import { findTopics } from "@/lib/topics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/explore?lang=en
// Trending topics come from the newest episodes of the most popular podcasts: a phrase counts when
// several different shows use it. Also returns a news briefing and fresh episodes from popular shows.
const cache = new Map();

async function build(lang) {
  const since = Math.floor(Date.now() / 1000) - 48 * 3600;
  const [trend, news] = await Promise.all([
    pi("/podcasts/trending", { max: 200, lang }),
    pi("/podcasts/trending", { max: 30, lang, cat: "News" }),
  ]);
  const feeds = (trend.feeds || []).map(feedOut).filter(podcastOk);
  const byId = new Map(feeds.map((f, i) => [String(f.id), { ...f, rank: i }]));
  const newsFeeds = (news.feeds || []).map(feedOut).filter(podcastOk);
  newsFeeds.forEach((f) => byId.has(String(f.id)) || byId.set(String(f.id), { ...f, rank: 999 }));

  const ids = [...byId.keys()].slice(0, 200);
  const eps = await pi("/episodes/byfeedid", { id: ids.join(","), since, max: 1000 });
  const items = (eps.items || []).map((i) => ({ ...itemOut(i), feedId: String(i.feedId) })).filter((e) => e.audio && byId.has(e.feedId));

  const topics = findTopics(items.map((e) => ({ title: e.title, feedId: e.feedId, published: e.published })));

  const newest = (list, max) => {
    const seen = new Set();
    return list.filter((e) => (seen.has(e.feedId) ? false : seen.add(e.feedId))).slice(0, max)
      .map((e) => ({ show: byId.get(e.feedId), ep: e }));
  };
  const sorted = [...items].sort((a, b) => b.published - a.published);
  const newsIds = new Set(newsFeeds.map((f) => String(f.id)));
  return {
    topics,
    news: newest(sorted.filter((e) => newsIds.has(e.feedId) && Date.now() / 1000 - e.published < 36 * 3600), 12),
    fresh: newest([...sorted].sort((a, b) => byId.get(a.feedId).rank - byId.get(b.feedId).rank || b.published - a.published).filter((e) => !newsIds.has(e.feedId)), 16),
    updated: Date.now(),
  };
}

export async function GET(request) {
  try {
    const raw = (new URL(request.url).searchParams.get("lang") || "en").toLowerCase();
    const lang = /^[a-z]{2}$/.test(raw) ? raw : "en";
    const hit = cache.get(lang);
    if (hit && Date.now() - hit.updated < 20 * 60 * 1000) return json(hit, 1200);
    const data = await build(lang);
    cache.set(lang, data);
    return json(data, 1200);
  } catch (err) {
    return fail(err);
  }
}
