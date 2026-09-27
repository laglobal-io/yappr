import { askYapi } from "@/lib/yapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET  /api/yapi → { enabled } (the app hides yapi when there's no API key)
// POST /api/yapi { messages: [{ role, text }], country, lang } → { text, results }
//
// Cost control: each visitor gets YAPI_HOURLY_LIMIT questions per hour (default 20). This limit lives in
// the server's memory, which is fine to start; at scale, move it to a shared store (e.g. Upstash Redis).
const HOURLY = Number(process.env.YAPI_HOURLY_LIMIT) || 20;
const seen = new Map();

function allowed(ip) {
  const now = Date.now();
  const recent = (seen.get(ip) || []).filter((t) => now - t < 3600 * 1000);
  if (recent.length >= HOURLY) { seen.set(ip, recent); return false; }
  recent.push(now);
  seen.set(ip, recent);
  if (seen.size > 5000) for (const [k, v] of seen) if (!v.some((t) => now - t < 3600 * 1000)) seen.delete(k);
  return true;
}

export async function GET() {
  return Response.json({ enabled: !!process.env.ANTHROPIC_API_KEY }, { headers: { "Cache-Control": "public, s-maxage=300" } });
}

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "yapi isn't switched on for this site yet." }, { status: 503 });
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (!allowed(ip)) return Response.json({ error: "You've asked yapi a lot this hour. Give it a little while and try again." }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .slice(-8)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", text: m.text.trim().slice(0, m.role === "assistant" ? 1200 : 500) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return Response.json({ error: "Ask yapi something first." }, { status: 400 });
  // The model expects the conversation to start with the listener
  while (messages.length && messages[0].role !== "user") messages.shift();

  const country = /^[a-z]{2}$/.test(String(body.country || "")) ? body.country : "us";
  const lang = /^[a-z]{2}$/.test(String(body.lang || "")) ? body.lang : "en";
  try {
    return Response.json(await askYapi(messages, { country, lang }));
  } catch (err) {
    return Response.json({ error: err.message || "yapi couldn't answer that. Try again." }, { status: err.status || 500 });
  }
}
