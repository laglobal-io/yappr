"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PlayerProvider, usePlayer } from "./PlayerProvider";
import { AuthProvider, useAuth } from "./AuthProvider";
import { NowBar, DebugPanel } from "./Player";
import ShowPanel from "./ShowPanel";
import { AccountCard, HeaderAccount } from "./Account";
import Art from "./Art";
import Icon from "./Icon";
import Footer from "./Footer";
import LogoMark from "./Logo";
import { getJSON } from "@/lib/api";
import { COUNTRIES, findCountry, isCountry } from "@/lib/countries";

/* ---------- vocab ---------- */

// Podcast categories. `cat` = Podcast Index name, `apple` = Apple genre (Top charts), `q` = fallback search.
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
// Radio genres (Radio Browser tags)
const GENRES = [
  { label: "All", tag: "" }, { label: "Talk", tag: "talk" }, { label: "News", tag: "news" }, { label: "Pop", tag: "pop" },
  { label: "Rock", tag: "rock" }, { label: "Hip hop", tag: "hiphop" }, { label: "Jazz", tag: "jazz" }, { label: "Classical", tag: "classical" },
  { label: "Country", tag: "country" }, { label: "Dance", tag: "dance" }, { label: "Sports", tag: "sports" },
];
const MODES = [
  { id: "podcasts", label: "Podcasts", icon: "headphones" },
  { id: "video", label: "Video", icon: "video" },
  { id: "live", label: "Live" },
];
const VIEWS = ["home", "search", "library"];
const SHELF_MAX = 12;

