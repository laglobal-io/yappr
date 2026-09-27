import { pi, itemOut, json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/latest?ids=920666,75075  → newest episodes across the shows you follow (one request).
export async function GET(request) {
  try {
    const ids = (new URL(request.url).searchParams.get("ids") || "")
      .split(",")
      .filter((id) => /^\d+$/.test(id))
      .slice(0, 100);
    if (!ids.length) return json({ episodes: [] }, 60);
    const since = Math.floor(Date.now() / 1000) - 30 * 86400;
    const data = await pi("/episodes/byfeedid", { id: ids.join(","), max: 60, since });
    const episodes = (data.items || [])
      .map((i) => ({ ...itemOut(i), feedId: String(i.feedId || "") }))
      .filter((e) => e.audio && e.feedId)
      .sort((a, b) => b.published - a.published);
    return json({ episodes }, 600);
  } catch (err) {
    return fail(err);
  }
}
