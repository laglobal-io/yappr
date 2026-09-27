import { pi, feedOut, json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rising?lang=en  → shows gaining momentum fastest over the last few days (Podcast Index trending).
export async function GET(request) {
  try {
    const raw = (new URL(request.url).searchParams.get("lang") || "en").toLowerCase();
    const lang = /^[a-z]{2}$/.test(raw) ? raw : "en";
    const since = Math.floor(Date.now() / 1000) - 3 * 86400;
    const data = await pi("/podcasts/trending", { max: 50, lang, since });
    const shows = (data.feeds || []).map((f, i) => ({ rank: i + 1, ...feedOut(f) }));
    return json({ shows }, 900);
  } catch (err) {
    return fail(err);
  }
}