/* ---------- app ---------- */

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
  const auth = useAuth();
  const [view, setView] = useState("home"); // home | search | library | list
  const [list, setList] = useState(null); // the "See all" page
  const [mode, setModeState] = useState("podcasts");
  const [genre, setGenre] = useState("All");
  const [open, setOpen] = useState(initialShow ? { key: `pi:${initialShow}`, origin: "top", focusEp: initialEp } : null);
  const [country, setCountryState] = useState(null);
  const [debug, setDebug] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const topRef = useRef(null);
  const store = player.store;

  // Restore view/mode from the address bar (#library, #live, #video…) and saved preferences
  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("debug"));
    const h = window.location.hash.replace("#", "");
    if (VIEWS.includes(h)) setView(h);
    if (MODES.some((m) => m.id === h)) setModeState(h);
  }, []);
  const storeReady = !!store;
  useEffect(() => {
    if (!storeReady) return;
    if (!window.location.hash && store.mode && MODES.some((m) => m.id === store.mode)) setModeState(store.mode);
    if (store.country && isCountry(store.country)) setCountryState(store.country);
    else getJSON("/api/geo").then((d) => setCountryState(d.country)).catch(() => setCountryState("us"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeReady]);

  const setHash = (h) => {
    try { window.history.replaceState(null, "", window.location.pathname + window.location.search + (h ? `#${h}` : "")); } catch { /* ignore */ }
  };
  const nav = useCallback((v) => {
    setView(v);
    setOpen((o) => (o && o.origin === "top" && v === "home" ? o : null));
    setHash(v === "home" ? (mode === "podcasts" ? "" : mode) : v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [mode]);
  const setMode = useCallback((m) => {
    setModeState(m);
    setGenre("All");
    setOpen((o) => (o && o.origin === "top" ? o : null));
    player.setMedium(m === "video" ? "watch" : "listen");
    player.updateStore((s) => { s.mode = m; });
    if (view === "home") setHash(m === "podcasts" ? "" : m);
  }, [player, view]);
  const setCountry = useCallback((c) => {
    setCountryState(c);
    player.updateStore((s) => { s.country = c; });
  }, [player]);

  // "Sign in for alerts" (in a show's details) asks the auth layer to open sign-in: send people to the Library
  useEffect(() => {
    if (auth.menuOpen) { auth.setMenuOpen(false); nav("library"); }
  }, [auth.menuOpen, auth, nav]);

  const toggleShow = useCallback((key, origin, caret) => {
    setOpen((o) => (o && o.key === key && o.origin === origin ? null : { key, origin, caret }));
  }, []);
  const closeShow = useCallback(() => setOpen(null), []);
  const openFromBar = useCallback((id) => {
    if (String(id).startsWith("radio:")) { setMode("live"); nav("home"); return; }
    setView("home");
    setOpen({ key: `pi:${id}`, origin: "top" });
  }, [setMode, nav]);
  useEffect(() => {
    if (open && open.origin === "top" && topRef.current) topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open]);

  const seeAll = useCallback((def) => {
    setList(def);
    setView("list");
    setOpen(null);
    window.scrollTo({ top: 0 });
  }, []);

  const startPlay = useCallback((show, ep, queue) => player.play(show, ep, queue), [player]);
  const panel = { open, onToggle: toggleShow, onClose: closeShow, onPlay: startPlay };

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
    setOpen(null);
    nav("home");
  };

  const firstVisit = !!store && !auth.user && !store.recent.length && !Object.keys(store.favShows || {}).length && !(store.recentStations || []).length;
  const activeNav = view === "list" ? "home" : view;

  return (
    <>
      <header className="top">
        <a className="logo" href="/" onClick={goHome} aria-label="yappr home">
          <LogoMark />
          <span>yappr</span>
        </a>
        <nav className="top-nav" aria-label="Main">
          <NavButtons active={activeNav} nav={nav} />
        </nav>
        <div className="top-actions">
          {debug ? (
            <button className="icon-btn" onClick={() => setDebugOpen((o) => !o)} aria-label="Show ad events" aria-expanded={debugOpen}><Icon name="wave" /></button>
          ) : null}
          <button className="icon-btn" onClick={toggleTheme} aria-label="Switch light or dark theme"><Icon name="theme" /></button>
          <HeaderAccount onOpen={() => nav("library")} />
        </div>
      </header>

      <main className="wrap">
        {open && open.origin === "top" ? (
          <div className="sec top-panel" ref={topRef}>
            <ShowPanel key={open.key} showKey={open.key} focusEp={open.focusEp} onClose={closeShow} onPlay={startPlay} />
          </div>
        ) : null}

        {view === "home" ? (
          <Home
            mode={mode} setMode={setMode} genre={genre} setGenre={setGenre}
            country={country} setCountry={setCountry} panel={panel} seeAll={seeAll} firstVisit={firstVisit}
          />
        ) : view === "search" ? (
          <SearchView mode={mode} panel={panel} />
        ) : view === "library" ? (
          <Library panel={panel} seeAll={seeAll} nav={nav} />
        ) : (
          <ListView def={list} panel={panel} onBack={() => nav("home")} />
        )}
        <Footer />
      </main>

      <nav className="bottom-nav" aria-label="Main">
        <NavButtons active={activeNav} nav={nav} />
      </nav>
      <NowBar onOpenShow={openFromBar} />
      {debug ? <DebugPanel open={debugOpen} onClose={() => setDebugOpen(false)} /> : null}
      <div className={`toast${player.toast ? " show" : ""}`} role="status" aria-live="polite">{player.toast}</div>
    </>
  );
}

function NavButtons({ active, nav }) {
  const items = [
    { id: "home", label: "Home", icon: "home" },
    { id: "search", label: "Search", icon: "search" },
    { id: "library", label: "Library", icon: "library" },
  ];
  return items.map((i) => (
    <button key={i.id} className="nav-btn" aria-current={active === i.id ? "page" : undefined} onClick={() => nav(i.id)}>
      <Icon name={i.icon} />
      <span>{i.label}</span>
    </button>
  ));
}

/* ---------- data + small pieces ---------- */

function useFeed(url) {
  const [data, setData] = useState({ state: url ? "loading" : "idle", feeds: [], shows: [], stations: [], episodes: [] });
  useEffect(() => {
    if (!url) { setData({ state: "idle", feeds: [], shows: [], stations: [], episodes: [] }); return; }
    const ac = new AbortController();
    setData((d) => ({ ...d, state: "loading" }));
    getJSON(url, ac.signal)
      .then((d) => setData({ state: "ok", feeds: d.feeds || [], shows: d.shows || [], stations: d.stations || [], episodes: d.episodes || [] }))
      .catch((err) => { if (err.name !== "AbortError") setData({ state: "error", feeds: [], shows: [], stations: [], episodes: [], error: err.message }); });
    return () => ac.abort();
  }, [url]);
  return data;
}

// "Top in United States ⌄": the country lives in the heading, where it matters
function InlineCountry({ country, setCountry }) {
  return (
    <label className="inline-select">
      <span className="sr-only">Country</span>
      <select value={country || "us"} onChange={(e) => setCountry(e.target.value)}>
        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
      <span aria-hidden="true">{findCountry(country).name}</span>
      <Icon name="down" />
    </label>
  );
}

function ChipRow({ items, value, onChange, label }) {
  return (
    <div className="chip-row" role="group" aria-label={label}>
      {items.map((v) => (
        <button key={v.label} className="chip" aria-pressed={v.label === value} onClick={() => onChange(v.label)}>{v.label}</button>
      ))}
    </div>
  );
}

function ShowTile({ f, rank, selected, onClick }) {
  return (
    <button className={`tile${selected ? " selected" : ""}`} data-tile={f.id || f.itunesId} onClick={onClick} aria-expanded={selected}>
      <span className="tile-art">
        <Art id={f.itunesId || f.id} src={f.image} title={f.title} />
        {rank ? <span className="rank-badge">{rank}</span> : null}
        {f.medium === "video" ? <span className="fmt-pill"><Icon name="video" />Watch</span> : null}
        {f.isNew ? <span className="new-dot">New</span> : null}
      </span>
      <b>{f.title}</b>
      {f.author ? <span className="tsub">{f.author}</span> : null}
    </button>
  );
}

function StationTile({ st }) {
  const player = usePlayer();
  const now = player.ep && player.ep.id === `radio-${st.id}`;
  const on = now && player.playing;
  const fav = player.isFavStation(st.id);
  return (
    <div className={`tile station${now ? " selected" : ""}`}>
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
}

function EpisodeCard({ show, ep, onPlay, queue }) {
  const player = usePlayer();
  const now = player.ep && player.ep.id === ep.id;
  const playing = now && player.playing;
  const resume = (player.store && player.store.resume[ep.id]) || 0;
  const played = player.store && player.store.played[ep.id];
  const pct = now && player.phase === "content" && player.dur ? player.pos / player.dur : ep.duration && !played ? resume / ep.duration : 0;
  return (
    <button className={`row${now ? " now" : ""}`} onClick={() => (now ? player.toggle() : onPlay(show, ep, queue || []))} aria-label={`${playing ? "Pause" : "Play"} ${ep.title}`}>
      <Art id={show.id} src={ep.image || show.image} title={show.title} />
      <span className="meta">
        <b>{ep.title}</b>
        <span className="sub">{show.title}{ep.isVideo ? ", video" : ""}{played ? ", played" : ""}</span>
        {pct > 0 ? <span className="bar"><i style={{ width: `${Math.max(3, Math.min(100, pct * 100))}%` }} /></span> : null}
      </span>
      <span className="go"><Icon name={playing ? "pause" : "play"} /></span>
    </button>
  );
}

/* ---------- shelves: a titled row that scrolls sideways, with "See all" ---------- */

function Shelf({ id, title, note, kind, items, state, error, ranked, panel, onSeeAll, emptyText, keyFor, children }) {
  const ref = useRef(null);
  const loading = state === "loading" && !items.length;
  if (state === "error") {
    return (
      <section className="shelf">
        <div className="shelf-head"><h2>{title}</h2></div>
        <div className="empty small" role="alert"><b>This row didn't load.</b>{error}</div>
      </section>
    );
  }
  if (!loading && !items.length && !emptyText && !children) return null;

  const openHere = panel && panel.open && panel.open.origin === id ? panel.open : null;
  const clickShow = (e, key) => {
    const box = ref.current.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    const caret = Math.max(4, Math.min(96, ((r.left + r.width / 2 - box.left) / box.width) * 100));
    panel.onToggle(key, id, caret);
  };

  return (
    <section className="shelf" ref={ref} aria-labelledby={`shelf-${id}`}>
      <div className="shelf-head">
        <div>
          <h2 id={`shelf-${id}`}>{title}</h2>
          {note ? <p className="shelf-note">{note}</p> : null}
        </div>
        {onSeeAll && items.length > 4 ? <button className="see-all" onClick={onSeeAll}>See all</button> : null}
      </div>
      {children ? children : loading ? (
        <div className="shelf-row" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="tile skel-tile"><span className="art skel" /><span className="skel skel-line" /></div>)}
        </div>
      ) : !items.length ? (
        <div className="empty small">{emptyText}</div>
      ) : (
        <div className={`shelf-row${kind === "episodes" ? " wide" : ""}${state === "loading" ? " dim" : ""}`}>
          {items.slice(0, SHELF_MAX).map((it, i) => {
            if (kind === "stations") return <StationTile key={it.id} st={it} />;
            if (kind === "episodes") return <EpisodeCard key={it.ep.id} show={it.show} ep={it.ep} onPlay={panel.onPlay} queue={it.queue} />;
            const key = keyFor(it);
            return <ShowTile key={key} f={it} rank={ranked ? it.rank || i + 1 : null} selected={openHere && openHere.key === key} onClick={(e) => clickShow(e, key)} />;
          })}
        </div>
      )}
      {openHere ? (
        <div className="shelf-panel">
          <ShowPanel key={openHere.key} showKey={openHere.key} onClose={panel.onClose} onPlay={panel.onPlay} caret={openHere.caret} />
        </div>
      ) : null}
    </section>
  );
}

const showKey = (f) => (f.itunesId ? `it:${f.itunesId}` : `pi:${f.id}`);

// A shelf whose items come from one of our API routes
function FeedShelf({ url, pick = "feeds", fallbackUrl, ...rest }) {
  const data = useFeed(url);
  const needFallback = fallbackUrl && data.state === "ok" && !data[pick].length && !data.feeds.length;
  const fb = useFeed(needFallback ? fallbackUrl : null);
  const d = needFallback ? fb : data;
  const items = d[pick].length ? d[pick] : d.feeds;
  return <Shelf items={items} state={d.state} error={d.error} keyFor={showKey} {...rest} />;
}

/* ---------- Home ---------- */

function Home({ mode, setMode, genre, setGenre, country, setCountry, panel, seeAll, firstVisit }) {
  return (
    <>
      {firstVisit ? (
        <section className="welcome">
          <h1>What are we yapping to?</h1>
          <p className="pitch">Every Podcast. Every Creator.</p>
        </section>
      ) : null}
      <div className="home-controls">
        <div className="mode-switch" role="tablist" aria-label="What to browse">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)}>
              {m.icon ? <Icon name={m.icon} /> : <span className="live-dot" aria-hidden="true" />}
              {m.label}
            </button>
          ))}
        </div>
        <ChipRow items={mode === "live" ? GENRES : VIBES} value={genre} onChange={setGenre} label="Filter by genre" />
      </div>
      {mode === "podcasts" ? <PodcastHome genre={genre} country={country} setCountry={setCountry} panel={panel} seeAll={seeAll} />
        : mode === "video" ? <VideoHome genre={genre} panel={panel} seeAll={seeAll} />
        : <LiveHome genre={genre} country={country} setCountry={setCountry} seeAll={seeAll} />}
    </>
  );
}

