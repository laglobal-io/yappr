import { pi, feedOut, json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/search?q=history
export async function GET(request) {
  try {
    const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 100);
    if (q.length < 2) return json({ feeds: [] }, 60);
    const data = await pi("/search/byterm", { q, max: 40 });
    return json({ feeds: (data.feeds || []).map(feedOut) }, 600);
  } catch (err) {
    return fail(err);
  }
}
