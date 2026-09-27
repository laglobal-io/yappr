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
  const [c, tr] = await Promise.all([chaptersUrl ? get(chaptersUrl) : null, transcriptUrl ? get(transcriptUrl) : null]);
  const chapters = c ? parseChapters(c.text) : [];
  const transcript = tr ? parseTranscript(tr.text, (sp.get("ttype") || tr.type || "").toLowerCase()) : [];
  return Response.json(
    { chapters, transcript, timed: transcript.some((x) => x.start != null) },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