function usePersonal() {
  const player = usePlayer();
  const store = player.store;
  return useMemo(() => {
    if (!store) return { recent: [], favShows: [], favIds: [], cats: [], cat: "", stations: [], favStations: [], tags: [] };
    const recent = store.recent.filter((r) => !store.played[r.ep.id] && !r.ep.live);
    const favShows = Object.values(store.favShows || {}).sort((a, b) => b.savedAt - a.savedAt);
    const counts = {};
    store.recent.forEach((r) => (r.show.categories || []).forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
    favShows.forEach((s) => (s.categories || []).forEach((c) => { counts[c] = (counts[c] || 0) + 2; }));
    const cats = [...new Set([...(store.vibes || []), ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c]) => c)])].slice(0, 5);
    const tagCounts = {};
    const known = new Set(GENRES.map((g) => g.tag).filter(Boolean));
    (store.recentStations || []).forEach((s) => (s.tags || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    Object.values(store.favStations || {}).forEach((s) => (s.tags || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 2; }));
    const tags = [...new Set([...(store.liveVibes || []), ...Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).map(([t]) => t).filter((t) => known.has(t))])].slice(0, 3);
    return {
      recent, favShows, favIds: favShows.map((s) => String(s.id)).filter((id) => /^\d+$/.test(id)),
      cats, stations: store.recentStations || [],
      favStations: Object.values(store.favStations || {}).sort((a, b) => b.savedAt - a.savedAt), tags,
      heard: new Set(store.recent.map((r) => String(r.show.id))),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, player.storeVersion]);
}

