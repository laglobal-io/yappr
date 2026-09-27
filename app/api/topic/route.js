import { json, fail } from "@/lib/podcastindex";
import { topicData } from "@/lib/topicdata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/topic?q=Federal%20Reserve&lang=en&country=us
export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    return json(await topicData(sp.get("q") || "", sp.get("lang") || "en", sp.get("country") || ""), 900);
  } catch (err) {
    return fail(err);
  }
}
