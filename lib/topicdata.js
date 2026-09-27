import { pi, feedOut, itemOut } from "./podcastindex";
import { podcastOk, podcastScore, dedupeShows } from "./quality";
import { findTopics } from "./topics";
import { stations } from "./radio";

// Everything about a topic: episodes that mention it (Podcast Index searches episode titles and
// descriptions), shows about it, live stations, and related topics.
export async function topicData(qIn, langIn = "en", countryIn = "") {
  const q = String(qIn || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const lang = String(langIn || "en").toLowerCase().slice(0, 2);
  const country = String(countryIn || "").toLowerCase().slice(0, 2);
  if (q.length < 2) { const e = new Error("Pick a topic to explore."); e.status = 400; throw e; }
  const now = Date.now() / 1000;

  const [epRes, showRes] = await Promise.all([
    pi("/search/byperson", { q, max: 200 }).catch(() => ({ items: [] })),
    pi("/search/byterm", { q, max: 40 }).catch(() => ({ feeds: [] })),
  ]);

  // Recent episodes, newest first, at most two per show, only real audio with artwork
  const perShow = new Map();
  const needle = q.toLowerCase();
  const episodes = (epRes.items || [])
    .filter((i) => i.enclosureUrl && (i.feedImage || i.image) && now - (i.datePublished || 0) < 45 * 86400)
    .filter((i) => !lang || !i.feedLanguage || String(i.feedLanguage).toLowerCase().startsWith(lang))
    .filter((i) => `${i.title} ${i.description || ""}`.toLowerCase().includes(needle))
    .sort((a, b) => b.datePublished - a.datePublished)
    .filter((i) => { const n = perShow.get(i.feedId) || 0; perShow.set(i.feedId, n + 1); return n < 2; })
    .slice(0, 40)
    .map((i) => ({
      show: { id: i.feedId, title: i.feedTitle || "Podcast", author: i.feedAuthor || "", image: (i.feedImage || "").replace(/^http:\/\//, "https://"), categories: [] },
      ep: itemOut(i),
    }))
    .filter((x) => x.ep.audio);

  const shows = dedupeShows((showRes.feeds || []).map(feedOut).filter(podcastOk))
    .sort((a, b) => podcastScore(b, now) - podcastScore(a, now)).slice(0, 18);

  // Stations: ones tagged or named after the topic; otherwise live news and talk in your country
  let live = await stations({ country, tags: [needle], order: "trending" }).catch(() => []);
  let liveTitle = `${q} stations`;
  if (live.length < 3) {
    live = await stations({ country, tags: ["news", "talk"], order: "trending" }).catch(() => []);
    liveTitle = "Live news and talk";
  }

  const related = findTopics(episodes.map((x) => ({ title: x.ep.title, feedId: x.show.id, published: x.ep.published })), { minShows: 2 })
    .map((t) => t.topic).filter((t) => t.toLowerCase() !== needle && !needle.includes(t.toLowerCase())).slice(0, 10);

  return { topic: q, episodes, shows, live: live.slice(0, 12), liveTitle, related, showCount: perShow.size };
}