// Episodes from shows you follow, newest first, matched to the saved show details
function useFollowing() {
  const p = usePersonal();
  const data = useFeed(p.favIds.length ? `/api/latest?ids=${p.favIds.join(",")}` : null);
  const byId = useMemo(() => Object.fromEntries(p.favShows.map((s) => [String(s.id), s])), [p.favShows]);
  const items = useMemo(() => data.episodes
    .filter((e) => byId[e.feedId])
    .map((e) => ({ show: byId[e.feedId], ep: e })), [data.episodes, byId]);
  return { ...data, items };
}

function PickerCard({ title, note, options, onSave, max }) {
  const [picked, setPicked] = useState([]);
  const toggle = (id) => setPicked((p) => {
    const next = p.includes(id) ? p.filter((x) => x !== id) : [...p, id];
    return max ? next.slice(-max) : next;
  });
  return (
    <div className="picker-card">
      <b>{title}</b>
      <p>{note}</p>
      <div className="chips" role="group" aria-label={title}>
        {options.map((o) => <button key={o.id} className="chip" aria-pressed={picked.includes(o.id)} onClick={() => toggle(o.id)}>{o.label}</button>)}
      </div>
      <button className="cta" disabled={!picked.length} onClick={() => onSave(picked)}>{picked.length ? `Build my feed (${picked.length})` : "Pick at least one"}</button>
    </div>
  );
}

