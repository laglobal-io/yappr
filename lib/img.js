// Right-sized artwork. Podcast art is often a 3000×3000 original (several MB) shown at ~150px, so we
// ask for the size we actually display (doubled for sharp screens), as WebP.
//   - Apple artwork (mzstatic.com) already supports sizes in its URL, so we use that directly.
//   - Everything else goes through wsrv.nl, a free, open-source image CDN (weserv). You can self-host
//     weserv later, or set NEXT_PUBLIC_IMAGE_PROXY=off to load originals.
const PROXY = process.env.NEXT_PUBLIC_IMAGE_PROXY || "wsrv";

export function sized(src, px = 320, fit = "cover") {
  if (!src || typeof src !== "string" || src.startsWith("data:") || src.startsWith("/")) return src;
  if (/mzstatic\.com\/.+\/\d+x\d+bb\./.test(src)) return src.replace(/\/\d+x\d+bb\./, `/${px}x${px}bb.`);
  if (PROXY === "off") return src;
  const q = new URLSearchParams({ url: src, w: String(px), output: "webp", q: "80", we: "" });
  if (fit === "cover") { q.set("h", String(px)); q.set("fit", "cover"); }
  return `https://wsrv.nl/?${q.toString()}`;
}
