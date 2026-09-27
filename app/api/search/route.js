import { json, fail } from "@/lib/podcastindex";
import { searchShows } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/search?q=history&country=us
export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    return json({ feeds: await searchShows(sp.get("q") || "", sp.get("country") || "us") }, 600);
  } catch (err) {
    return fail(err);
  }
}
