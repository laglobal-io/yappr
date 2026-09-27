// SomaFM: listener-supported, commercial-free internet radio (San Francisco), with a public channel list.
// We link back to each channel and don't play yappr ads before their streams.
let cache = { at: 0, list: [] };

export async function somaChannels(maxAgeMs = 5 * 60 * 1000) {
  if (cache.list.length && Date.now() - cache.at < maxAgeMs) return cache.list;
  const res = await fetch("https://api.somafm.com/channels.json", { headers: { "User-Agent": "Yappr/1.0 (https://yappr.fm)" }, cache: "no-store" });
  if (!res.ok) throw new Error(`SomaFM returned ${res.status}`);
  const d = await res.json();
  cache = {
    at: Date.now(),
    list: (d.channels || []).map((c) => ({
      id: `soma-${c.id}`,
      name: `SomaFM ${c.title}`.replace(/^SomaFM SomaFM/, "SomaFM"),
      url: `https://ice1.somafm.com/${c.id}-128-mp3`,
      image: (c.xlimage || c.largeimage || c.image || "").replace(/^http:\/\//, "https://"),
      homepage: `https://somafm.com/${c.id}/`,
      country: "Commercial-free",
      tags: String(c.genre || "").split("|").map((g) => g.trim().toLowerCase()).filter(Boolean).slice(0, 3),
      description: String(c.description || "").slice(0, 240),
      listeners: Number(c.listeners) || 0,
      lastPlaying: c.lastPlaying || "",
      network: "SomaFM",
      source: "somafm",
      noAds: true,
      bitrate: 128,
    })).sort((a, b) => b.listeners - a.listeners),
  };
  return cache.list;
}
