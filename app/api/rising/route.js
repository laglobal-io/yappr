import { json, fail } from "@/lib/podcastindex";
import { risingShows } from "@/lib/lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rising?lang=en&cat=Comedy → shows gaining momentum fastest over the last few days
export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    return json({ shows: await risingShows(sp.get("lang") || "en", sp.get("cat") || "") }, 900);
  } catch (err) {
    return fail(err);
  }
}
