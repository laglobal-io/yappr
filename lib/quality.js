// Quality signals for ranking. Everything here uses public directory data only.

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Podcasts: drop obvious junk, then prefer shows that are listed on Apple, still publishing,
// have a real back catalog, artwork and a description.
export function podcastOk(f) {
  if (!f || !f.title || f.title === "Untitled show") return false;
  if (f.dead) return false;
  if (!f.image) return false;
  if (f.episodeCount != null && f.episodeCount < 2) return false;
  return true;
}

export function podcastScore(f, now = Date.now() / 1000) {
  let s = 0;
  if (f.itunesId) s += 3; // listed in Apple Podcasts
  if (f.episodeCount) s += Math.min(3, Math.log10(f.episodeCount + 1) * 1.5);
  if (f.updated) {
    const days = (now - f.updated) / 86400;
    s += days < 14 ? 3 : days < 60 ? 2 : days < 365 ? 0.5 : -2;
  }
  if (f.description && f.description.length > 80) s += 0.5;
  if (f.trendScore) s += Math.min(4, f.trendScore / 3);
  return s;
}

// Same show listed twice (e.g. a moved feed): keep the first, which is the better-ranked one
export function dedupeShows(list) {
  const seen = new Set();
  return list.filter((f) => {
    const k = `${norm(f.title)}|${norm(f.author)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Stations: popularity, weighted by signs of a well-run station
export function stationWeight(st) {
  let w = 1;
  if (st.network) w *= 1.35;
  if (st.image) w *= 1.1; else w *= 0.8;
  if (st.bitrate >= 96) w *= 1.1;
  else if (st.bitrate && st.bitrate < 64) w *= 0.8;
  if (st.homepage) w *= 1.05;
  return w;
}
