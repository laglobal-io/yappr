import { somaChannels } from "@/lib/somafm";
import { json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/radio/soma?tag=jazz → SomaFM channels, most listened first
export async function GET(request) {
  try {
    const tag = (new URL(request.url).searchParams.get("tag") || "").toLowerCase();
    let list = await somaChannels();
    if (tag) list = list.filter((c) => c.tags.some((t) => t.includes(tag)) || c.description.toLowerCase().includes(tag));
    return json({ stations: list.map(({ lastPlaying, ...c }) => c), note: "Listener-supported and commercial-free, from SomaFM" }, 600);
  } catch (err) {
    return fail(err);
  }
}
