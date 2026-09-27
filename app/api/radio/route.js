import { stations } from "@/lib/radio";
import { somaChannels } from "@/lib/somafm";
import { json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/radio?country=us&tags=jazz,news&order=trending|top|rising
export async function GET(request) {
  try {
    const sp = new URL(request.url).searchParams;
    const country = (sp.get("country") || "").toLowerCase();
    const tags = (sp.get("tags") || sp.get("tag") || "")
      .toLowerCase()
      .split(",")
      .map((t) => t.trim())
      .filter((t) => /^[a-z0-9 &-]{1,30}$/.test(t))
      .slice(0, 3);
    const order = ["trending", "top", "rising"].includes(sp.get("order")) ? sp.get("order") : "trending";
    const name = (sp.get("q") || "").trim().slice(0, 60);
    // Searching by name looks worldwide; browsing stays in the chosen country
    const list = await stations({ country: !name && /^[a-z]{2}$/.test(country) ? country : "", tags, order, name });
    // Searching by name also looks through SomaFM's channels
    let soma = [];
    if (name) {
      const q = name.toLowerCase();
      soma = (await somaChannels().catch(() => [])).filter((c) => c.name.toLowerCase().includes(q) || c.tags.some((t) => t.includes(q)))
        .map(({ lastPlaying, ...c }) => c).slice(0, 8);
    }
    return json({ stations: [...soma, ...list] }, 600);
  } catch (err) {
    return fail(err);
  }
}