function PodcastHome({ genre, country, setCountry, panel, seeAll }) {
  const player = usePlayer();
  const p = usePersonal();
  const following = useFollowing();
  const v = VIBES.find((x) => x.label === genre) || VIBES[0];
  const g = v.cat ? v.label.toLowerCase() : "";
  const c = findCountry(country);
  const catQ = v.cat ? `cat=${encodeURIComponent(v.cat)}` : "";
  const trendingUrl = `/api/trending${catQ ? `?${catQ}` : ""}`;
  const topUrl = country ? `/api/charts?country=${country}${v.apple ? `&genre=${encodeURIComponent(v.apple)}` : ""}` : null;
  const risingUrl = country ? `/api/rising?lang=${c.lang}${catQ ? `&${catQ}` : ""}` : null;
  const forYouCats = v.cat ? [v.cat] : p.cats;
  const forYouUrl = forYouCats.length ? `/api/trending?cat=${encodeURIComponent(forYouCats.join(","))}` : null;
  const fallback = v.q ? `/api/search?q=${encodeURIComponent(v.q)}` : null;

  return (
    <div className="shelves">
      {!v.cat && p.recent.length ? (
        <Shelf id="keep" title="Keep listening" kind="episodes" state="ok" items={p.recent.map((r) => ({ show: r.show, ep: r.ep }))} panel={panel}
          onSeeAll={() => seeAll({ title: "Keep listening", kind: "episodes", items: p.recent.map((r) => ({ show: r.show, ep: r.ep })) })} />
      ) : null}
      {!v.cat && p.favIds.length ? (
        <Shelf id="following" title="New from shows you follow" kind="episodes" items={following.items} state={following.state} error={following.error} panel={panel}
          emptyText="No new episodes in the last 30 days. We'll show them here when they drop."
          onSeeAll={() => seeAll({ title: "New from shows you follow", kind: "episodes", items: following.items })} />
      ) : null}
      <FeedShelf id="top" url={topUrl} pick="shows" ranked panel={panel}
        title={<>Top {g ? `${g} ` : ""}in <InlineCountry country={country} setCountry={setCountry} /></>}
        note={g ? "From Apple Podcasts' top 100" : "On Apple Podcasts right now"}
        emptyText={g ? `No ${g} shows in today's top 100. Check Trending below.` : undefined}
        onSeeAll={() => seeAll({ title: `Top ${g ? `${g} ` : ""}in ${c.name}`, kind: "ranked", url: topUrl, pick: "shows" })} />
      {forYouUrl ? (
        <FeedShelf id="foryou" url={forYouUrl} title={g ? `More ${g} for you` : "Picked for you"} panel={panel}
          note={!g ? `Because you like ${p.cats.slice(0, 3).map((x) => (VIBES.find((y) => y.cat === x) || { label: x }).label.toLowerCase()).join(", ")}` : null}
          onSeeAll={() => seeAll({ title: "Picked for you", kind: "shows", url: forYouUrl })} />
      ) : (
        <Shelf id="foryou" title="Picked for you" items={[]} state="ok" panel={panel}>
          <PickerCard title="What are you into?" note="Pick a few and we'll line up shows for you. It gets sharper as you listen."
            options={VIBES.filter((x) => x.cat).map((x) => ({ id: x.cat, label: x.label }))}
            onSave={(picked) => player.updateStore((s) => { s.vibes = picked; })} />
        </Shelf>
      )}
      <FeedShelf id="trending" url={trendingUrl} fallbackUrl={fallback} title={g ? `Trending in ${g}` : "Trending now"} panel={panel}
        onSeeAll={() => seeAll({ title: g ? `Trending in ${g}` : "Trending now", kind: "shows", url: trendingUrl })} />
      <FeedShelf id="rising" url={risingUrl} pick="shows" ranked title={g ? `Climbing fast in ${g}` : "Climbing fast"} panel={panel}
        note={`${c.langName}-language shows rising over the last few days`}
        onSeeAll={() => seeAll({ title: g ? `Climbing fast in ${g}` : "Climbing fast", kind: "ranked", url: risingUrl, pick: "shows" })} />
    </div>
  );
}

function VideoHome({ genre, panel, seeAll }) {
  const p = usePersonal();
  const v = VIBES.find((x) => x.label === genre) || VIBES[0];
  const g = v.cat ? v.label.toLowerCase() : "";
  const cat = v.cat ? `&cat=${encodeURIComponent(v.cat)}` : "";
  const watching = p.recent.filter((r) => r.ep.isVideo);
  const forYou = !v.cat && p.cats.length ? `/api/video?sort=fresh&cat=${encodeURIComponent(p.cats.join(","))}` : null;
  const rows = [
    { id: "vfresh", title: g ? `New ${g} to watch` : "New to watch", note: "Video podcasts with the newest episodes", url: `/api/video?sort=fresh${cat}`, kind: "shows" },
    { id: "vtop", title: g ? `Top ${g} video podcasts` : "Top video podcasts", note: "The biggest video shows still publishing", url: `/api/video?sort=top${cat}`, kind: "ranked" },
    { id: "vrising", title: g ? `Rising ${g} video podcasts` : "Rising video podcasts", note: "Newer video shows posting often", url: `/api/video?sort=rising${cat}`, kind: "ranked" },
  ];
  return (
    <div className="shelves">
      {!v.cat && watching.length ? (
        <Shelf id="vkeep" title="Keep watching" kind="episodes" state="ok" items={watching.map((r) => ({ show: r.show, ep: r.ep }))} panel={panel} />
      ) : null}
      {forYou ? <FeedShelf id="vforyou" url={forYou} title="Picked for you" panel={panel} onSeeAll={() => seeAll({ title: "Picked for you to watch", kind: "shows", url: forYou })} /> : null}
      {rows.map((r) => (
        <FeedShelf key={r.id} id={r.id} url={r.url} pick="shows" ranked={r.kind === "ranked"} title={r.title} note={r.note} panel={panel}
          emptyText={g ? `No ${g} video shows here yet.` : undefined}
          onSeeAll={() => seeAll({ title: r.title, kind: r.kind, url: r.url, pick: "shows" })} />
      ))}
    </div>
  );
}

