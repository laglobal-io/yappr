// GET /api/extras?chapters=<url>&transcript=<url>&ttype=<mime>
// Fetches an episode's chapters (Podcasting 2.0 JSON) and transcript (JSON, WebVTT, SRT, HTML or text)
// on the server, because podcast hosts usually don't allow browsers to load these directly.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 3 * 1024 * 1024;

// Only public https addresses (no localhost or private network addresses)
function safe(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.includes(":")) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
      const [a, b] = h.split(".").map(Number);
      if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

async function get(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { "User-Agent": "Yappr/1.0 (https://yappr.fm)" }, cache: "no-store" });
    if (!res.ok) return null;
    if (Number(res.headers.get("content-length") || 0) > MAX) return null;
    const text = await res.text();
    return { text: text.slice(0, MAX), type: (res.headers.get("content-type") || "").toLowerCase() };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- Chapters embedded in the MP3 itself (ID3v2 CHAP frames, the format Apple Podcasts reads) ----
const syncsafe = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function id3Text(b) {
  if (!b || !b.length) return "";
  const enc = b[0];
  const body = b.subarray(1);
  const label = enc === 1 ? "utf-16" : enc === 2 ? "utf-16be" : enc === 3 ? "utf-8" : "latin1";
  try { return new TextDecoder(label).decode(body).replace(/\0/g, "").trim(); } catch { return ""; }
}

function id3Chapters(buf) {
  if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return [];
  const ver = buf[3];
  if (ver < 3) return [];
  const frameSize = (b, o) => (ver === 4 ? syncsafe(b, o) : u32(b, o));
  let o = 10;
  if (buf[5] & 0x40) o += ver === 4 ? syncsafe(buf, 10) : u32(buf, 10) + 4; // extended header
  const end = Math.min(buf.length, 10 + syncsafe(buf, 6));
  const out = [];
  while (o + 10 <= end) {
    const id = String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = frameSize(buf, o + 4);
    if (size <= 0 || o + 10 + size > end) break;
    if (id === "CHAP") {
      const body = buf.subarray(o + 10, o + 10 + size);
      const z = body.indexOf(0);
      if (z >= 0 && z + 17 <= body.length) {
        const start = u32(body, z + 1) / 1000;
        let p = z + 17, title = "";
        while (p + 10 <= body.length) {
          const sid = String.fromCharCode(body[p], body[p + 1], body[p + 2], body[p + 3]);
          const ss = frameSize(body, p + 4);
          if (ss <= 0 || p + 10 + ss > body.length) break;
          if (sid === "TIT2") title = id3Text(body.subarray(p + 10, p + 10 + ss));
          p += 10 + ss;
        }
        if (title) out.push({ start, title: title.slice(0, 160), img: "" });
      }
    }
    o += 10 + size;
  }
  return out.sort((a, b) => a.start - b.start).slice(0, 300);
}

// Read only the first bytes of the audio file (the ID3 tag sits at the start), never the whole episode
async function audioHead(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 7000);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { Range: "bytes=0-1048575", "User-Agent": "Yappr/1.0 (https://yappr.fm)" }, cache: "no-store" });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0, need = 1048576, checked = false;
    while (got < need) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      if (!checked && got >= 10) {
        checked = true;
        const head = Buffer.concat(chunks.map((c) => Buffer.from(c)));
        if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) { ac.abort(); return null; } // no ID3 tag
        need = Math.min(MAX, 10 + syncsafe(head, 6)); // read exactly the tag, nothing more
      }
    }
    ac.abort();
    return new Uint8Array(Buffer.concat(chunks.map((c) => Buffer.from(c))));
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function parseChapters(text) {
  try {
    const d = JSON.parse(text);
    return (d.chapters || [])
      .filter((c) => c && c.toc !== false && Number.isFinite(Number(c.startTime)))
      .map((c) => ({ start: Number(c.startTime), title: String(c.title || "").slice(0, 160), img: c.img && String(c.img).startsWith("https://") ? c.img : "" }))
      .filter((c) => c.title)
      .sort((a, b) => a.start - b.start)
      .slice(0, 300);
  } catch {
    return [];
  }
}

const ts = (s) => {
  const m = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/.exec(s);
  return m ? Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000 : null;
};
const clean = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

// Word-level transcripts are merged into readable lines of roughly 8 seconds, split when the speaker changes
function group(segments) {
  const out = [];
  let cur = null;
  for (const s of segments) {
    if (!s.text) continue;
    if (cur && (s.speaker || "") === (cur.speaker || "") && s.start - cur.start < 8 && cur.text.length < 280) {
      cur.text += (/^[,.!?;:]/.test(s.text) ? "" : " ") + s.text;
      cur.end = s.end ?? cur.end;
    } else {
      if (cur) out.push(cur);
      cur = { ...s };
    }
  }
  if (cur) out.push(cur);
  return out.slice(0, 6000);
}

function parseTranscript(text, type) {
  const t = text.trim();
  if (type.includes("json") || t.startsWith("{")) {
    try {
      const d = JSON.parse(t);
      return group((d.segments || []).map((s) => ({ start: Number(s.startTime) || 0, end: Number(s.endTime) || null, text: clean(String(s.body || "")), speaker: s.speaker ? String(s.speaker) : "" })));
    } catch { /* fall through */ }
  }
  if (type.includes("vtt") || type.includes("srt") || /-->/.test(t)) {
    const cues = [];
    for (const block of t.replace(/\r/g, "").split(/\n\n+/)) {
      const lines = block.split("\n");
      const i = lines.findIndex((l) => l.includes("-->"));
      if (i < 0) continue;
      const [a, b] = lines[i].split("-->");
      const rawText = lines.slice(i + 1).join(" ");
      const sp = /<v\s+([^>]+)>/.exec(rawText);
      cues.push({ start: ts(a) ?? 0, end: ts(b), text: clean(rawText), speaker: sp ? sp[1].trim() : "" });
    }
    return group(cues);
  }
  // HTML or plain text: paragraphs without timing
  const paras = (type.includes("html") || /<p[\s>]/i.test(t) ? t.split(/<\/p>|<br\s*\/?>\s*<br\s*\/?>/i) : t.split(/\n\s*\n/))
    .map((p) => clean(p)).filter(Boolean).slice(0, 2000);
  return paras.map((p) => ({ start: null, end: null, text: p, speaker: "" }));
}

export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const chaptersUrl = safe(sp.get("chapters") || "");
  const transcriptUrl = safe(sp.get("transcript") || "");
  const audioUrl = !chaptersUrl ? safe(sp.get("audio") || "") : null;
  const [c, tr, head] = await Promise.all([
    chaptersUrl ? get(chaptersUrl) : null,
    transcriptUrl ? get(transcriptUrl) : null,
    audioUrl ? audioHead(audioUrl) : null,
  ]);
  const chapters = c ? parseChapters(c.text) : head ? id3Chapters(head) : [];
  const transcript = tr ? parseTranscript(tr.text, (sp.get("ttype") || tr.type || "").toLowerCase()) : [];
  return Response.json(
    { chapters, transcript, timed: transcript.some((x) => x.start != null) },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
