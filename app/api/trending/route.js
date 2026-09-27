import { pi, feedOut, json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/trending?cat=Comedy
export async function GET(request) {
  try {
    const cat = new URL(request.url).searchParams.get("cat") || "";
    const data = await pi("/podcasts/trending", { max: 40, lang: "en", cat });
    return json({ feeds: (data.feeds || []).map(feedOut) }, 900);
  } catch (err) {
    return fail(err);
  }
}
