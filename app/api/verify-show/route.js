import { createClient } from "@supabase/supabase-js";
import { pi } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/verify-show  { showId }   (Authorization: Bearer <the signed-in user's access token>)
// Checks that the host added their yappr code to the show's RSS feed, then marks the claim verified
// and gives their profile the Host badge. Only the server can grant badges.
export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ error: "Accounts aren't set up on this site yet." }, { status: 500 });
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { showId } = await request.json().catch(() => ({}));
  if (!token || !/^\d+$/.test(String(showId || ""))) return Response.json({ error: "Sign in and pick a show first." }, { status: 400 });

  const db = createClient(url, service, { auth: { persistSession: false } });
  const { data: who } = await db.auth.getUser(token);
  const user = who && who.user;
  if (!user) return Response.json({ error: "Your session expired. Sign in again." }, { status: 401 });

  const { data: claim } = await db.from("show_claims").select("code,status").eq("user_id", user.id).eq("show_id", String(showId)).maybeSingle();
  if (!claim) return Response.json({ error: "Start a claim for this show first." }, { status: 400 });
  if (claim.status === "verified") return Response.json({ ok: true, already: true });

  // Read the show's feed straight from the publisher (at most 5 MB)
  let feedText = "";
  try {
    const d = await pi("/podcasts/byfeedid", { id: showId });
    const feedUrl = d && d.feed && d.feed.url;
    if (!feedUrl) throw new Error("no feed");
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10000);
    const res = await fetch(feedUrl, { signal: ac.signal, headers: { "User-Agent": "Yappr/1.0 (https://yappr.fm)" }, cache: "no-store" });
    clearTimeout(t);
    feedText = (await res.text()).slice(0, 5 * 1024 * 1024);
  } catch {
    return Response.json({ error: "We couldn't read your show's feed. Try again in a few minutes." }, { status: 502 });
  }
  if (!feedText.includes(claim.code)) {
    return Response.json({ error: "We didn't find your code in the feed yet. Feeds can take a few minutes to update after you publish." }, { status: 409 });
  }

  await db.from("show_claims").update({ status: "verified", verified_at: new Date().toISOString() }).eq("user_id", user.id).eq("show_id", String(showId));
  const { data: prof } = await db.from("profiles").select("verified").eq("id", user.id).maybeSingle();
  if (prof && !prof.verified) await db.from("profiles").update({ verified: "host" }).eq("id", user.id);
  return Response.json({ ok: true });
}
