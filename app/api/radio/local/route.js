import { nearby } from "@/lib/radio";
import { json, fail } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/radio/local?country=us → popular stations near the listener.
// Uses Vercel's approximate location for the visitor's internet connection (city-level, never GPS).
export async function GET(request) {
  try {
    const h = request.headers;
    const detected = (h.get("x-vercel-ip-country") || "").toLowerCase();
    const wanted = (new URL(request.url).searchParams.get("country") || "").toLowerCase();
    const lat = parseFloat(h.get("x-vercel-ip-latitude"));
    const lon = parseFloat(h.get("x-vercel-ip-longitude"));
    const city = decodeURIComponent(h.get("x-vercel-ip-city") || "");
    // Only when browsing your own country, and when we know roughly where you are
    if (!detected || (wanted && wanted !== detected) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return Response.json({ stations: [] }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const stations = await nearby({ country: detected, lat, lon });
    return Response.json(
      { stations, city, note: city ? `Popular stations around ${city}` : "Popular stations in your area" },
      { headers: { "Cache-Control": "private, max-age=900" } }
    );
  } catch (err) {
    return fail(err);
  }
}
