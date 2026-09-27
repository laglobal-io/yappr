import { pi, feedOut, json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rising?lang=en&cat=Comedy  → shows gaining momentum fastest over the last few days (Podcast Index trending).
export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    const raw = (sp.get("lang") || "en").toLowerCase();
    const lang = /^[a-z]{2}$/.test(raw) ? raw : "en";
    const cat = (sp.get("cat") || "").replace(/[^A-Za-z &,-]/g, "").slice(0, 80);
    const since = Math.floor(Date.now() / 1000) - 3 * 86400;
    const data = await pi("/podcasts/trending", { max: 50, lang, since, cat });
    const shows = (data.feeds || []).map((f, i) => ({ rank: i + 1, ...feedOut(f) }));
    return json({ shows }, 900);
  } catch (err) {
    return fail(err);
  }
}
