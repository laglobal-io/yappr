// Minimal VAST 2/3/4 client for audio ads (works with AdsWizz and other VAST ad servers).
// Fetches the ad tag, follows wrapper redirects, picks an audio MediaFile, and collects
// every impression / tracking / click URL so the player can fire them at the right moments.

function fillMacros(url) {
  return url
    .replace(/\[CACHEBUSTING\]/g, String(Math.floor(Math.random() * 1e9)))
    .replace(/\[TIMESTAMP\]/g, encodeURIComponent(new Date().toISOString()))
    .replace(/%%CACHEBUSTER%%/g, String(Date.now()));
}

// Fire-and-forget tracking pixels. Using an Image avoids CORS entirely.
export function ping(urls = []) {
  for (const raw of urls) {
    const u = (raw || "").trim();
    if (!u) continue;
    try {
      const img = new Image();
      img.src = fillMacros(u);
    } catch {
      /* ignore */
    }
  }
}

const text = (el) => (el && el.textContent ? el.textContent.trim() : "");
const all = (root, tag) => Array.from(root.getElementsByTagName(tag));

function toSeconds(d) {
  const m = /^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(d || "");
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + parseFloat(m[3]) : 0;
}

function collect(adEl, acc) {
  all(adEl, "Impression").forEach((e) => text(e) && acc.impressions.push(text(e)));
  all(adEl, "Error").forEach((e) => text(e) && acc.errors.push(text(e)));
  all(adEl, "ClickTracking").forEach((e) => text(e) && acc.clickTracking.push(text(e)));
  all(adEl, "Tracking").forEach((e) => {
    const ev = e.getAttribute("event");
    const u = text(e);
    if (ev && u) (acc.tracking[ev] = acc.tracking[ev] || []).push(u);
  });
}

/**
 * Returns an ad object, or null when the ad server has nothing to serve (no fill).
 * Throws on network errors, bad XML or timeouts so the caller can skip straight to content.
 */
export async function fetchVastAd(tagUrl, { timeoutMs = 2500, maxWrappers = 4 } = {}) {
  const acc = { impressions: [], errors: [], tracking: {}, clickTracking: [] };
  const deadline = Date.now() + timeoutMs;
  let url = tagUrl;

  for (let depth = 0; depth <= maxWrappers; depth++) {
    const left = deadline - Date.now();
    if (left <= 0) throw new Error("timed out");

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), left);
    let xml;
    try {
      const res = await fetch(fillMacros(url), { signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      xml = await res.text();
    } catch (err) {
      throw new Error(err && err.name === "AbortError" ? "timed out" : (err && err.message) || "request failed");
    } finally {
      clearTimeout(timer);
    }

    const doc = new DOMParser().parseFromString(xml, "text/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("invalid VAST XML");

    const adEl = doc.getElementsByTagName("Ad")[0];
    if (!adEl) {
      ping(acc.errors.map((u) => u.replace("[ERRORCODE]", "303")));
      return null; // no fill
    }
    collect(adEl, acc);

    const wrapper = adEl.getElementsByTagName("Wrapper")[0];
    if (wrapper) {
      const next = text(wrapper.getElementsByTagName("VASTAdTagURI")[0]);
      if (!next) return null;
      url = next;
      continue;
    }

    const inline = adEl.getElementsByTagName("InLine")[0];
    if (!inline) return null;

    const files = all(inline, "MediaFile")
      .map((m) => ({
        url: text(m),
        type: (m.getAttribute("type") || "").toLowerCase(),
        bitrate: Number(m.getAttribute("bitrate") || 0),
      }))
      .filter((f) => f.url);
    const audio = files.filter((f) => f.type.startsWith("audio/"));
    const pool = audio.length ? audio : files;
    pool.sort((a, b) => (b.type === "audio/mpeg") - (a.type === "audio/mpeg") || b.bitrate - a.bitrate);
    const file = pool[0];
    if (!file) {
      ping(acc.errors.map((u) => u.replace("[ERRORCODE]", "403")));
      return null;
    }

    const adTitle = text(inline.getElementsByTagName("AdTitle")[0]);
    const advertiser = text(inline.getElementsByTagName("Advertiser")[0]) || adTitle || "Sponsor";
    return {
      advertiser,
      title: adTitle || advertiser,
      line: text(inline.getElementsByTagName("Description")[0]).slice(0, 140),
      mediaUrl: file.url,
      duration: toSeconds(text(inline.getElementsByTagName("Duration")[0])),
      clickThrough: text(inline.getElementsByTagName("ClickThrough")[0]),
      ...acc,
    };
  }
  throw new Error("too many wrapper redirects");
}
