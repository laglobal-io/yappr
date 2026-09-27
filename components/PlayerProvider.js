"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { fetchVastAd, ping } from "@/lib/vast";
import { loadStore, saveStore } from "@/lib/storage";
import { useAuth } from "./AuthProvider";
import VideoDock from "./VideoDock";

const PlayerCtx = createContext(null);
export const usePlayer = () => useContext(PlayerCtx);

const RATES = [1, 1.25, 1.5, 2];
const IDLE = {
  show: null, ep: null, queue: [], phase: "idle", slot: null, ad: null,
  playing: false, pos: 0, dur: 0, rate: 1, error: null,
};
// Build-time env vars (safe to expose: ad tags are public URLs).
const VAST = {
  preroll: process.env.NEXT_PUBLIC_VAST_PREROLL_URL || "",
  postroll: process.env.NEXT_PUBLIC_VAST_POSTROLL_URL || "",
  // Live radio often sells through a different partner (e.g. Triton). Falls back to the preroll tag.
  live: process.env.NEXT_PUBLIC_VAST_LIVE_PREROLL_URL || process.env.NEXT_PUBLIC_VAST_PREROLL_URL || "",
};
// No ad if the listener heard one this recently (stops ad after ad when hopping between stations or episodes)
const GAP_SETTING = process.env.NEXT_PUBLIC_AD_MIN_GAP_SECONDS;
const AD_GAP_MS = (GAP_SETTING !== undefined && GAP_SETTING !== "" && !Number.isNaN(Number(GAP_SETTING)) ? Number(GAP_SETTING) : 90) * 1000;
let houseAdsPromise = null;
function houseAds() {
  if (!houseAdsPromise) {
    houseAdsPromise = fetch("/ads/house-ads.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => (Array.isArray(d) ? d : d.ads || []))
      .catch(() => []);
  }
  return houseAdsPromise;
}

// A tenth of a second of silence. Playing it inside the tap handler "unlocks" audio on iOS,
// so the ad and the episode can start after network requests finish.
function makeSilence() {
  const n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

const slimShow = (s) => ({ id: s.id, title: s.title, author: s.author, image: s.image, categories: (s.categories || []).slice(0, 4) });
const slimEp = (e) => ({ id: e.id, title: e.title, duration: e.duration, audio: e.audio, image: e.image, published: e.published, live: !!e.live, isVideo: !!e.isVideo, chaptersUrl: e.chaptersUrl || "", transcript: e.transcript || null });
const slimStation = (st) => ({ id: st.id, name: st.name, url: st.url, image: st.image, homepage: st.homepage, country: st.country, tags: st.tags || [] });
const isAdPhase = (p) => p === "preroll" || p === "postroll";

export function PlayerProvider({ children }) {
  const auth = useAuth();
  const audioRef = useRef(null); // a <video> element: it plays audio files too, so one element handles everything
  const [medium, setMediumState] = useState("listen"); // Watch / Listen preference, Listen by default
  const [videoOpen, setVideoOpen] = useState(false);
  const st = useRef(IDLE);
  const [s, setS] = useState(IDLE);
  const storeRef = useRef(null);
  const [storeVersion, setStoreVersion] = useState(0);
  const [logs, setLogs] = useState([]);
  const [toast, setToast] = useState("");
  const runRef = useRef(0);
  const firedRef = useRef(new Set());
  const adPausedRef = useRef(false);
  const lastSaveRef = useRef(0);
  const pendingSeekRef = useRef(0);
  const silenceRef = useRef("");
  const toastTimer = useRef(null);

  const update = useCallback((patch) => {
    st.current = { ...st.current, ...patch };
    setS(st.current);
  }, []);
  const log = useCallback((msg) => setLogs((l) => [{ t: Date.now(), msg }, ...l].slice(0, 120)), []);
  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  }, []);
  const persist = useCallback((rerender) => {
    saveStore(storeRef.current);
    if (rerender) setStoreVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    storeRef.current = loadStore();
    if (storeRef.current.medium === "watch") setMediumState("watch");
    setStoreVersion((v) => v + 1);
    silenceRef.current = makeSilence();
  }, []);

  const setMedium = useCallback((m) => {
    setMediumState(m);
    if (storeRef.current) { storeRef.current.medium = m; persist(true); }
  }, [persist]);

  // Lets the UI change saved preferences (like For You vibes) and re-render.
  const updateStore = useCallback((fn) => {
    if (!storeRef.current) return;
    fn(storeRef.current);
    persist(true);
  }, [persist]);

  /* ---------- helpers ---------- */
  const saveResume = useCallback((force) => {
    const { phase, ep } = st.current;
    const a = audioRef.current;
    if (phase !== "content" || !ep || ep.live || !a || !storeRef.current) return;
    const t = a.currentTime || 0;
    if (force || Math.abs(t - lastSaveRef.current) >= 5) {
      storeRef.current.resume[ep.id] = Math.floor(t);
      storeRef.current.resumeAt = storeRef.current.resumeAt || {};
      storeRef.current.resumeAt[ep.id] = Date.now();
      lastSaveRef.current = t;
      persist(!!force);
      H.current.syncProgress && H.current.syncProgress(!!force, false);
    }
  }, [persist]);

  const track = useCallback((evt, once = true) => {
    const { ad, slot } = st.current;
    if (!ad) return;
    if (once) {
      if (firedRef.current.has(evt)) return;
      firedRef.current.add(evt);
    }
    log(`${slot}: ${evt}`);
    const urls = evt === "impression" ? ad.impressions : evt === "clickThrough" ? ad.clickTracking : ad.tracking[evt] || [];
    ping(urls, ad.context);
  }, [log]);

  const lastAdAt = useRef(0);
  const requestAd = useCallback(async (slot) => {
    const { show, ep } = st.current;
    if (Date.now() - lastAdAt.current < AD_GAP_MS) {
      log(`${slot}: skipped, the listener heard an ad less than ${Math.round(AD_GAP_MS / 1000)}s ago`);
      return null;
    }
    const live = !!(ep && ep.live);
    const tag = live ? VAST.live : VAST[slot];
    const context = {
      slot,
      content: live ? "live" : ep && ep.isVideo ? "video" : "podcast",
      genre: (show && show.categories && show.categories[0]) || "",
      showId: show ? String(show.id).replace(/^radio:/, "") : "",
      show: show ? show.title : "",
      episodeId: ep ? String(ep.id) : "",
      country: (storeRef.current && storeRef.current.country) || "",
    };
    if (tag) {
      log(`${slot}: VAST request sent`);
      try {
        const ad = await fetchVastAd(tag, { timeoutMs: 2500, context });
        if (ad) {
          ad.context = context;
          log(`${slot}: VAST received (${ad.advertiser}${ad.duration ? `, ${Math.round(ad.duration)}s` : ""}${ad.companion ? ", with banner" : ""})`);
          return ad;
        }
        log(`${slot}: no paid ad available (no fill)`);
      } catch (err) {
        log(`${slot}: ${err.message}`);
      }
    }
    // House ads fill in when there's no ad server, or it had nothing to serve
    const list = (await houseAds()).filter((a) => a && a.src && (!a.slots || a.slots.includes(live ? "live" : slot) || (live && a.slots.includes("preroll"))));
    if (list.length) {
      const a = list[Math.floor(Math.random() * list.length)];
      log(`${slot}: house ad (${a.advertiser || "Sponsor"})`);
      return {
        advertiser: a.advertiser || "Sponsor", title: a.title || a.advertiser || "Sponsor", line: a.line || "",
        mediaUrl: a.src, duration: Number(a.duration) || 0, clickThrough: a.clickThrough || "",
        companion: a.image ? { image: a.image, clickThrough: a.clickThrough || "", views: [] } : null,
        impressions: [], errors: [], tracking: {}, clickTracking: [], house: true,
      };
    }
    log(`${slot}: no ad to play, skipping`);
    return null;
  }, [log]);

  const playAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    const p = a.play();
    if (p && p.catch) {
      p.catch((err) => {
        if (err && err.name === "NotAllowedError") update({ playing: false });
      });
    }
  }, [update]);

  const startContent = useCallback(() => {
    const a = audioRef.current;
    const { ep } = st.current;
    const rate = ep.live ? 1 : st.current.rate; // live radio always plays at normal speed
    firedRef.current = new Set();
    update({ phase: "content", slot: null, ad: null, pos: 0, dur: ep.duration || 0, error: null });
    const resume = ep.live ? 0 : (storeRef.current && storeRef.current.resume[ep.id]) || 0;
    pendingSeekRef.current = resume;
    lastSaveRef.current = resume;
    setVideoOpen(!!ep.isVideo && mediumRef.current === "watch");
    a.src = ep.audio;
    a.defaultPlaybackRate = rate;
    a.playbackRate = rate;
    playAudio();
  }, [update, playAudio]);

  const startAd = useCallback((ad, slot) => {
    const a = audioRef.current;
    setVideoOpen(!!ad.isVideo && mediumRef.current === "watch");
    firedRef.current = new Set();
    adPausedRef.current = false;
    update({ phase: slot, slot, ad, pos: 0, dur: ad.duration || 0 });
    a.src = ad.mediaUrl;
    a.defaultPlaybackRate = 1;
    a.playbackRate = 1;
    playAudio();
  }, [update, playAudio]);

  const finish = useCallback(() => {
    update({ phase: "done", playing: false, ad: null });
    // Sleep timer, then Up next, then autoplay the show's next episode
    setTimeout(() => H.current.afterEpisode && H.current.afterEpisode(), 350);
  }, [update]);

  const runPostroll = useCallback(async () => {
    const run = runRef.current;
    update({ phase: "loading", slot: "postroll", ad: null });
    const ad = await requestAd("postroll");
    if (run !== runRef.current) return;
    if (ad) startAd(ad, "postroll");
    else finish();
  }, [update, requestAd, startAd, finish]);

  /* ---------- public actions ---------- */
  const play = useCallback(async (show, ep, queue) => {
    const a = audioRef.current;
    if (!a || !ep || !ep.audio) return;
    saveResume(true);
    const run = ++runRef.current;
    try {
      a.src = silenceRef.current || "";
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch {
      /* ignore */
    }
    update({ ...IDLE, rate: st.current.rate, show, ep, queue: queue || [], phase: "loading", slot: "preroll", playing: true });

    const store = storeRef.current;
    if (store && !ep.live) {
      store.recent = [{ show: slimShow(show), ep: slimEp(ep) }, ...store.recent.filter((r) => r.ep.id !== ep.id)].slice(0, 8);
      persist(true);
    }

    const ad = await requestAd("preroll");
    if (run !== runRef.current) return;
    if (ad) startAd(ad, "preroll");
    else startContent();
  }, [saveResume, update, persist, requestAd, startAd, startContent]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    const { phase, ep, show, queue, error } = st.current;
    if (!a || !ep) return;
    if (phase === "done") { play(show, ep, queue); return; }
    if (phase === "loading") return;
    if (error && phase === "content") { update({ error: null }); a.load(); playAudio(); return; }
    // Live streams: reconnect on resume so you hear what's on now, not what was buffered
    if (a.paused && phase === "content" && ep.live) a.load();
    if (a.paused) playAudio();
    else a.pause();
  }, [play, update, playAudio]);

  const seekTo = useCallback((t) => {
    const a = audioRef.current;
    if (!a || st.current.phase !== "content" || (st.current.ep && st.current.ep.live)) return;
    const max = Number.isFinite(a.duration) ? a.duration - 1 : st.current.dur;
    a.currentTime = Math.max(0, Math.min(max, t));
    update({ pos: a.currentTime });
    saveResume(true);
  }, [update, saveResume]);

  const seekBy = useCallback((d) => {
    const a = audioRef.current;
    if (a) seekTo((a.currentTime || 0) + d);
  }, [seekTo]);

  const cycleRate = useCallback(() => {
    if (st.current.ep && st.current.ep.live) return;
    const rate = RATES[(RATES.indexOf(st.current.rate) + 1) % RATES.length];
    update({ rate });
    const a = audioRef.current;
    if (a && st.current.phase === "content") { a.defaultPlaybackRate = rate; a.playbackRate = rate; }
  }, [update]);

  const clickAd = useCallback((url) => {
    const { ad } = st.current;
    if (!ad) return;
    track("clickThrough", false);
    const target = (typeof url === "string" && url) || ad.clickThrough || (ad.companion && ad.companion.clickThrough);
    if (target) window.open(target, "_blank", "noopener,noreferrer");
    audioRef.current && audioRef.current.pause();
  }, [track]);

  /* ---------- favorites, sharing, next ---------- */
  const isFavShow = useCallback((id) => !!(storeRef.current && storeRef.current.favShows && storeRef.current.favShows[id]), []);
  const isFavEp = useCallback((id) => !!(storeRef.current && storeRef.current.favEps && storeRef.current.favEps[id]), []);

  // Signed in: mirror each favorite change to the account (fire and forget; local copy stays the source for the UI)
  const syncFav = useCallback((kind, id, data) => {
    const db = auth.supabase;
    const user = auth.user;
    if (!db || !user) return;
    const q = data
      ? db.from("favorites").upsert({ user_id: user.id, kind, item_id: String(id), data }, { onConflict: "user_id,kind,item_id" })
      : db.from("favorites").delete().match({ user_id: user.id, kind, item_id: String(id) });
    q.then(({ error }) => { if (error) console.warn("Favorite sync failed", error.message); });
  }, [auth.supabase, auth.user]);

  const toggleFavShow = useCallback((show) => {
    let row = null;
    updateStore((store) => {
      store.favShows = store.favShows || {};
      if (store.favShows[show.id]) delete store.favShows[show.id];
      else { row = { ...slimShow(show), savedAt: Date.now() }; store.favShows[show.id] = row; }
    });
    syncFav("show", show.id, row);
    showToast(row ? `Saved ${show.title} to favorites` : "Removed from favorites");
    return !!row;
  }, [updateStore, showToast, syncFav]);

  const toggleFavEp = useCallback((show, ep) => {
    let row = null;
    updateStore((store) => {
      store.favEps = store.favEps || {};
      if (store.favEps[ep.id]) delete store.favEps[ep.id];
      else { row = { show: slimShow(show), ep: slimEp(ep), savedAt: Date.now() }; store.favEps[ep.id] = row; }
    });
    syncFav("episode", ep.id, row);
    showToast(row ? "Episode saved to favorites" : "Removed from favorites");
  }, [updateStore, showToast, syncFav]);

  const isFavStation = useCallback((id) => !!(storeRef.current && storeRef.current.favStations && storeRef.current.favStations[id]), []);
  const toggleFavStation = useCallback((st) => {
    let row = null;
    updateStore((store) => {
      store.favStations = store.favStations || {};
      if (store.favStations[st.id]) delete store.favStations[st.id];
      else { row = { ...slimStation(st), savedAt: Date.now() }; store.favStations[st.id] = row; }
    });
    syncFav("station", st.id, row);
    showToast(row ? `Saved ${st.name} to favorites` : "Removed from favorites");
  }, [updateStore, showToast, syncFav]);

  // Tune in to a live station (shared by every LIVE view and favorites)
  const playStation = useCallback((station) => {
    const epId = `radio-${station.id}`;
    if (st.current.ep && st.current.ep.id === epId) { H.current.toggle(); return; }
    const show = { id: `radio:${station.id}`, title: station.name, author: station.country, image: station.image, categories: station.tags || [], website: station.homepage, station: slimStation(station) };
    const ep = { id: epId, title: station.name, audio: station.url, duration: 0, image: station.image, published: 0, live: true };
    updateStore((store) => {
      store.recentStations = [slimStation(station), ...(store.recentStations || []).filter((x) => x.id !== station.id)].slice(0, 12);
    });
    H.current.play(show, ep, []);
    // Radio Browser asks apps to report plays so popular stations rank well for everyone.
    fetch(`https://de1.api.radio-browser.info/json/url/${encodeURIComponent(station.id)}`, { mode: "no-cors" }).catch(() => {});
  }, [updateStore]);

  // On sign-in: merge the account's favorites with this device's, then upload anything only saved locally
  useEffect(() => {
    const db = auth.supabase;
    const user = auth.user;
    if (!db || !user || !storeRef.current) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await db.from("favorites").select("kind,item_id,data");
      if (cancelled || error) return;
      const store = storeRef.current;
      const maps = { show: "favShows", episode: "favEps", station: "favStations" };
      const remote = new Set();
      (data || []).forEach((r) => {
        const key = maps[r.kind];
        if (!key) return;
        store[key] = store[key] || {};
        store[key][r.item_id] = r.data;
        remote.add(`${r.kind}:${r.item_id}`);
      });
      const upload = [];
      Object.entries(maps).forEach(([kind, key]) => {
        Object.entries(store[key] || {}).forEach(([id, row]) => {
          if (!remote.has(`${kind}:${id}`)) upload.push({ user_id: user.id, kind, item_id: String(id), data: row });
        });
      });
      if (upload.length) await db.from("favorites").upsert(upload, { onConflict: "user_id,kind,item_id" });
      persist(true);
    })();
    return () => { cancelled = true; };
  }, [auth.supabase, auth.user, persist]);

  const share = useCallback(async ({ title, text, url }) => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title, text, url }); return; }
      catch (err) { if (err && err.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); showToast("Link copied. Paste it anywhere to share."); }
    catch { showToast(url); }
  }, [showToast]);

  const nextInQueue = useCallback(() => {
    const { queue, ep } = st.current;
    if (!ep || !queue || !queue.length) return null;
    const i = queue.findIndex((e) => e.id === ep.id);
    return i >= 0 && i < queue.length - 1 ? queue[i + 1] : null;
  }, []);

  const playNext = useCallback(() => {
    const next = nextInQueue();
    if (next) play(st.current.show, next, st.current.queue);
  }, [nextInQueue, play]);

  /* ---------- sleep timer ---------- */
  const [sleep, setSleepState] = useState({ mode: "off", until: 0 });
  const sleepRef = useRef(sleep);
  sleepRef.current = sleep;
  const setSleep = useCallback((opt) => {
    const a = audioRef.current;
    if (a) a.volume = 1;
    if (opt === "off") { setSleepState({ mode: "off", until: 0 }); showToast("Sleep timer off"); return; }
    if (opt === "end") { setSleepState({ mode: "end", until: 0 }); showToast("Stopping after this episode"); return; }
    setSleepState({ mode: "time", until: Date.now() + opt * 60000 });
    showToast(`Sleep timer set for ${opt} minutes`);
  }, [showToast]);
  useEffect(() => {
    if (sleep.mode !== "time") return;
    const iv = setInterval(() => {
      const a = audioRef.current;
      const left = sleepRef.current.until - Date.now();
      if (!a) return;
      if (left <= 0) {
        a.pause();
        a.volume = 1;
        setSleepState({ mode: "off", until: 0 });
        showToast("Sleep timer ended. Goodnight");
      } else if (left < 10000) {
        a.volume = Math.max(0.05, left / 10000); // gentle fade over the last 10 seconds
      }
    }, 500);
    return () => clearInterval(iv);
  }, [sleep.mode, sleep.until, showToast]);

  /* ---------- Up next queue and autoplay ---------- */
  const [upNext, setUpNext] = useState([]);
  const [autoplay, setAutoplayState] = useState(true);
  const queueLoaded = useRef(false);
  useEffect(() => {
    if (queueLoaded.current || !storeRef.current) return;
    queueLoaded.current = true;
    setUpNext(storeRef.current.upNext || []);
    setAutoplayState(storeRef.current.autoplay !== false);
  }, [storeVersion]);
  const saveQueue = useCallback((list) => {
    setUpNext(list);
    if (storeRef.current) { storeRef.current.upNext = list; persist(false); }
  }, [persist]);
  const addToQueue = useCallback((show, ep) => {
    if (!ep || ep.live) return;
    const list = (storeRef.current && storeRef.current.upNext) || [];
    if (list.some((x) => x.ep.id === ep.id)) { showToast("Already in Up next"); return; }
    saveQueue([...list, { show: slimShow(show), ep: slimEp(ep) }].slice(0, 50));
    showToast("Added to Up next");
  }, [saveQueue, showToast]);
  const removeFromQueue = useCallback((id) => {
    saveQueue(((storeRef.current && storeRef.current.upNext) || []).filter((x) => x.ep.id !== id));
  }, [saveQueue]);
  const playQueued = useCallback((id) => {
    const list = (storeRef.current && storeRef.current.upNext) || [];
    const item = list.find((x) => x.ep.id === id);
    if (!item) return;
    saveQueue(list.filter((x) => x.ep.id !== id));
    play(item.show, item.ep, []);
  }, [saveQueue, play]);
  const setAutoplay = useCallback((on) => {
    setAutoplayState(on);
    if (storeRef.current) { storeRef.current.autoplay = on; persist(false); }
  }, [persist]);
  const afterEpisode = useCallback(() => {
    if (st.current.phase !== "done") return;
    if (sleepRef.current.mode === "end") {
      setSleepState({ mode: "off", until: 0 });
      showToast("Sleep timer ended. Goodnight");
      return;
    }
    const list = (storeRef.current && storeRef.current.upNext) || [];
    if (list.length) { playQueued(list[0].ep.id); return; }
    const autoOn = !storeRef.current || storeRef.current.autoplay !== false;
    const next = autoOn ? nextInQueue() : null;
    if (next) play(st.current.show, next, st.current.queue);
  }, [playQueued, nextInQueue, play, showToast]);

  /* ---------- cast to speakers and TVs (Chromecast via Remote Playback, AirPlay in Safari) ---------- */
  const [castSupported, setCastSupported] = useState(false);
  useEffect(() => {
    const a = audioRef.current;
    setCastSupported(!!(a && (a.remote || a.webkitShowPlaybackTargetPicker)));
  }, []);
  const cast = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.webkitShowPlaybackTargetPicker) { a.webkitShowPlaybackTargetPicker(); return; }
    if (a.remote) a.remote.prompt().catch((err) => {
      if (err && err.name === "NotFoundError") showToast("No speakers or TVs found nearby");
      else if (err && err.name !== "AbortError") showToast("Casting isn't available for this audio");
    });
  }, [showToast]);

  /* ---------- live radio: what's playing now ---------- */
  const [nowPlaying, setNowPlaying] = useState(null);
  const liveId = s.ep && s.ep.live && s.phase === "content" ? String(s.show.id).replace(/^radio:/, "") : null;
  useEffect(() => {
    setNowPlaying(null);
    if (!liveId) return;
    let stop = false;
    const load = () => fetch(`/api/radio/now?id=${encodeURIComponent(liveId)}`).then((r) => r.json()).then((d) => { if (!stop) setNowPlaying(d.title || null); }).catch(() => {});
    load();
    const iv = setInterval(load, 30000);
    return () => { stop = true; clearInterval(iv); };
  }, [liveId]);

  /* ---------- transcripts and chapters for the current episode ---------- */
  const [extras, setExtras] = useState({ state: "none", chapters: [], transcript: [], timed: false });
  const epKey = s.ep && !s.ep.live ? s.ep.id : null;
  useEffect(() => {
    const ep = st.current.ep;
    if (!epKey || !ep || (!ep.chaptersUrl && !ep.transcript)) { setExtras({ state: "none", chapters: [], transcript: [], timed: false }); return; }
    const ac = new AbortController();
    setExtras({ state: "loading", chapters: [], transcript: [], timed: false });
    const q = new URLSearchParams();
    if (ep.chaptersUrl) q.set("chapters", ep.chaptersUrl);
    if (ep.transcript) { q.set("transcript", ep.transcript.url); if (ep.transcript.type) q.set("ttype", ep.transcript.type); }
    fetch(`/api/extras?${q}`, { signal: ac.signal }).then((r) => r.json())
      .then((d) => setExtras({ state: "ok", chapters: d.chapters || [], transcript: d.transcript || [], timed: !!d.timed }))
      .catch((err) => { if (err.name !== "AbortError") setExtras({ state: "none", chapters: [], transcript: [], timed: false }); });
    return () => ac.abort();
  }, [epKey]);

  /* ---------- listening progress synced to your account ---------- */
  const lastRemote = useRef({ id: null, at: 0 });
  const syncProgress = useCallback((force, finished) => {
    const db = auth.supabase, user = auth.user;
    const { ep, show } = st.current;
    const a = audioRef.current;
    if (!db || !user || !ep || ep.live || !a) return;
    if (!force && lastRemote.current.id === ep.id && Date.now() - lastRemote.current.at < 20000) return;
    lastRemote.current = { id: ep.id, at: Date.now() };
    db.from("playback").upsert({
      user_id: user.id, episode_id: String(ep.id), position: finished ? 0 : Math.floor(a.currentTime || 0),
      duration: Math.floor(Number.isFinite(a.duration) ? a.duration : ep.duration || 0), finished: !!finished,
      show: slimShow(show), ep: slimEp(ep), updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,episode_id" }).then(({ error }) => { if (error) console.warn("Progress sync failed", error.message); });
  }, [auth.supabase, auth.user]);

  // On sign-in: bring in progress from your other devices (newest wins)
  useEffect(() => {
    const db = auth.supabase, user = auth.user;
    if (!db || !user || !storeRef.current) return;
    let cancelled = false;
    db.from("playback").select("episode_id,position,finished,show,ep,updated_at").order("updated_at", { ascending: false }).limit(100)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const store = storeRef.current;
        store.resumeAt = store.resumeAt || {};
        const recentIds = new Set(store.recent.map((r) => r.ep.id));
        const fromCloud = [];
        data.forEach((row) => {
          const at = Date.parse(row.updated_at) || 0;
          if ((store.resumeAt[row.episode_id] || 0) >= at) return; // this device is newer
          if (row.finished) { store.played[row.episode_id] = true; delete store.resume[row.episode_id]; return; }
          store.resume[row.episode_id] = row.position;
          store.resumeAt[row.episode_id] = at;
          if (row.show && row.ep && !recentIds.has(row.episode_id)) fromCloud.push({ show: row.show, ep: row.ep });
        });
        store.recent = [...store.recent, ...fromCloud].slice(0, 12);
        persist(true);
      });
    return () => { cancelled = true; };
  }, [auth.supabase, auth.user, persist]);

  /* ---------- audio element events ---------- */
  const mediumRef = useRef(medium);
  mediumRef.current = medium;
  const H = useRef({});
  H.current = { track, saveResume, startContent, runPostroll, finish, update, log, persist, showToast, toggle, seekBy, seekTo, playAudio, play, afterEpisode, syncProgress };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const skip = () => { const p = st.current.phase; return p === "loading" || p === "idle" || p === "done"; };

    const onPlaying = () => {
      if (skip()) return;
      H.current.update({ playing: true, error: null });
      if (isAdPhase(st.current.phase)) {
        lastAdAt.current = Date.now();
        H.current.track("impression");
        H.current.track("start");
        const comp = st.current.ad && st.current.ad.companion;
        if (comp && comp.views && comp.views.length && !firedRef.current.has("companionView")) {
          firedRef.current.add("companionView");
          ping(comp.views, st.current.ad.context);
        }
        if (adPausedRef.current) { adPausedRef.current = false; H.current.track("resume", false); }
      }
    };
    const onPause = () => {
      if (skip() || a.ended) return;
      H.current.update({ playing: false });
      if (isAdPhase(st.current.phase)) { adPausedRef.current = true; H.current.track("pause", false); }
      else H.current.saveResume(true);
    };
    const onTime = () => {
      if (skip()) return;
      const pos = a.currentTime || 0;
      const dur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : st.current.dur;
      H.current.update({ pos, dur });
      if (isAdPhase(st.current.phase) && dur) {
        const q = pos / dur;
        if (q >= 0.25) H.current.track("firstQuartile");
        if (q >= 0.5) H.current.track("midpoint");
        if (q >= 0.75) H.current.track("thirdQuartile");
      } else if (st.current.phase === "content") {
        H.current.saveResume(false);
      }
    };
    const onMeta = () => {
      if (st.current.phase !== "content") return;
      const resume = pendingSeekRef.current;
      pendingSeekRef.current = 0;
      if (resume > 5 && Number.isFinite(a.duration) && resume < a.duration - 10) {
        a.currentTime = resume;
        const m = Math.floor(resume / 60), sec = String(Math.floor(resume % 60)).padStart(2, "0");
        H.current.showToast(`Picking up where you left off at ${m}:${sec}`);
      }
    };
    const onEnded = () => {
      const { phase, ep } = st.current;
      if (phase === "preroll") { H.current.track("complete"); H.current.startContent(); }
      else if (phase === "content" && ep && ep.live) {
        H.current.update({ playing: false, error: "The stream stopped. Tap play to reconnect." });
      } else if (phase === "content") {
        const store = storeRef.current;
        if (store && ep) { delete store.resume[ep.id]; store.played[ep.id] = true; H.current.persist(true); }
        H.current.syncProgress && H.current.syncProgress(true, true);
        H.current.runPostroll();
      } else if (phase === "postroll") { H.current.track("complete"); H.current.finish(); }
    };
    const onError = () => {
      if (skip()) return;
      const { phase, ad, slot } = st.current;
      if (isAdPhase(phase)) {
        H.current.log(`${slot}: ad audio failed to load, skipping`);
        if (ad) ping(ad.errors.map((u) => u.replace("[ERRORCODE]", "405")));
        if (phase === "preroll") H.current.startContent();
        else H.current.finish();
      } else if (phase === "content") {
        H.current.update({ playing: false, error: "This episode's audio didn't load. The show's host may be having trouble. Tap play to try again." });
      }
    };

    a.addEventListener("playing", onPlaying);
    a.addEventListener("pause", onPause);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    const onHide = () => H.current.saveResume(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  /* ---------- lock screen / headphone controls ---------- */
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !s.ep) return;
    const ms = navigator.mediaSession;
    const ad = isAdPhase(s.phase);
    const art = s.ep.image || s.show.image;
    try {
      ms.metadata = new MediaMetadata({
        title: ad && s.ad ? `Ad: ${s.ad.advertiser}` : s.ep.live && nowPlaying ? nowPlaying : s.ep.title,
        artist: s.show.title,
        album: "yappr",
        artwork: art ? [{ src: art, sizes: "512x512" }] : [],
      });
      ms.setActionHandler("play", () => H.current.playAudio());
      ms.setActionHandler("pause", () => audioRef.current && audioRef.current.pause());
      const c = s.phase === "content" && !s.ep.live;
      ms.setActionHandler("seekbackward", c ? () => H.current.seekBy(-15) : null);
      ms.setActionHandler("seekforward", c ? () => H.current.seekBy(30) : null);
      ms.setActionHandler("seekto", c ? (d) => H.current.seekTo(d.seekTime) : null);
    } catch {
      /* some browsers don't support every action */
    }
  }, [s.ep, s.show, s.phase, s.ad, nowPlaying]);

  const value = {
    ...s, play, toggle, seekBy, seekTo, cycleRate, clickAd,
    logs, toast, store: storeRef.current, storeVersion, updateStore,
    isFavShow, isFavEp, toggleFavShow, toggleFavEp, share, nextInQueue, playNext,
    isFavStation, toggleFavStation, playStation, medium, setMedium, videoOpen, setVideoOpen, notify: showToast,
    sleep, setSleep, upNext, addToQueue, removeFromQueue, playQueued, autoplay, setAutoplay,
    castSupported, cast, nowPlaying, extras,
  };

  return (
    <PlayerCtx.Provider value={value}>
      {children}
      <VideoDock mediaRef={audioRef} state={s} open={videoOpen} onHide={() => setVideoOpen(false)} />
    </PlayerCtx.Provider>
  );
}
