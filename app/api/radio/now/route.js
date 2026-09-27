import { stationById } from "@/lib/radio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/radio/now?id=<station uuid> → what's playing right now, e.g. "Artist - Song".
// Most internet radio streams embed this ("ICY metadata") every few KB of audio. We read just enough of the
// stream to find it, then hang up. Not every station sends it; then we return null and the app shows "Live radio".
const MAX_BYTES = 256 * 1024;

export async function GET(request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  const none = () => Response.json({ title: null }, { headers: { "Cache-Control": "public, s-maxage=20" } });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return none();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    const st = await stationById(id);
    const url = st && (st.url_resolved || st.url);
    if (!url || !url.startsWith("https://")) return none();
    const res = await fetch(url, { headers: { "Icy-MetaData": "1", "User-Agent": "Yappr/1.0 (https://yappr.fm)" }, signal: ac.signal, cache: "no-store" });
    const metaint = parseInt(res.headers.get("icy-metaint") || "", 10);
    if (!res.ok || !res.body || !Number.isFinite(metaint) || metaint <= 0 || metaint > MAX_BYTES) { ac.abort(); return none(); }

    // Read metaint bytes of audio, then 1 length byte (x16), then the metadata block
    const reader = res.body.getReader();
    let buf = new Uint8Array(0);
    while (buf.length < metaint + 1 + 16 * 255 && buf.length < MAX_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      const next = new Uint8Array(buf.length + value.length);
      next.set(buf); next.set(value, buf.length); buf = next;
      if (buf.length > metaint) {
        const len = buf[metaint] * 16;
        if (buf.length >= metaint + 1 + len) {
          ac.abort();
          const raw = buf.slice(metaint + 1, metaint + 1 + len);
          let text = new TextDecoder("utf-8", { fatal: false }).decode(raw);
          if (text.includes("\uFFFD")) text = new TextDecoder("latin1").decode(raw);
          const m = /StreamTitle='(.*?)';/s.exec(text);
          const title = m ? m[1].trim() : "";
          return Response.json(
            { title: title && !/^(-|unknown|\s)*$/i.test(title) ? title.slice(0, 140) : null },
            { headers: { "Cache-Control": "public, s-maxage=20" } }
          );
        }
      }
    }
    ac.abort();
    return none();
  } catch {
    return none();
  } finally {
    clearTimeout(timer);
  }
}
