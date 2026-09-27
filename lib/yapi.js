// yapi: yappr's AI listening assistant.
// It runs on a leading AI model (Anthropic's Claude, via API) with yappr's own instructions and tools.
// yapi can only recommend things it found with the tools below, so it can't invent shows or episodes.
import { pi, showWithEpisodes } from "./podcastindex";
import { searchShows } from "./search";
import { topCharts } from "./charts";
import { getExplore } from "./explore";
import { topicData } from "./topicdata";
import { stations } from "./radio";
import { somaChannels } from "./somafm";

const MODEL = process.env.YAPI_MODEL || "claude-sonnet-5";
const API = "https://api.anthropic.com/v1/messages";
const MAX_ROUNDS = 6;

const APPLE_GENRES = { comedy: "Comedy", "true crime": "True Crime", technology: "Technology", tech: "Technology", culture: "Society & Culture", health: "Health & Fitness", sports: "Sports", history: "History", business: "Business", science: "Science", news: "News", fiction: "Fiction", education: "Education", arts: "Arts", kids: "Kids & Family", "tv & film": "TV & Film", music: "Music", religion: "Religion & Spirituality", leisure: "Leisure" };

function systemPrompt({ country, lang, today }) {
  return `You are yapi, the AI listening assistant inside yappr, a free app for podcasts, video podcasts and live radio. You help people find something great to listen to, and tell them what's happening in podcasting.

How you work:
- Always use your tools to find real shows, episodes, stations, topics and community posts. Never recommend anything you didn't get from a tool, and never invent titles, hosts, guests, dates or what an episode says.
- When you have good picks, call show_results with the best 3 to 8 items in the order you recommend them. Mix types when it helps (an episode plus the show, a station plus a related podcast). Use ids exactly as the tools returned them.
- Then reply in one to three short sentences: warm, plain, specific about why these fit. The cards appear under your reply, so don't list every title again. No markdown, headers or bullet points.
- If the person gives a situation (a commute, a workout, falling asleep, a road trip with kids), use episode length and tone to match it.
- For news, use trending and find_episodes for recent episodes. Say these are podcast episodes about the story; you can't verify the news yourself.
- For "what are people saying", use community_posts and pick posts that actually discuss it.
- If nothing good turns up, say so honestly and suggest another angle. Don't pad with weak picks.
- Stay on listening, podcasts, radio and audio. If asked something unrelated, say briefly that you're here to help find things to listen to, and offer something related when you can.
- Don't give medical, legal or financial advice; you can point to shows on those subjects.
- Don't reproduce song lyrics or long quotes from anything.
- You're yapi, yappr's assistant. If asked what powers you, say you're built on a leading AI model; don't claim yappr trained you from scratch, and don't pretend to be a person.
- Reply in the same language the person writes in.

Context: today is ${today}. The listener's country is ${country.toUpperCase()} and their language is ${lang}.`;
}

