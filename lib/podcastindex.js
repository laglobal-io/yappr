// Server-only helper for the Podcast Index API (https://podcastindex-org.github.io/docs-api/).
// The key and secret are read from environment variables and never reach the browser.
import crypto from "node:crypto";

const BASE = "https://api.podcastindex.org/api/1.0";

export async function pi(path, params = {}) {
  const key = process.env.PODCASTINDEX_KEY;
  const secret = process.env.PODCASTINDEX_SECRET;
  if (!key || !secret) {
    const err = new Error("Podcast Index keys are missing. Add PODCASTINDEX_KEY and PODCASTINDEX_SECRET to your environment variables.");
    err.status = 500;
    throw err;
  }

  const ts = Math.floor(Date.now() / 1000).toString();
  const auth = crypto.createHash("sha1").update(key + secret + ts).digest("hex");

  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Yappr/1.0",
      "X-Auth-Key": key,
      "X-Auth-Date": ts,
      Authorization: auth,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = new Error(`Podcast Index returned ${res.status}. Check your API keys.`);
    err.status = res.status === 401 ? 500 : 502;
    throw err;
  }
  return res.json();
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };

export function strip(html = "", max = 400) {
  const text = String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === "#") {
        const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

// Browsers block or auto-upgrade http media on https pages, so ask for https up front.
const https = (u) => (u ? String(u).replace(/^http:\/\//i, "https://") : "");

export function feedOut(f = {}) {
  return {
    id: f.id,
    title: strip(f.title, 140) || "Untitled show",
    author: strip(f.author || f.ownerName || "", 120),
    image: https(f.artwork || f.image || ""),
    description: strip(f.description, 700),
    categories: Object.values(f.categories || {}),
    episodeCount: f.episodeCount ?? null,
    language: (f.language || "").split("-")[0].toLowerCase(),
    medium: (f.medium || "podcast").toLowerCase(),
    explicit: !!f.explicit,
    website: https(f.link || ""),
    // Podcast Index names this field differently depending on the endpoint
    updated: f.newestItemPublishTime || f.newestItemPubdate || f.lastUpdateTime || 0,
    funding: f.funding && f.funding.url ? { url: https(f.funding.url), message: strip(f.funding.message, 60) } : null,
  };
}

export function itemOut(i = {}) {
  return {
    id: String(i.id),
    title: strip(i.title, 200) || "Untitled episode",
    description: strip(i.description, 320),
    published: i.datePublished || 0,
    duration: Number(i.duration) || 0,
    audio: https(i.enclosureUrl || ""),
    type: i.enclosureType || "",
    isVideo: /^video\//i.test(i.enclosureType || ""),
    image: https(i.image || i.feedImage || ""),
    season: Number(i.season) || null,
    number: Number(i.episode) || null,
    explicit: !!i.explicit,
    chaptersUrl: https(i.chaptersUrl || ""),
    // Pick the most useful transcript format: timed ones first
    transcript: (() => {
      const list = [...(i.transcripts || []), ...(i.transcriptUrl ? [{ url: i.transcriptUrl, type: "" }] : [])].filter((t) => t && t.url);
      const rank = (t) => ["application/json", "text/vtt", "application/srt", "text/srt", "application/x-subrip", "text/html", "text/plain"].indexOf((t.type || "").toLowerCase());
      list.sort((a, b) => (rank(a) < 0 ? 99 : rank(a)) - (rank(b) < 0 ? 99 : rank(b)));
      return list[0] ? { url: https(list[0].url), type: list[0].type || "" } : null;
    })(),
    people: (i.persons || []).map((p) => ({ name: strip(p.name, 60), role: (p.role || "").toLowerCase() })).filter((p) => p.name).slice(0, 6),
  };
}

export function json(data, maxAgeSeconds) {
  return Response.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=86400`,
    },
  });
}

export function fail(err) {
  return Response.json({ error: err.message || "Something went wrong." }, { status: err.status || 500 });
}

// Show details + latest playable episodes for a Podcast Index feed id.
export async function showWithEpisodes(feed) {
  const episodes = await pi("/episodes/byfeedid", { id: feed.id, max: 60 });
  const items = (episodes.items || [])
    .map(itemOut)
    .filter((e) => e.audio && (!e.type || /^audio\//i.test(e.type) || /^video\/(mp4|webm|x-m4v|quicktime)/i.test(e.type)));
  return { feed: feedOut(feed), episodes: items };
}