function LiveHome({ genre, country, setCountry, seeAll }) {
  const player = usePlayer();
  const p = usePersonal();
  const gg = GENRES.find((x) => x.label === genre) || GENRES[0];
  const g = gg.tag ? gg.label.toLowerCase() : "";
  const c = findCountry(country);
  const base = country ? `/api/radio?country=${country}&tags=${encodeURIComponent(gg.tag)}` : null;
  const forYouTags = gg.tag ? [] : p.tags;
  const rows = base ? [
    { id: "lpop", order: "trending", title: <>{g ? `Popular ${g}` : "Popular now"} in <InlineCountry country={country} setCountry={setCountry} /></>, plain: `${g ? `Popular ${g}` : "Popular now"} in ${c.name}`, note: "Most listened in the last 24 hours" },
    { id: "lrise", order: "rising", title: g ? `Rising ${g} stations` : "Rising stations", note: "Climbing fastest over the last few days" },
    { id: "ltop", order: "top", title: g ? `Top-voted ${g}` : "Top-voted stations", note: "All-time listener favorites" },
  ] : [];
  return (
    <div className="shelves">
      {!gg.tag && p.stations.length ? <Shelf id="lrecent" title="Recently played" kind="stations" state="ok" items={p.stations} /> : null}
      {!gg.tag && p.favStations.length ? <Shelf id="lfav" title="Your stations" kind="stations" state="ok" items={p.favStations} /> : null}
      {rows.map((r) => {
        const url = `${base}&order=${r.order}`;
        return <FeedShelf key={r.id} id={r.id} url={url} pick="stations" kind="stations" title={r.title} note={r.note}
          emptyText="No stations for this mix. Try another genre."
          onSeeAll={() => seeAll({ title: r.plain || r.title, kind: "stations", url, pick: "stations" })} />;
      })}
      {base && forYouTags.length ? (
        <FeedShelf id="lforyou" url={`/api/radio?country=${country}&tags=${encodeURIComponent(forYouTags.join(","))}&order=trending`} pick="stations" kind="stations"
          title="Stations for you" note={`Because you like ${forYouTags.map((t) => (GENRES.find((x) => x.tag === t) || { label: t }).label.toLowerCase()).join(", ")}`} />
      ) : !gg.tag ? (
        <Shelf id="lforyou" title="Stations for you" items={[]} state="ok">
          <PickerCard title="What do you like to hear?" note="Pick up to three and we'll line up stations for you." max={3}
            options={GENRES.filter((x) => x.tag).map((x) => ({ id: x.tag, label: x.label }))}
            onSave={(picked) => player.updateStore((s) => { s.liveVibes = picked; })} />
        </Shelf>
      ) : null}
    </div>
  );
}

/* ---------- "See all" ---------- */

function ListView({ def, panel, onBack }) {
  const data = useFeed(def && def.url ? def.url : null);
  if (!def) return null;
  const items = def.items || (def.pick ? data[def.pick] : data.feeds);
  const state = def.items ? "ok" : data.state;
  return (
    <section className="sec list-view">
      <div className="list-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back to home"><Icon name="back" /></button>
        <h1>{def.title}</h1>
      </div>
      {def.kind === "ranked" ? (
        <ChartList shows={items} state={state} error={data.error} {...panel} origin="list" emptyText="Nothing here right now." />
      ) : def.kind === "stations" ? (
        <StationGrid data={{ state, stations: items, error: data.error }} emptyText="No stations here right now." />
      ) : def.kind === "episodes" ? (
        items.length ? <div className="list">{items.map((it) => <EpisodeCard key={it.ep.id} show={it.show} ep={it.ep} onPlay={panel.onPlay} />)}</div>
          : <div className="empty">Nothing here yet.</div>
      ) : (
        <ShowGrid gridId="list" data={{ state, feeds: items, error: data.error }} {...panel} emptyText="Nothing here right now." />
      )}
    </section>
  );
}

