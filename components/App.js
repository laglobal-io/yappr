"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PlayerProvider, usePlayer } from "./PlayerProvider";
import { AuthProvider } from "./AuthProvider";
import { NowBar, DebugPanel } from "./Player";
import ShowPanel from "./ShowPanel";
import Account from "./Account";
import Art from "./Art";
import Icon from "./Icon";
import Footer from "./Footer";
import LogoMark from "./Logo";
import { getJSON } from "@/lib/api";
import { COUNTRIES, findCountry, isCountry } from "@/lib/countries";

// Podcast Index category names. If a category comes back empty, we fall back to a search.
// `apple` is the matching Apple Podcasts genre, used to filter the Top charts.
const VIBES = [
  { label: "All", cat: "" },
  { label: "Comedy", cat: "Comedy", apple: "Comedy" },
  { label: "True crime", cat: "True Crime", q: "true crime", apple: "True Crime" },
  { label: "Tech", cat: "Technology", apple: "Technology" },
  { label: "Culture", cat: "Culture", apple: "Society & Culture" },
  { label: "Health", cat: "Health", apple: "Health & Fitness" },
  { label: "Sports", cat: "Sports", apple: "Sports" },
  { label: "History", cat: "History", apple: "History" },
  { label: "Business", cat: "Business", apple: "Business" },
  { label: "Science", cat: "Science", apple: "Science" },
  { label: "News", cat: "News", apple: "News" },
  { label: "Stories", cat: "Fiction", q: "audio fiction", apple: "Fiction" },
];
const PICKABLE = VIBES.filter((v) => v.cat);

const GENRES = [
  { label: "All", tag: "" }, { label: "Talk", tag: "talk" }, { label: "News", tag: "news" }, { label: "Pop", tag: "pop" },
  { label: "Rock", tag: "rock" }, { label: "Hip hop", tag: "hiphop" }, { label: "Jazz", tag: "jazz" }, { label: "Classical", tag: "classical" },
  { label: "Country", tag: "country" }, { label: "Dance", tag: "dance" }, { label: "Sports", tag: "sports" },
];
const PICKABLE_GENRES = GENRES.filter((g) => g.tag);

const TABS = [
  { id: "trending", label: "Trending" },
  { id: "top", label: "Top" },
  { id: "rising", label: "Rising" },
  { id: "foryou", label: "For You" },
  { id: "favorites", label: "Favorites" },
];

export default function App({ initialShow = null, initialEp = null }) {
  return (
    <AuthProvider>
      <PlayerProvider>
        <Shell initialShow={initialShow} initialEp={initialEp} />
      </PlayerProvider>
    </AuthProvider>
  );
}

