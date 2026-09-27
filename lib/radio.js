import { networkOf } from "./networks";
import { stationWeight } from "./quality";

// Server-only helper for Radio Browser (https://www.radio-browser.info), a free, open directory of live stations.
// Their docs ask apps to discover mirror servers rather than hard-code one, and to send a descriptive User-Agent.
const UA = "Yappr/1.0 (https://yappr.fm)";
const FALLBACK = "https://de1.api.radio-browser.info";
let cached = { base: null, at: 0 };

async function server() {
  if (cached.base && Date.now() - cached.at < 3600 * 1000) return cached.base;
  try {
    const res = await fetch("https://all.api.radio-browser.info/json/servers", { headers: { "User-Agent": UA }, cache: "no-store" });
    const names = [...new Set((await res.json()).map((s) => s.name).filter(Boolean))];
    if (names.length) {
      cached = { base: `https://${names[Math.floor(Math.random() * names.length)]}`, at: Date.now() };
      return cached.base;
    }
  } catch {
    /* fall through */
  }
  return FALLBACK;
}

async function query(base, params) {
  const url = new URL(base + "/json/stations/search");
  for (const [k, v] of Object.entries(params)) if (v !== "" && v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) throw new Error(`Radio directory returned ${res.status}`);
  return res.json();
}

// Only streams a browser can play on an https site: secure (https), a common audio codec, not a tiny
// low-quality bitrate. HLS streams (used by many big stations) play through hls.js in the app.
function playable(s) {
  const url = s.url_resolved || s.url || "";
  if (!url.startsWith("https://")) return false;
  if (s.lastcheckok === 0) return false;
  if (s.bitrate && s.bitrate < 32) return false;
  const hls = s.hls === 1 || /\.m3u8(\?|$)/i.test(url);
  return hls || !s.codec || /mp3|aac|ogg|opus|unknown/i.test(s.codec);
}

// order: trending = most listened in the last 24h, top = community votes, rising = biggest recent climb
const ORDER = { trending: "clickcount", top: "votes", rising: "clicktrend" };

async function search(params) {
  const base = await server();
  try {
    return await query(base, params);
  } catch {
    cached = { base: null, at: 0 };
    return query(FALLBACK, params);
  }
}

export async function stations({ country, tags = [], order = "trending", name = "" }) {
  const base = {
    countrycode: country ? country.toUpperCase() : "",
    name,
    hidebroken: "true",
    order: ORDER[order] || "clickcount",
    reverse: "true",
    limit: tags.length > 1 ? 80 : 160,
  };
  const lists = await Promise.all((tags.length ? tags : [""]).map((tag) => search({ ...base, tag })));
  // Interleave results when several genres are requested (For You)
  const rows = [];
  for (let i = 0; i < Math.max(...lists.map((l) => l.length)); i++) lists.forEach((l) => l[i] && rows.push(l[i]));
  const seen = new Set();
  const list = rows
    .filter(playable)
    .filter((s) => {
      const k = `${(s.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${s.countrycode || ""}`;
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map(normalize);
  // Rank by the chosen signal, weighted by quality (logo, bitrate, website, major network)
  if (order !== "rising") {
    const signal = (st) => (order === "top" ? st.votes : st.listeners);
    list.sort((a, b) => signal(b) * stationWeight(b) - signal(a) * stationWeight(a));
  }
  return list.slice(0, 60);
}

function normalize(s) {
  return {
    id: s.stationuuid,
    name: (s.name || "").trim().slice(0, 80),
    url: s.url_resolved || s.url,
    image: (s.favicon || "").startsWith("https://") ? s.favicon : "",
    homepage: (s.homepage || "").startsWith("http") ? s.homepage : "",
    country: s.country || "",
    state: s.state || "",
    tags: (s.tags || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3),
    codec: s.codec || "",
    bitrate: s.bitrate || 0,
    network: networkOf(s),
    listeners: s.clickcount || 0,
    votes: s.votes || 0,
    hls: s.hls === 1 || /\.m3u8(\?|$)/i.test(s.url_resolved || s.url || ""),
  };
}

// Distance between two points on Earth, in km
function km(lat1, lon1, lat2, lon2) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

// Stations within radiusKm of a point, ranked by popularity (listens in the last 24 hours),
// with the big US groups (iHeart, Audacy, Cumulus, Beasley) ranked first.
export async function nearby({ country, lat, lon, radiusKm = 120 }) {
  const rows = await search({
    countrycode: country.toUpperCase(), has_geo_info: "true", hidebroken: "true",
    order: "clickcount", reverse: "true", limit: 600,
  });
  const seen = new Set();
  return rows
    .filter(playable)
    .filter((s) => typeof s.geo_lat === "number" && typeof s.geo_long === "number")
    .map((s) => ({ s, d: km(lat, lon, s.geo_lat, s.geo_long) }))
    .filter(({ s, d }) => {
      const k = (s.name || "").trim().toLowerCase();
      if (d > radiusKm || !k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map(({ s, d }) => ({ ...normalize(s), distanceKm: Math.round(d) }))
    .sort((a, b) => (b.network ? 1 : 0) - (a.network ? 1 : 0) || b.listeners * stationWeight(b) - a.listeners * stationWeight(a))
    .slice(0, 48);
}

export async function stationById(uuid) {
  const base = await server();
  const res = await fetch(`${base}/json/stations/byuuid?uuids=${encodeURIComponent(uuid)}`, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows && rows[0] ? rows[0] : null;
}