const TOOLS = [
  { name: "search_shows", description: "Search podcasts by name, host, topic or genre. Returns shows ranked by popularity and quality.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "find_episodes", description: "Find recent podcast episodes (last few weeks) that mention a topic, person, event or phrase, newest first.", input_schema: { type: "object", properties: { topic: { type: "string" } }, required: ["topic"] } },
  { name: "show_episodes", description: "Get the latest episodes of one show, to recommend specific episodes. Use a show id from search_shows (starting with pi:).", input_schema: { type: "object", properties: { show_id: { type: "string" } }, required: ["show_id"] } },
  { name: "top_charts", description: "The most popular podcasts in the listener's country right now (Apple Podcasts charts), optionally for one genre.", input_schema: { type: "object", properties: { genre: { type: "string", description: "Optional: comedy, true crime, technology, culture, health, sports, history, business, science, news, fiction, education, arts, kids, music" } } } },
  { name: "trending", description: "What podcasts are talking about right now: trending topics, today's news episodes, and fresh episodes from popular shows.", input_schema: { type: "object", properties: {} } },
  { name: "search_stations", description: "Find live radio stations by name, genre or city (e.g. 'jazz', 'NPR', 'sports talk', 'Chicago'). Includes commercial-free SomaFM channels.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "community_posts", description: "What yappr listeners are posting about a show, episode or topic, ranked by votes.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  {
    name: "show_results",
    description: "Choose which items appear as playable cards under your reply, in the order you recommend them. Call this once, before your final reply.",
    input_schema: {
      type: "object",
      properties: {
        episodes: { type: "array", items: { type: "string" } },
        shows: { type: "array", items: { type: "string" } },
        stations: { type: "array", items: { type: "string" } },
        topics: { type: "array", items: { type: "string" } },
        posts: { type: "array", items: { type: "string" } },
      },
    },
    cache_control: { type: "ephemeral" },
  },
];

const day = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : "");
const mins = (s) => (s ? Math.round(s / 60) : null);
const clip = (s, n) => (s ? String(s).slice(0, n) : "");

// Everything the tools return is also kept here, so the cards the model picks can be shown in full
function registry() {
  const r = { shows: new Map(), episodes: new Map(), stations: new Map(), posts: new Map(), topics: new Set() };
  r.show = (f) => {
    const id = f.itunesId && !f.id ? `it:${f.itunesId}` : `pi:${f.id}`;
    r.shows.set(id, f);
    return { id, title: f.title, author: f.author || "", episodes: f.episodeCount || undefined, updated: day(f.updated) || undefined, about: clip(f.description, 160) || undefined, video: f.medium === "video" || undefined, rank: f.rank || undefined };
  };
  r.episode = (show, ep) => {
    r.episodes.set(String(ep.id), { show, ep });
    return { id: String(ep.id), title: ep.title, show: show.title, published: day(ep.published), minutes: mins(ep.duration), video: ep.isVideo || undefined, about: clip(ep.description, 160) || undefined };
  };
  r.station = (st) => {
    r.stations.set(String(st.id), st);
    return { id: String(st.id), name: st.name, where: st.state || st.country || "", genres: (st.tags || []).join(", "), network: st.network || undefined };
  };
  r.post = (p) => {
    r.posts.set(`post:${p.id}`, p);
    const a = p.author || {};
    return { id: `post:${p.id}`, by: `@${a.handle}${a.verified ? ` (verified ${a.verified})` : ""}`, text: clip(p.body, 220), score: p.up_count - p.down_count, likes: p.like_count, about: p.attachment && p.attachment.ep ? p.attachment.ep.title : undefined };
  };
  return r;
}

async function communityPosts(query) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const q = String(query).replace(/[%*,()]/g, " ").trim().slice(0, 60);
  if (!q) return [];
  const select = "id,body,up_count,down_count,like_count,attachment,created_at,author:profiles!posts_user_id_fkey(handle,display_name,verified,avatar_url)";
  const res = await fetch(`${url}/rest/v1/posts?select=${encodeURIComponent(select)}&hidden=eq.false&kind=neq.repost&body=ilike.${encodeURIComponent(`*${q}*`)}&order=up_count.desc&limit=12`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  return res.ok ? res.json() : [];
}

async function runTool(name, input, ctx, r) {
  switch (name) {
    case "search_shows": {
      const feeds = await searchShows(input.query, ctx.country);
      return { shows: feeds.slice(0, 10).map(r.show) };
    }
    case "find_episodes": {
      const d = await topicData(input.topic, ctx.lang, ctx.country);
      return { episodes: d.episodes.slice(0, 12).map((x) => r.episode(x.show, x.ep)), shows: d.shows.slice(0, 5).map(r.show) };
    }
    case "show_episodes": {
      const id = String(input.show_id || "").replace(/^pi:/, "");
      if (!/^\d+$/.test(id)) return { error: "Use a show id that starts with pi: from search_shows." };
      const d = await pi("/podcasts/byfeedid", { id });
      if (!d.feed || !d.feed.id) return { error: "Show not found." };
      const { feed, episodes } = await showWithEpisodes(d.feed);
      r.show(feed);
      return { show: feed.title, episodes: episodes.slice(0, 10).map((ep) => r.episode(feed, ep)) };
    }
    case "top_charts": {
      const g = APPLE_GENRES[String(input.genre || "").toLowerCase().trim()] || "";
      const d = await topCharts(ctx.country, g);
      return { chart: g ? `Top ${g} in ${ctx.country.toUpperCase()}` : `Top podcasts in ${ctx.country.toUpperCase()}`, shows: d.shows.slice(0, 15).map(r.show) };
    }
    case "trending": {
      const d = await getExplore(ctx.lang);
      (d.topics || []).forEach((t) => r.topics.add(t.topic));
      return {
        topics: (d.topics || []).slice(0, 12).map((t) => ({ topic: t.topic, shows: t.shows, rising: t.rising || undefined })),
        news: (d.news || []).slice(0, 8).map((x) => r.episode(x.show, x.ep)),
        fresh: (d.fresh || []).slice(0, 8).map((x) => r.episode(x.show, x.ep)),
      };
    }
    case "search_stations": {
      const q = String(input.query || "").trim().slice(0, 40);
      const [byName, byTag, soma] = await Promise.all([
        stations({ name: q, order: "trending" }).catch(() => []),
        stations({ country: ctx.country, tags: [q.toLowerCase()], order: "trending" }).catch(() => []),
        somaChannels().then((l) => l.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.tags.some((t) => t.includes(q.toLowerCase())))).catch(() => []),
      ]);
      const seen = new Set();
      const list = [...byName, ...byTag, ...soma].filter((s) => !seen.has(s.id) && seen.add(s.id)).slice(0, 12);
      return { stations: list.map(r.station) };
    }
    case "community_posts": {
      const posts = await communityPosts(input.query).catch(() => []);
      return { posts: posts.map(r.post) };
    }
    case "show_results":
      return { ok: true };
    default:
      return { error: "Unknown tool." };
  }
}