// A grid of shows. Opening one expands its details right below its row; the rows after it move down.
function ShowGrid({ gridId, data, open, onToggle, onClose, onPlay, emptyText, newIds }) {
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

  const openIdx = open && open.origin === gridId ? feeds.findIndex((f) => showKey(f) === open.key) : -1;
  const insertAfter = openIdx >= 0 ? Math.min(feeds.length - 1, Math.floor(openIdx / cols) * cols + cols - 1) : -1;
  const caret = openIdx >= 0 ? (((openIdx % cols) + 0.5) / cols) * 100 : null;

  useEffect(() => {
    if (openIdx < 0 || !gridRef.current) return;
    const tile = gridRef.current.children[openIdx];
    if (tile) setTimeout(() => tile.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIdx]);

  if (data.state === "error") return <div className="empty" role="alert"><b>Shows didn't load.</b>{data.error}</div>;
  if (data.state === "loading" && !feeds.length) {
    return <div className="grid" ref={gridRef} aria-busy="true">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="tile skel-tile"><span className="art skel" /><span className="skel skel-line" /></div>)}</div>;
  }
  if (!feeds.length) return <div className="empty">{emptyText}</div>;

  const items = [];
  feeds.forEach((f, i) => {
    const key = showKey(f);
    items.push(<ShowTile key={key} f={newIds && newIds.has(String(f.id)) ? { ...f, isNew: true } : f} selected={i === openIdx} onClick={() => onToggle(key, gridId)} />);
    if (i === insertAfter) {
      items.push(<div key={`panel-${open.key}`} className="grid-panel"><ShowPanel showKey={open.key} onClose={onClose} onPlay={onPlay} caret={caret} /></div>);
    }
  });
  return <div className={`grid${data.state === "loading" ? " dim" : ""}`} ref={gridRef}>{items}</div>;
}

function ChartList({ shows, state, error, open, onToggle, onClose, onPlay, emptyText, origin = "chart" }) {
  useEffect(() => {
    if (!open || open.origin !== origin) return;
    const el = document.querySelector(`[data-chart="${open.key}"]`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, [open, origin]);
  if (state === "error") return <div className="empty" role="alert"><b>Rankings didn't load.</b>{error}</div>;
  if (state === "loading" && !shows.length) {
    return <ol className="chart" aria-busy="true">{Array.from({ length: 8 }).map((_, i) => <li key={i}><div className="crow"><span className="rank">{i + 1}</span><span className="art skel" /><span className="meta"><span className="skel skel-line" /></span></div></li>)}</ol>;
  }
  if (!shows.length) return <div className="empty">{emptyText}</div>;
  return (
    <ol className={`chart${state === "loading" ? " dim" : ""}`}>
      {shows.map((s, i) => {
        const key = showKey(s);
        const selected = open && open.origin === origin && open.key === key;
        return (
          <li key={key} data-chart={key}>
            <button className={`crow${selected ? " selected" : ""}`} onClick={() => onToggle(key, origin)} aria-expanded={selected}>
              <span className="rank" aria-label={`Number ${s.rank || i + 1}`}>{s.rank || i + 1}</span>
              <Art id={s.itunesId || s.id} src={s.image} title={s.title} />
              <span className="meta"><b>{s.title}</b>{s.author ? <span className="sub">{s.author}</span> : null}</span>
            </button>
            {selected ? <div className="chart-panel"><ShowPanel showKey={key} onClose={onClose} onPlay={onPlay} caret={12} /></div> : null}
          </li>
        );
      })}
    </ol>
  );
}

function StationGrid({ data, emptyText }) {
  if (data.state === "error") return <div className="empty" role="alert"><b>Stations didn't load.</b>{data.error}</div>;
  if (data.state === "loading" && !data.stations.length) {
    return <div className="grid" aria-busy="true">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="tile skel-tile"><span className="art skel" /><span className="skel skel-line" /></div>)}</div>;
  }
  if (!data.stations.length) return <div className="empty">{emptyText}</div>;
  return <div className={`grid${data.state === "loading" ? " dim" : ""}`}>{data.stations.map((st) => <StationTile key={st.id} st={st} />)}</div>;
}

/* ---------- Search ---------- */

