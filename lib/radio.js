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

// Only streams a browser can play on an https site: https, not HLS playlists, common audio codecs.
function playable(s) {
  const url = s.url_resolved || s.url || "";
  return url.startsWith("https://") && !s.hls && (!s.codec || /mp3|aac|ogg|opus/i.test(s.codec));
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
  return rows
    .filter(playable)
    .filter((s) => {
      const k = (s.name || "").trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 48)
    .map((s) => ({
      id: s.stationuuid,
      name: (s.name || "").trim().slice(0, 80),
      url: s.url_resolved || s.url,
      image: (s.favicon || "").startsWith("https://") ? s.favicon : "",
      homepage: (s.homepage || "").startsWith("http") ? s.homepage : "",
      country: s.country || "",
      tags: (s.tags || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3),
      codec: s.codec || "",
      bitrate: s.bitrate || 0,
    }));
}
