import { pi, showWithEpisodes, json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/podcast/itunes/1200361736  → looks up a chart show (Apple ID) in Podcast Index
export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    if (!/^\d+$/.test(String(id))) {
      return Response.json({ error: "That show ID isn't valid." }, { status: 400 });
    }
    const data = await pi("/podcasts/byitunesid", { id });
    const feed = data && data.feed && !Array.isArray(data.feed) ? data.feed : null;
    if (!feed || !feed.id) {
      return Response.json({ error: "This show isn't in the Podcast Index yet, so it can't be played here." }, { status: 404 });
    }
    return json(await showWithEpisodes(feed), 600);
  } catch (err) {
    return fail(err);
  }
}
