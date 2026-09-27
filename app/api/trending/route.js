import { json, fail } from "@/lib/podcastindex";
import { trendingFeeds } from "@/lib/lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/trending?cat=Comedy
export async function GET(request) {
  try {
    return json({ feeds: await trendingFeeds(new URL(request.url).searchParams.get("cat") || "") }, 900);
  } catch (err) {
    return fail(err);
  }
}
