import { pi, feedOut } from "./podcastindex";
import { podcastOk, dedupeShows } from "./quality";

// Trending podcasts (Podcast Index), quality-filtered
export async function trendingFeeds(cat = "") {
  const data = await pi("/podcasts/trending", { max: 60, lang: "en", cat });
  return dedupeShows((data.feeds || []).map(feedOut).filter(podcastOk)).slice(0, 40);
}

// Shows gaining momentum fastest over the last few days, in a language
export async function risingShows(langIn = "en", catIn = "") {
  const lang = /^[a-z]{2}$/.test(String(langIn).toLowerCase()) ? String(langIn).toLowerCase() : "en";
  const cat = String(catIn || "").replace(/[^A-Za-z &,-]/g, "").slice(0, 80);
  const since = Math.floor(Date.now() / 1000) - 3 * 86400;
  const data = await pi("/podcasts/trending", { max: 50, lang, since, cat });
  return dedupeShows((data.feeds || []).map(feedOut).filter(podcastOk)).map((f, i) => ({ ...f, rank: i + 1 }));
}

// Resolve to null instead of making a page wait on a slow service
export const withTimeout = (p, ms = 2500) => Promise.race([p.catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);
