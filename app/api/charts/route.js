import { json, fail } from "@/lib/podcastindex";
import { topCharts } from "@/lib/charts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/charts?country=us&genre=Comedy
export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    return json(await topCharts(sp.get("country") || "us", sp.get("genre") || ""), 3600);
  } catch (err) {
    return fail(err);
  }
}
