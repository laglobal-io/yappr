import { json, fail } from "@/lib/podcastindex";
import { getExplore } from "@/lib/explore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/explore?lang=en
export async function GET(request) {
  try {
    return json(await getExplore(new URL(request.url).searchParams.get("lang") || "en"), 1200);
  } catch (err) {
    return fail(err);
  }
}
