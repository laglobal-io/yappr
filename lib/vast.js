// Minimal VAST 2/3/4 client for audio ads (works with AdsWizz and other VAST ad servers).
// Fetches the ad tag, follows wrapper redirects, picks an audio MediaFile, and collects
// every impression / tracking / click URL so the player can fire them at the right moments.

// Macros you can put in your ad tag URL. Standard VAST ones plus yappr's own targeting details,
// e.g. https://ads.example.com/vast?genre=[YAPPR_GENRE]&content=[YAPPR_CONTENT]&cb=[CACHEBUSTING]
//   [CACHEBUSTING] [TIMESTAMP] %%CACHEBUSTER%%   standard
//   [YAPPR_SLOT]      preroll | postroll
//   [YAPPR_CONTENT]   podcast | video | live
//   [YAPPR_GENRE]     the show's or station's first category, e.g. Comedy
//   [YAPPR_SHOW_ID]   Podcast Index feed id (or radio station id)
//   [YAPPR_SHOW]      show or station name
//   [YAPPR_EPISODE_ID]
//   [YAPPR_COUNTRY]   the listener's chosen country, e.g. us
//   [PAGE_URL]        the page the listener is on
//   [US_PRIVACY]      US privacy string: 1YYN if the browser sends Global Privacy Control, else 1YNN
//   [GPC]             1 if the browser sends Global Privacy Control, else 0
function fillMacros(url, ctx = {}) {
  const gpc = typeof navigator !== "undefined" && navigator.globalPrivacyControl === true;
  const values = {
    CACHEBUSTING: String(Math.floor(Math.random() * 1e9)),
    TIMESTAMP: new Date().toISOString(),
    YAPPR_SLOT: ctx.slot || "",
    YAPPR_CONTENT: ctx.content || "",
    YAPPR_GENRE: ctx.genre || "",
    YAPPR_SHOW_ID: ctx.showId || "",
    YAPPR_SHOW: ctx.show || "",
    YAPPR_EPISODE_ID: ctx.episodeId || "",
    YAPPR_COUNTRY: ctx.country || "",
    PAGE_URL: typeof window !== "undefined" ? window.location.origin + window.location.pathname : "",
    US_PRIVACY: gpc ? "1YYN" : "1YNN",
    GPC: gpc ? "1" : "0",
  };
  return url
    .replace(/\[([A-Z_]+)\]/g, (m, k) => (k in values ? encodeURIComponent(values[k]) : m))
    .replace(/%%CACHEBUSTER%%/g, String(Date.now()));
}

// Fire-and-forget tracking pixels. Using an Image avoids CORS entirely.
export function ping(urls = [], context) {
  for (const raw of urls) {
    const u = (raw || "").trim();
    if (!u) continue;
    try {
      const img = new Image();
      img.src = fillMacros(u, context);
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
function pickCompanion(root) {
  const options = all(root, "Companion")
    .map((c) => {
      const res = c.getElementsByTagName("StaticResource")[0];
      const type = ((res && res.getAttribute("creativeType")) || "").toLowerCase();
      return {
        image: text(res),
        type,
        width: Number(c.getAttribute("width") || 0),
        height: Number(c.getAttribute("height") || 0),
        clickThrough: text(c.getElementsByTagName("CompanionClickThrough")[0]),
        views: all(c, "Tracking").filter((t) => t.getAttribute("event") === "creativeView").map(text).filter(Boolean),
      };
    })
    .filter((c) => c.image && (!c.type || c.type.startsWith("image/")));
  // Prefer the most square banner (it replaces the artwork in the play bar)
  options.sort((a, b) => Math.abs(1 - (a.width / (a.height || 1))) - Math.abs(1 - (b.width / (b.height || 1))));
  return options[0] || null;
}

export async function fetchVastAd(tagUrl, { timeoutMs = 2500, maxWrappers = 4, context = {} } = {}) {
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
      const res = await fetch(fillMacros(url, context), { signal: ac.signal });
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
      isVideo: file.type.startsWith("video/"),
      companion: pickCompanion(inline),
      duration: toSeconds(text(inline.getElementsByTagName("Duration")[0])),
      clickThrough: text(inline.getElementsByTagName("ClickThrough")[0]),
      ...acc,
    };
  }
  throw new Error("too many wrapper redirects");
}