async function callModel(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = new Error(res.status === 429 || res.status === 529 ? "yapi is busy right now. Try again in a moment." : "yapi couldn't answer that. Try again.");
    e.status = res.status === 429 || res.status === 529 ? 503 : 502;
    throw e;
  }
  return res.json();
}

/**
 * history: [{ role: "user" | "assistant", text }] (latest last)
 * returns { text, results: { episodes, shows, stations, topics, posts } }
 */
export async function askYapi(history, { country = "us", lang = "en" } = {}) {
  const r = registry();
  const ctx = { country, lang };
  const messages = history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
  const system = [{ type: "text", text: systemPrompt({ country, lang, today: new Date().toISOString().slice(0, 10) }), cache_control: { type: "ephemeral" } }];
  let picked = null;
  let text = "";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await callModel({ model: MODEL, max_tokens: 800, system, tools: TOOLS, messages });
    messages.push({ role: "assistant", content: res.content });
    const calls = (res.content || []).filter((b) => b.type === "tool_use");
    const said = (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (said) text = said;
    if (res.stop_reason !== "tool_use" || !calls.length) break;
    const results = await Promise.all(calls.map(async (c) => {
      if (c.name === "show_results") picked = c.input || {};
      let out;
      try { out = await runTool(c.name, c.input || {}, ctx, r); } catch { out = { error: "That lookup failed. Try something else." }; }
      return { type: "tool_result", tool_use_id: c.id, content: JSON.stringify(out).slice(0, 14000) };
    }));
    messages.push({ role: "user", content: results });
  }

  const pick = (ids, map) => (ids || []).map((id) => map.get(String(id))).filter(Boolean);
  const results = picked ? {
    episodes: pick(picked.episodes, r.episodes),
    shows: pick(picked.shows, r.shows),
    stations: pick(picked.stations, r.stations),
    topics: (picked.topics || []).filter((t) => typeof t === "string").slice(0, 8),
    posts: pick(picked.posts, r.posts),
  } : { episodes: [], shows: [], stations: [], topics: [], posts: [] };

  return {
    text: (text || "I couldn't find a good answer to that. Try asking another way.").replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/gm, "").trim(),
    results,
  };
}
