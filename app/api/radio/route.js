import { stations } from "@/lib/radio";
import { json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/radio?country=us&tag=jazz&order=popular|rising
export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    const country = (sp.get("country") || "").toLowerCase();
    const tag = (sp.get("tag") || "").toLowerCase();
    const order = sp.get("order") === "rising" ? "rising" : "popular";
    const list = await stations({
      country: /^[a-z]{2}$/.test(country) ? country : "",
      tag: /^[a-z0-9 &-]{0,30}$/.test(tag) ? tag : "",
      order,
    });
    return json({ stations: list }, 600);
  } catch (err) {
    return fail(err);
  }
}