function Shell({ initialShow, initialEp }) {
  const player = usePlayer();
  const [section, setSection] = useState("podcasts"); // podcasts | live
  const [tab, setTab] = useState("trending");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState({ state: "idle", feeds: [], stations: [] });
  const [open, setOpen] = useState(initialShow ? { key: `pi:${initialShow}`, origin: "top", focusEp: initialEp } : null);
  const [country, setCountryState] = useState(null);
  const [debug, setDebug] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const inputRef = useRef(null);
  const topRef = useRef(null);
  const navRef = useRef(null);
  const medium = player.medium;

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("debug"));
    const [sec, t] = window.location.hash.replace("#", "").split("-");
    if (sec === "live" || sec === "podcasts") setSection(sec);
    if (TABS.some((x) => x.id === t)) setTab(t);
  }, []);

  const go = useCallback((sec, t) => {
    setSection(sec);
    setTab(t);
    setOpen((o) => (o && o.origin === "top" ? o : null));
    try {
      const base = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", sec === "podcasts" && t === "trending" ? base : `${base}#${sec}-${t}`);
    } catch { /* ignore */ }
  }, []);

  // Country for Top, Rising and LIVE: saved choice, else a guess from the visitor's location
  const storeReady = !!player.store;
  useEffect(() => {
    if (!storeReady || country) return;
    const saved = player.store.country;
    if (saved && isCountry(saved)) { setCountryState(saved); return; }
    getJSON("/api/geo").then((d) => setCountryState(d.country)).catch(() => setCountryState("us"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeReady]);
  const setCountry = useCallback((c) => {
    setCountryState(c);
    player.updateStore((s) => { s.country = c; });
    setOpen((o) => (o && o.origin === "top" ? o : null));
  }, [player]);

  const toggleShow = useCallback((key, origin) => {
    setOpen((o) => (o && o.key === key && o.origin === origin ? null : { key, origin }));
  }, []);
  const closeShow = useCallback(() => setOpen(null), []);
  const openFromBar = useCallback((id) => {
    if (String(id).startsWith("radio:")) {
      go("live", "trending");
      setTimeout(() => navRef.current && navRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    setOpen({ key: `pi:${id}`, origin: "top" });
  }, [go]);

  useEffect(() => {
    if (open && open.origin === "top" && topRef.current) topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

  // Debounced search: shows in Podcasts, stations in LIVE
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSearch({ state: "idle", feeds: [], stations: [] }); return; }
    const ac = new AbortController();
    setSearch((s) => ({ ...s, state: "loading" }));
    const t = setTimeout(async () => {
      try {
        if (section === "live") {
          const d = await getJSON(`/api/radio?q=${encodeURIComponent(q)}`, ac.signal);
          setSearch({ state: "ok", feeds: [], stations: d.stations || [] });
        } else {
          const d = await getJSON(`/api/search?q=${encodeURIComponent(q)}`, ac.signal);
          let feeds = d.feeds || [];
          if (medium === "watch") feeds = [...feeds].sort((a, b) => (b.medium === "video") - (a.medium === "video"));
          setSearch({ state: "ok", feeds, stations: [] });
        }
      } catch (err) {
        if (err.name !== "AbortError") setSearch({ state: "error", feeds: [], stations: [], error: err.message });
      }
    }, 350);
    return () => { clearTimeout(t); ac.abort(); };
  }, [query, section, medium]);

  const startPlay = useCallback((show, ep, queue) => player.play(show, ep, queue), [player]);

  // Keyboard: Escape closes the open show, space toggles playback
  const toggleRef = useRef(player.toggle);
  toggleRef.current = player.toggle;
  const hasEp = !!player.ep;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { if (debugOpen) setDebugOpen(false); else setOpen(null); }
      else if (e.key === " " && hasEp && !/INPUT|TEXTAREA|BUTTON|SELECT|A/.test(document.activeElement?.tagName || "")) {
        e.preventDefault();
        toggleRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [debugOpen, hasEp]);

  const recent = useMemo(() => {
    const store = player.store;
    if (!store) return [];
    return store.recent.filter((r) => !store.played[r.ep.id] && !r.ep.live).slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.storeVersion, player.store]);

  const toggleTheme = () => {
    const root = document.documentElement;
    const cur = root.dataset.theme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("yappr:theme", next); } catch { /* ignore */ }
  };

  const goHome = (e) => {
    if (window.location.pathname !== "/") return;
    e.preventDefault();
    setQuery("");
    go("podcasts", "trending");
    setOpen(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const searching = query.trim().length >= 2;
  const panel = { open, onToggle: toggleShow, onClose: closeShow, onPlay: startPlay };
  const live = section === "live";

  return (
    <>
      <header className="top">
        <a className="logo" href="/" onClick={goHome} aria-label="yappr home">
          <LogoMark />
          <span>yappr</span>
        </a>
        <div className="top-actions">
          {debug ? (
            <button className="icon-btn" onClick={() => setDebugOpen((o) => !o)} aria-label="Show ad events" aria-expanded={debugOpen}>
              <Icon name="wave" />
            </button>
          ) : null}
          <button className="icon-btn" onClick={toggleTheme} aria-label="Switch light or dark theme"><Icon name="theme" /></button>
          <Account />
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <h1>What are we yapping to?</h1>
          <p className="pitch">Every Podcast. Every Creator.</p>

          <div className="section-switch" role="tablist" aria-label="What to browse">
            <button role="tab" aria-selected={!live} onClick={() => go("podcasts", tab)}>
              <Icon name="headphones" /> Podcasts
            </button>
            <button role="tab" aria-selected={live} onClick={() => go("live", tab)}>
              <span className="live-dot" aria-hidden="true" /> LIVE
            </button>
          </div>

          <label className="search">
            <Icon name="search" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={live ? "Search radio stations" : "Search shows, hosts, topics"}
              autoComplete="off"
              aria-label={live ? "Search radio stations" : "Search podcasts"}
            />
            {query ? (
              <button className="icon-btn" type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search">
                <Icon name="close" />
              </button>
            ) : null}
          </label>
        </section>

        {open && open.origin === "top" ? (
          <div className="sec top-panel" ref={topRef}>
            <ShowPanel key={open.key} showKey={open.key} focusEp={open.focusEp} onClose={closeShow} onPlay={startPlay} />
          </div>
        ) : null}

        {searching ? (
          <section className="sec">
            <h2>{live ? "Stations" : "Shows"} matching “{query.trim()}”</h2>
            {live ? (
              <StationGrid data={{ state: search.state, stations: search.stations, error: search.error }} emptyText={`No stations match “${query.trim()}”.`} />
            ) : (
              <ShowGrid gridId="search" data={search} {...panel} emptyText={`Nothing matches “${query.trim()}”. Try a show name, a host, or a topic like history or sleep.`} />
            )}
          </section>
        ) : (
          <>
            {!live && recent.length ? (
              <section className="sec">
                <h2>Keep listening</h2>
                <div className="list">
                  {recent.map((r) => <EpisodeCard key={r.ep.id} show={r.show} ep={r.ep} onPlay={startPlay} />)}
                </div>
              </section>
            ) : null}

            <div className="tabs" role="tablist" aria-label={live ? "Browse live radio" : "Browse podcasts"} ref={navRef}>
              {TABS.map((t) => (
                <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="browse-panel" className="tab" onClick={() => go(section, t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="controls-row">
              {!live ? (
                <Switcher
                  label="Watch or listen"
                  value={medium}
                  onChange={player.setMedium}
                  options={[{ id: "listen", label: "Listen", icon: "headphones" }, { id: "watch", label: "Watch", icon: "video" }]}
                />
              ) : null}
              {live || tab === "top" || tab === "rising" ? <CountrySelect country={country} setCountry={setCountry} /> : null}
            </div>

            <div id="browse-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
              {!live ? (
                tab === "trending" ? <PodTrending medium={medium} panel={panel} />
                : tab === "top" || tab === "rising" ? <PodChart mode={tab} medium={medium} country={country} panel={panel} />
                : tab === "foryou" ? <PodForYou medium={medium} panel={panel} />
                : <PodFavorites panel={panel} />
              ) : (
                tab === "foryou" ? <LiveForYou country={country} />
                : tab === "favorites" ? <LiveFavorites />
                : <LiveList order={tab} country={country} />
              )}
            </div>
          </>
        )}
        <Footer />
      </main>

      <NowBar onOpenShow={openFromBar} />
      {debug ? <DebugPanel open={debugOpen} onClose={() => setDebugOpen(false)} /> : null}
      <div className={`toast${player.toast ? " show" : ""}`} role="status" aria-live="polite">{player.toast}</div>
    </>
  );
}

/* ---------- shared pieces ---------- */

function useFeed(url) {
  const [data, setData] = useState({ state: "loading", feeds: [], shows: [], stations: [] });
  useEffect(() => {
    if (!url) return;
    const ac = new AbortController();
    setData((d) => ({ ...d, state: "loading" }));
    getJSON(url, ac.signal)
      .then((d) => setData({ state: "ok", feeds: d.feeds || [], shows: d.shows || [], stations: d.stations || [] }))
      .catch((err) => { if (err.name !== "AbortError") setData({ state: "error", feeds: [], shows: [], stations: [], error: err.message }); });
    return () => ac.abort();
  }, [url]);
  return data;
}

function CountrySelect({ country, setCountry }) {
  return (
    <label className="select-pill">
      <span className="sr-only">Country</span>
      <select value={country || "us"} onChange={(e) => setCountry(e.target.value)}>
        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
      <Icon name="down" />
    </label>
  );
}

function Switcher({ value, onChange, options, label }) {
  return (
    <div className="switcher" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.icon ? <Icon name={o.icon} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chips({ items, value, onChange, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {items.map((v) => (
        <button key={v.label} className="chip" aria-pressed={v.label === value.label} onClick={() => onChange(v)}>{v.label}</button>
      ))}
    </div>
  );
}

function Heading({ title, note }) {
  return (
    <>
      <h2 className="browse-h">{title}</h2>
      {note ? <p className="sec-note">{note}</p> : null}
    </>
  );
}

function EpisodeCard({ show, ep, onPlay }) {
  const player = usePlayer();
  const now = player.ep && player.ep.id === ep.id;
  const playing = now && player.playing;
  const resume = (player.store && player.store.resume[ep.id]) || 0;
  const pct = now && player.phase === "content" && player.dur ? player.pos / player.dur : ep.duration ? resume / ep.duration : 0;
  return (
    <button className={`row${now ? " now" : ""}`} onClick={() => (now ? player.toggle() : onPlay(show, ep, []))} aria-label={`${playing ? "Pause" : "Play"} ${ep.title}`}>
      <Art id={show.id} src={ep.image || show.image} title={show.title} />
      <span className="meta">
        <b>{ep.title}</b>
        <span className="sub">{show.title}{ep.isVideo ? ", video" : ""}</span>
        {pct > 0 ? <span className="bar"><i style={{ width: `${Math.max(3, Math.min(100, pct * 100))}%` }} /></span> : null}
      </span>
      <span className="go"><Icon name={playing ? "pause" : "play"} /></span>
    </button>
  );
}

// A grid of shows. Opening one expands its details right below its row; the rows after it move down.
function ShowGrid({ gridId, data, open, onToggle, onClose, onPlay, emptyText }) {
  const gridRef = useRef(null);
  const [cols, setCols] = useState(2);
  const feeds = data.feeds;

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setCols(Math.max(1, getComputedStyle(el).gridTemplateColumns.split(" ").filter((t) => t && t !== "0px").length));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data.state, feeds.length]);

  const openIdx = open && open.origin === gridId ? feeds.findIndex((f) => `pi:${f.id}` === open.key) : -1;
  const insertAfter = openIdx >= 0 ? Math.min(feeds.length - 1, Math.floor(openIdx / cols) * cols + cols - 1) : -1;
  const caret = openIdx >= 0 ? (((openIdx % cols) + 0.5) / cols) * 100 : null;

  useEffect(() => {
    if (openIdx < 0 || !gridRef.current) return;
    const tile = gridRef.current.querySelector(`[data-tile="${feeds[openIdx].id}"]`);
    if (tile) setTimeout(() => tile.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIdx]);

  if (data.state === "error") return <div className="empty" role="alert"><b>Shows didn't load.</b>{data.error}</div>;
  if (data.state === "loading" && !feeds.length) return <SkeletonGrid gridRef={gridRef} />;
  if (!feeds.length) return <div className="empty">{emptyText}</div>;

  const items = [];
  feeds.forEach((f, i) => {
    const selected = i === openIdx;
    items.push(
      <button key={f.id} data-tile={f.id} className={`tile${selected ? " selected" : ""}`} onClick={() => onToggle(`pi:${f.id}`, gridId)} aria-expanded={selected}>
        <span className="tile-art">
          <Art id={f.id} src={f.image} title={f.title} />
          {f.medium === "video" ? <span className="fmt-pill"><Icon name="video" />Watch</span> : null}
        </span>
        <b>{f.title}</b>
        {f.author ? <span className="tsub">{f.author}</span> : null}
      </button>
    );
    if (i === insertAfter) {
      items.push(
        <div key={`panel-${open.key}`} className="grid-panel">
          <ShowPanel showKey={open.key} onClose={onClose} onPlay={onPlay} caret={caret} />
        </div>
      );
    }
  });
  return <div className={`grid${data.state === "loading" ? " dim" : ""}`} ref={gridRef}>{items}</div>;
}

function SkeletonGrid({ gridRef }) {
  return (
    <div className="grid" ref={gridRef} aria-busy="true" aria-label="Loading">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="tile skel-tile"><span className="art skel" /><span className="skel skel-line" /></div>
      ))}
    </div>
  );
}

// Ranked list (Top and Rising). Rows expand in place like the grid.
function ChartList({ shows, state, error, open, onToggle, onClose, onPlay, emptyText }) {
  useEffect(() => {
    if (!open || open.origin !== "chart") return;
    const el = document.querySelector(`[data-chart="${open.key}"]`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, [open]);

  if (state === "error") return <div className="empty" role="alert"><b>Rankings didn't load.</b>{error}</div>;
  if (state === "loading" && !shows.length) {
    return (
      <ol className="chart" aria-busy="true" aria-label="Loading rankings">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i}><div className="crow"><span className="rank">{i + 1}</span><span className="art skel" /><span className="meta"><span className="skel skel-line" /></span></div></li>
        ))}
      </ol>
    );
  }
  if (!shows.length) return <div className="empty">{emptyText}</div>;
  return (
    <ol className={`chart${state === "loading" ? " dim" : ""}`}>
      {shows.map((s) => {
        const key = s.itunesId ? `it:${s.itunesId}` : `pi:${s.id}`;
        const selected = open && open.origin === "chart" && open.key === key;
        return (
          <li key={key} data-chart={key}>
            <button className={`crow${selected ? " selected" : ""}`} onClick={() => onToggle(key, "chart")} aria-expanded={selected}>
              <span className="rank" aria-label={`Number ${s.rank}`}>{s.rank}</span>
              <Art id={s.itunesId || s.id} src={s.image} title={s.title} />
              <span className="meta">
                <b>{s.title}</b>
                {s.author ? <span className="sub">{s.author}</span> : null}
              </span>
            </button>
            {selected ? (
              <div className="chart-panel"><ShowPanel showKey={key} onClose={onClose} onPlay={onPlay} caret={12} /></div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- podcasts ---------- */

function PodTrending({ medium, panel }) {
  const [vibe, setVibe] = useState(VIBES[0]);
  const watch = medium === "watch";
  const url = watch
    ? `/api/video?sort=fresh${vibe.cat ? `&cat=${encodeURIComponent(vibe.cat)}` : ""}`
    : `/api/trending${vibe.cat ? `?cat=${encodeURIComponent(vibe.cat)}` : ""}`;
  const data = useFeed(url);
  // Some categories are thin on Podcast Index; fall back to a search so the grid is never empty
  const fallbackUrl = !watch && vibe.q && data.state === "ok" && !data.feeds.length ? `/api/search?q=${encodeURIComponent(vibe.q)}` : null;
  const fallback = useFeed(fallbackUrl);
  const shown = fallbackUrl ? fallback : data;
  return (
    <section className="sec">
      <Heading
        title={watch ? (vibe.cat ? `Fresh ${vibe.label.toLowerCase()} to watch` : "Fresh to watch") : vibe.cat ? `Trending in ${vibe.label.toLowerCase()}` : "Trending now"}
        note={watch ? "Video podcasts with the newest episodes." : null}
      />
      <Chips items={VIBES} value={vibe} onChange={setVibe} label="Filter by category" />
      <ShowGrid gridId="trending" data={shown} {...panel} emptyText={watch ? "No video shows in this category yet. Try another." : "No shows here right now. Try another category."} />
    </section>
  );
}

function PodChart({ mode, medium, country, panel }) {
  const [vibe, setVibe] = useState(VIBES[0]);
  const c = findCountry(country);
  const watch = medium === "watch";
  const g = vibe.cat ? vibe.label.toLowerCase() : "";
  const catParam = vibe.cat ? `&cat=${encodeURIComponent(vibe.cat)}` : "";
  const url = !country ? null
    : watch ? `/api/video?sort=${mode}${catParam}`
    : mode === "top" ? `/api/charts?country=${country}${vibe.apple ? `&genre=${encodeURIComponent(vibe.apple)}` : ""}`
    : `/api/rising?lang=${c.lang}${catParam}`;
  const data = useFeed(url);

  let title, note, empty;
  if (watch) {
    title = mode === "top" ? `Top ${g ? `${g} ` : ""}video podcasts` : `Rising ${g ? `${g} ` : ""}video podcasts`;
    note = mode === "top" ? "The biggest video shows that are still publishing, worldwide." : "Newer video shows posting regularly, worldwide.";
    empty = "No video shows in this genre yet. Try another, or switch to Listen.";
  } else if (mode === "top") {
    title = g ? `Top ${g} in ${c.name}` : `Top podcasts in ${c.name}`;
    note = g
      ? `The ${g} shows among the 100 most popular on Apple Podcasts in ${c.name}.`
      : `The 50 most popular shows on Apple Podcasts in ${c.name} right now.`;
    empty = `No ${g} shows in ${c.name}'s top 100 today. Try Rising, or another genre.`;
  } else {
    title = g ? `Rising in ${g}` : `Rising in ${c.langName}`;
    note = `${c.langName}-language ${g ? `${g} ` : ""}shows climbing fastest over the last few days.`;
    empty = "Nothing rising in this genre right now. Try another.";
  }
  return (
    <section className="sec">
      <Heading title={title} note={note} />
      <Chips items={VIBES} value={vibe} onChange={setVibe} label="Filter by genre" />
      <ChartList shows={data.shows} state={data.state} error={data.error} {...panel} emptyText={empty} />
    </section>
  );
}

function PodForYou({ medium, panel }) {
  const player = usePlayer();
  const store = player.store;
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState([]);
  const watch = medium === "watch";

  const { cats, basis, heard } = useMemo(() => {
    if (!store) return { cats: [], basis: [], heard: new Set() };
    const counts = {};
    store.recent.forEach((r) => (r.show.categories || []).forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
    Object.values(store.favShows || {}).forEach((s) => (s.categories || []).forEach((c) => { counts[c] = (counts[c] || 0) + 2; }));
    const fromHistory = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c]) => c);
    const all = [...new Set([...(store.vibes || []), ...fromHistory])].slice(0, 5);
    const labels = all.map((c) => (VIBES.find((v) => v.cat === c) || { label: c }).label.toLowerCase());
    return { cats: all, basis: labels, heard: new Set(store.recent.map((r) => String(r.show.id))) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, player.storeVersion]);

  const catKey = cats.join(",");
  const url = !catKey || editing ? null : watch ? `/api/video?sort=fresh&cat=${encodeURIComponent(catKey)}` : `/api/trending?cat=${encodeURIComponent(catKey)}`;
  const data = useFeed(url);
  if (!store) return null;

  if (editing || !cats.length) {
    return (
      <VibePicker
        title="What are you into?"
        note="Pick a few and we'll build a feed for you. It gets sharper as you listen and favorite."
        options={PICKABLE.map((v) => ({ id: v.cat, label: v.label }))}
        picked={picked}
        setPicked={setPicked}
        onDone={() => { player.updateStore((s) => { s.vibes = picked; }); setEditing(false); }}
      />
    );
  }
  const feeds = data.feeds.filter((f) => !heard.has(String(f.id)));
  return (
    <section className="sec">
      <Heading title={watch ? "Picked for you to watch" : "Picked for you"} />
      <p className="sec-note">Based on {basis.join(", ")}. <button className="text-btn" onClick={() => { setPicked(store.vibes || []); setEditing(true); }}>Change</button></p>
      <ShowGrid gridId="foryou" data={{ ...data, feeds }} {...panel} emptyText={watch ? "No video shows match your picks yet. Switch to Listen or add more picks." : "Nothing new to suggest right now. Try adding a few more picks."} />
    </section>
  );
}

function VibePicker({ title, note, options, picked, setPicked, onDone }) {
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((c) => c !== id) : [...p, id]));
  return (
    <section className="sec">
      <Heading title={title} note={note} />
      <div className="chips" role="group" aria-label="Pick what you like">
        {options.map((o) => (
          <button key={o.id} className="chip" aria-pressed={picked.includes(o.id)} onClick={() => toggle(o.id)}>{o.label}</button>
        ))}
      </div>
      <div className="center">
        <button className="cta" disabled={!picked.length} onClick={onDone}>
          {picked.length ? `Build my feed (${picked.length})` : "Pick at least one"}
        </button>
      </div>
    </section>
  );
}

function PodFavorites({ panel }) {
  const player = usePlayer();
  const store = player.store;
  if (!store) return null;
  const shows = Object.values(store.favShows || {}).sort((a, b) => b.savedAt - a.savedAt);
  const eps = Object.values(store.favEps || {}).filter((r) => !r.ep.live).sort((a, b) => b.savedAt - a.savedAt);
  return (
    <section className="sec">
      <Heading title="Your favorite podcasts" note="Tap the heart on any show or episode to keep it here." />
      {!shows.length && !eps.length ? <div className="empty"><b>Nothing saved yet.</b>Open a show and tap the heart.</div> : null}
      {eps.length ? (
        <>
          <h3 className="sub-h">Episodes</h3>
          <div className="list">{eps.map((r) => <EpisodeCard key={r.ep.id} show={r.show} ep={r.ep} onPlay={panel.onPlay} />)}</div>
        </>
      ) : null}
      {shows.length ? (
        <>
          <h3 className="sub-h">Shows</h3>
          <ShowGrid gridId="favorites" data={{ state: "ok", feeds: shows }} {...panel} emptyText="" />
        </>
      ) : null}
    </section>
  );
}

/* ---------- LIVE radio ---------- */

function StationGrid({ data, emptyText }) {
  const player = usePlayer();
  if (data.state === "error") return <div className="empty" role="alert"><b>Stations didn't load.</b>{data.error}</div>;
  if (data.state === "loading" && !data.stations.length) return <SkeletonGrid />;
  if (!data.stations.length) return <div className="empty">{emptyText}</div>;
  return (
    <div className={`grid${data.state === "loading" ? " dim" : ""}`}>
      {data.stations.map((st) => {
        const now = player.ep && player.ep.id === `radio-${st.id}`;
        const on = now && player.playing;
        const fav = player.isFavStation(st.id);
        return (
          <div key={st.id} className={`tile station${now ? " selected" : ""}`}>
            <button className="station-play" onClick={() => player.playStation(st)} aria-label={`${on ? "Pause" : "Play"} ${st.name}`}>
              <span className="station-art">
                <Art id={st.id} src={st.image} title={st.name} fit="contain" />
                <span className={`live-pill${on ? " on" : ""}`}>{on ? "Playing" : "Live"}</span>
              </span>
              <b>{st.name}</b>
              <span className="tsub">{st.tags && st.tags.length ? st.tags.join(", ") : st.country}</span>
            </button>
            <button className={`round-btn sm station-fav${fav ? " on" : ""}`} aria-pressed={fav} onClick={() => player.toggleFavStation(st)} aria-label={fav ? `Remove ${st.name} from favorites` : `Save ${st.name} to favorites`}>
              <Icon name={fav ? "heartFill" : "heart"} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function LiveList({ order, country }) {
  const [genre, setGenre] = useState(GENRES[0]);
  const c = findCountry(country);
  const url = country ? `/api/radio?country=${country}&tags=${encodeURIComponent(genre.tag)}&order=${order}` : null;
  const data = useFeed(url);
  const copy = {
    trending: [`Trending live in ${c.name}`, "The stations most people are tuning into right now."],
    top: [`Top stations in ${c.name}`, "The all-time favorites, ranked by listener votes."],
    rising: [`Rising in ${c.name}`, "Stations climbing fastest over the last few days."],
  }[order];
  return (
    <section className="sec">
      <Heading title={copy[0]} note={copy[1]} />
      <Chips items={GENRES} value={genre} onChange={setGenre} label="Filter by genre" />
      <StationGrid data={data} emptyText="No stations found for this mix. Try another genre or country." />
    </section>
  );
}

function LiveForYou({ country }) {
  const player = usePlayer();
  const store = player.store;
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState([]);

  const { tags, basis } = useMemo(() => {
    if (!store) return { tags: [], basis: [] };
    const counts = {};
    (store.recentStations || []).forEach((s) => (s.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    Object.values(store.favStations || {}).forEach((s) => (s.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 2; }));
    const known = new Set(PICKABLE_GENRES.map((g) => g.tag));
    const fromHistory = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t]) => t).filter((t) => known.has(t));
    const all = [...new Set([...(store.liveVibes || []), ...fromHistory])].slice(0, 3);
    return { tags: all, basis: all.map((t) => (GENRES.find((g) => g.tag === t) || { label: t }).label.toLowerCase()) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, player.storeVersion]);

  const url = tags.length && country && !editing ? `/api/radio?country=${country}&tags=${encodeURIComponent(tags.join(","))}&order=trending` : null;
  const data = useFeed(url);
  if (!store) return null;

  if (editing || !tags.length) {
    return (
      <VibePicker
        title="What do you like to hear?"
        note="Pick up to three and we'll line up stations for you."
        options={PICKABLE_GENRES.map((g) => ({ id: g.tag, label: g.label }))}
        picked={picked}
        setPicked={(fn) => setPicked((p) => { const next = typeof fn === "function" ? fn(p) : fn; return next.slice(-3); })}
        onDone={() => { player.updateStore((s) => { s.liveVibes = picked; }); setEditing(false); }}
      />
    );
  }
  return (
    <section className="sec">
      <Heading title="Stations for you" />
      <p className="sec-note">Based on {basis.join(", ")} in {findCountry(country).name}. <button className="text-btn" onClick={() => { setPicked(store.liveVibes || []); setEditing(true); }}>Change</button></p>
      <StationGrid data={data} emptyText="No matching stations right now. Try different picks or another country." />
    </section>
  );
}

function LiveFavorites() {
  const player = usePlayer();
  const store = player.store;
  if (!store) return null;
  const stations = Object.values(store.favStations || {}).sort((a, b) => b.savedAt - a.savedAt);
  return (
    <section className="sec">
      <Heading title="Your favorite stations" note="Tap the heart on any station to keep it here." />
      <StationGrid data={{ state: "ok", stations }} emptyText="No stations saved yet. Tap the heart on one you like." />
    </section>
  );
}
