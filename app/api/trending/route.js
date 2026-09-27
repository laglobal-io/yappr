import { pi, feedOut, json, fail } from "@/lib/podcastindex";
import { podcastOk, dedupeShows } from "@/lib/quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/trending?cat=Comedy
export async function GET(request) {
  try {
    const cat = new URL(request.url).searchParams.get("cat") || "";
    const data = await pi("/podcasts/trending", { max: 60, lang: "en", cat });
    const feeds = dedupeShows((data.feeds || []).map(feedOut).filter(podcastOk)).slice(0, 40);
    return json({ feeds }, 900);
  } catch (err) {
    return fail(err);
  }
}
