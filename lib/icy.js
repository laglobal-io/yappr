// Turn a raw StreamTitle into { artist, song, art, text }. Handles three common shapes:
//   plain:  "Artist - Song"
//   iHeart: 'Artist - text="Song" song_spot="M" ... amgArtworkURL="https://..."' (song_spot M = music; others = ads/talk)
//   talk or show names: "The Morning Show with Jen" (no dash) → shown as the program, not a song
export function parseIcy(raw) {
  const t = String(raw || "").replace(/\s+/g, " ").trim();
  if (!t || /^(-|unknown|n\/a|\s)*$/i.test(t)) return null;
  const attr = (k) => { const m = new RegExp(`${k}="([^"]*)"`).exec(t); return m ? m[1].trim() : ""; };
  if (/\btext="/.test(t)) {
    const spot = attr("song_spot");
    if (spot && spot !== "M") return null; // commercial, jingle or talk break: show the station instead
    const artist = t.split(/\s*-?\s*text="/)[0].replace(/\s*-\s*$/, "").trim();
    const song = attr("text");
    const art = attr("amgArtworkURL");
    if (!song) return null;
    return { artist, song, art: art.startsWith("https://") ? art : "", text: "" };
  }
  const junk = /^(ad|advert|advertisement|commercial|spot)\b|^\d+$/i;
  if (junk.test(t)) return null;
  const i = t.indexOf(" - ");
  if (i > 0 && i < t.length - 3) return { artist: t.slice(0, i).trim().slice(0, 80), song: t.slice(i + 3).trim().slice(0, 120), art: "", text: "" };
  return { artist: "", song: "", art: "", text: t.slice(0, 120) };
}