function SearchView({ mode, panel }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState(mode === "live" ? "stations" : "shows");
  const [results, setResults] = useState({ state: "idle", feeds: [], stations: [] });
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults({ state: "idle", feeds: [], stations: [] }); return; }
    const ac = new AbortController();
    setResults((r) => ({ ...r, state: "loading" }));
    const t = setTimeout(async () => {
      try {
        if (scope === "stations") {
          const d = await getJSON(`/api/radio?q=${encodeURIComponent(q)}`, ac.signal);
          setResults({ state: "ok", feeds: [], stations: d.stations || [] });
        } else {
          const d = await getJSON(`/api/search?q=${encodeURIComponent(q)}`, ac.signal);
          let feeds = d.feeds || [];
          if (mode === "video") feeds = [...feeds].sort((a, b) => (b.medium === "video") - (a.medium === "video"));
          setResults({ state: "ok", feeds, stations: [] });
        }
      } catch (err) {
        if (err.name !== "AbortError") setResults({ state: "error", feeds: [], stations: [], error: err.message });
      }
    }, 300);
    return () => { clearTimeout(t); ac.abort(); };
  }, [query, scope, mode]);

  const suggestions = scope === "stations" ? GENRES.filter((g) => g.tag) : VIBES.filter((v) => v.cat);
  return (
    <section className="sec search-view">
      <h1 className="view-h">Search</h1>
      <label className="search">
        <Icon name="search" />
        <input
          ref={inputRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off"
          placeholder={scope === "stations" ? "Search radio stations" : "Search shows, hosts, topics"}
          aria-label={scope === "stations" ? "Search radio stations" : "Search podcasts"}
        />
        {query ? <button className="icon-btn" type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search"><Icon name="close" /></button> : null}
      </label>
      <div className="controls-row">
        <div className="switcher" role="group" aria-label="What to search">
          <button aria-pressed={scope === "shows"} onClick={() => setScope("shows")}><Icon name="headphones" />Podcasts</button>
          <button aria-pressed={scope === "stations"} onClick={() => setScope("stations")}><span className="live-dot" aria-hidden="true" />Stations</button>
        </div>
      </div>
      {query.trim().length < 2 ? (
        <div className="suggest">
          <p className="sec-note">Try a show, a host, or one of these:</p>
          <div className="chips">{suggestions.map((s) => <button key={s.label} className="chip" onClick={() => setQuery(s.label)}>{s.label}</button>)}</div>
        </div>
      ) : scope === "stations" ? (
        <StationGrid data={{ state: results.state, stations: results.stations, error: results.error }} emptyText={`No stations match “${query.trim()}”.`} />
      ) : (
        <ShowGrid gridId="search" data={{ state: results.state, feeds: results.feeds, error: results.error }} {...panel} emptyText={`Nothing matches “${query.trim()}”. Try a show name, a host, or a topic.`} />
      )}
    </section>
  );
}

/* ---------- Library ---------- */

function Library({ panel, seeAll, nav }) {
  const player = usePlayer();
  const p = usePersonal();
  const following = useFollowing();
  const store = player.store;
  if (!store) return null;

  const weekAgo = Date.now() / 1000 - 7 * 86400;
  const newIds = new Set(following.items.filter((it) => it.ep.published > weekAgo && !store.played[it.ep.id]).map((it) => String(it.show.id)));
  const saved = Object.values(store.favEps || {}).filter((r) => !r.ep.live).sort((a, b) => b.savedAt - a.savedAt);
  const history = store.recent.filter((r) => !r.ep.live);
  const empty = !p.favShows.length && !saved.length && !p.favStations.length && !history.length && !p.stations.length;

  const clearHistory = () => {
    player.updateStore((s) => { s.recent = []; s.recentStations = []; });
    player.notify("History cleared");
  };

  return (
    <section className="sec library">
      <h1 className="view-h">Your library</h1>
      <AccountCard />

      {empty ? (
        <div className="empty">
          <b>Your library starts here.</b>
          Tap the heart on shows, episodes and stations you love, and they'll live here.
          <div className="center"><button className="cta" onClick={() => nav("home")}>Find something to play</button></div>
        </div>
      ) : null}

      {following.items.length ? (
        <div className="lib-sec">
          <div className="lib-head"><h2>New episodes</h2>{following.items.length > 4 ? <button className="see-all" onClick={() => seeAll({ title: "New from shows you follow", kind: "episodes", items: following.items })}>See all</button> : null}</div>
          <div className="list">{following.items.slice(0, 4).map((it) => <EpisodeCard key={it.ep.id} show={it.show} ep={it.ep} onPlay={panel.onPlay} />)}</div>
        </div>
      ) : null}

      {p.favShows.length ? (
        <div className="lib-sec">
          <div className="lib-head"><h2>Following</h2><span className="count">{p.favShows.length}</span></div>
          <ShowGrid gridId="lib-follow" data={{ state: "ok", feeds: p.favShows }} {...panel} newIds={newIds} emptyText="" />
        </div>
      ) : null}

      {saved.length ? (
        <div className="lib-sec">
          <div className="lib-head"><h2>Saved episodes</h2><span className="count">{saved.length}</span></div>
          <div className="list">{saved.map((r) => <EpisodeCard key={r.ep.id} show={r.show} ep={r.ep} onPlay={panel.onPlay} />)}</div>
        </div>
      ) : null}

      {p.favStations.length ? (
        <div className="lib-sec">
          <div className="lib-head"><h2>Stations</h2><span className="count">{p.favStations.length}</span></div>
          <StationGrid data={{ state: "ok", stations: p.favStations }} emptyText="" />
        </div>
      ) : null}

      {history.length || p.stations.length ? (
        <div className="lib-sec">
          <div className="lib-head"><h2>History</h2><button className="see-all" onClick={clearHistory}>Clear</button></div>
          {history.length ? <div className="list">{history.slice(0, 8).map((r) => <EpisodeCard key={r.ep.id} show={r.show} ep={r.ep} onPlay={panel.onPlay} />)}</div> : null}
          {p.stations.length ? <div className="shelf-row lib-stations">{p.stations.slice(0, 8).map((st) => <StationTile key={st.id} st={st} />)}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
