import { pi, feedOut, itemOut, json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/podcast/920666  → show details + latest episodes
export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    if (!/^\d+$/.test(String(id))) {
      return Response.json({ error: "That show ID isn't valid." }, { status: 400 });
    }
    const [podcast, episodes] = await Promise.all([
      pi("/podcasts/byfeedid", { id }),
      pi("/episodes/byfeedid", { id, max: 60 }),
    ]);
    const feed = podcast && podcast.feed && !Array.isArray(podcast.feed) ? podcast.feed : null;
    if (!feed) return Response.json({ error: "We couldn't find that show." }, { status: 404 });

    const items = (episodes.items || [])
      .map(itemOut)
      .filter((e) => e.audio && (!e.type || e.type.startsWith("audio")));

    return json({ feed: feedOut(feed), episodes: items }, 600);
  } catch (err) {
    return fail(err);
  }
}
