"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PlayerProvider, usePlayer } from "./PlayerProvider";
import { NowBar, DebugPanel } from "./Player";
import ShowPanel from "./ShowPanel";
import Art from "./Art";
import Icon from "./Icon";
import Footer from "./Footer";
import LogoMark from "./Logo";
import { getJSON } from "@/lib/api";
import { COUNTRIES, findCountry, isCountry } from "@/lib/countries";

// Podcast Index category names. If a category comes back empty, we fall back to a search.
const VIBES = [
  { label: "All", cat: "" },
  { label: "Comedy", cat: "Comedy" },
  { label: "True crime", cat: "True Crime", q: "true crime" },
  { label: "Tech", cat: "Technology" },
  { label: "Culture", cat: "Culture" },
  { label: "Health", cat: "Health" },
  { label: "Sports", cat: "Sports" },
  { label: "History", cat: "History" },
  { label: "Business", cat: "Business" },
  { label: "Science", cat: "Science" },
  { label: "News", cat: "News" },
  { label: "Stories", cat: "Fiction", q: "audio fiction" },
];
const PICKABLE = VIBES.filter((v) => v.cat);

const TABS = [
  { id: "trending", label: "Trending" },
  { id: "charts", label: "Charts" },
  { id: "radio", label: "Radio" },
  { id: "foryou", label: "For You" },
  { id: "favorites", label: "Favorites" },
];

export default function App({ initialShow = null, initialEp = null }) {
  return (
    <PlayerProvider>
      <Shell initialShow={initialShow} initialEp={initialEp} />
    </PlayerProvider>
  );
}

function Shell({ initialShow, initialEp }) {
  const player = usePlayer();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState({ state: "idle", feeds: [] });
  const [vibe, setVibe] = useState(VIBES[0]);
  const [trend, setTrend] = useState({ state: "loading", feeds: [] });
  const [tab, setTab] = useState("trending");
  // Which show is expanded, and where: a grid/list id, or "top" (deep links and the play bar)
  const [open, setOpen] = useState(initialShow ? { key: `pi:${initialShow}`, origin: "top", focusEp: initialEp } : null);
  const [debug, setDebug] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [country, setCountryState] = useState(null);
  const inputRef = useRef(null);
  const topRef = useRef(null);
  const tabsRef = useRef(null);

  // Country for Charts and Radio: saved choice, else a guess from the visitor's location
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

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("debug"));
    const h = window.location.hash.replace("#", "");
    if (TABS.some((t) => t.id === h)) setTab(h);
  }, []);

  const chooseTab = (id) => {
    setTab(id);
    setOpen((o) => (o && o.origin === "top" ? o : null));
    try {
      const base = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", id === "trending" ? base : `${base}#${id}`);
    } catch { /* ignore */ }
  };

  const toggleShow = useCallback((key, origin) => {
    setOpen((o) => (o && o.key === key && o.origin === origin ? null : { key, origin }));
  }, []);
  const closeShow = useCallback(() => setOpen(null), []);
  const openAtTop = useCallback((id) => {
    if (String(id).startsWith("radio:")) {
      setTab("radio");
      setTimeout(() => tabsRef.current && tabsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      return;
    }
    setOpen({ key: `pi:${id}`, origin: "top" });
  }, []);

  // Bring a top-opened show into view
  useEffect(() => {
    if (open && open.origin === "top" && topRef.current) {
      topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [open]);

  // Trending shows for the selected vibe
  useEffect(() => {
    const ac = new AbortController();
    setTrend((t) => ({ state: "loading", feeds: t.feeds }));
    (async () => {
      try {
        let data = await getJSON(`/api/trending${vibe.cat ? `?cat=${encodeURIComponent(vibe.cat)}` : ""}`, ac.signal);
        let feeds = data.feeds || [];
        if (!feeds.length && vibe.q) {
          data = await getJSON(`/api/search?q=${encodeURIComponent(vibe.q)}`, ac.signal);
          feeds = data.feeds || [];
        }
        setTrend({ state: "ok", feeds });
      } catch (err) {
        if (err.name !== "AbortError") setTrend({ state: "error", feeds: [], error: err.message });
      }
    })();
    return () => ac.abort();
  }, [vibe]);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearch({ state: "idle", feeds: [] });
      return;
    }
    const ac = new AbortController();
    setSearch((s) => ({ state: "loading", feeds: s.feeds }));
    const t = setTimeout(async () => {
      try {
        const data = await getJSON(`/api/search?q=${encodeURIComponent(q)}`, ac.signal);
        setSearch({ state: "ok", feeds: data.feeds || [] });
      } catch (err) {
        if (err.name !== "AbortError") setSearch({ state: "error", feeds: [], error: err.message });
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [query]);

  const startPlay = useCallback((show, ep, queue) => player.play(show, ep, queue), [player]);

  // Keyboard: Escape closes the open show, space toggles playback
  const toggleRef = useRef(player.toggle);
  toggleRef.current = player.toggle;
  const hasEp = !!player.ep;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (debugOpen) setDebugOpen(false);
        else setOpen(null);
      } else if (e.key === " " && hasEp && !/INPUT|TEXTAREA|BUTTON|SELECT|A/.test(document.activeElement?.tagName || "")) {
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
    return store.recent.filter((r) => !store.played[r.ep.id]).slice(0, 4);
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
    if (window.location.pathname !== "/") return; // let the link navigate home from /show/...
    e.preventDefault();
    setQuery("");
    setVibe(VIBES[0]);
    chooseTab("trending");
    setOpen(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const searching = query.trim().length >= 2;
  const panel = { open, onToggle: toggleShow, onClose: closeShow, onPlay: startPlay };

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
          <button className="icon-btn" onClick={toggleTheme} aria-label="Switch light or dark theme">
            <Icon name="theme" />
          </button>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <h1>What are we yapping to?</h1>
          <p className="pitch">Every Podcast. Every Creator.</p>
          <label className="search">
            <Icon name="search" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shows, hosts, topics"
              autoComplete="off"
              aria-label="Search podcasts"
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
            <h2>Shows matching “{query.trim()}”</h2>
            <ShowGrid gridId="search" data={search} {...panel} emptyText={`Nothing matches “${query.trim()}”. Try a show name, a host, or a topic like history or sleep.`} />
          </section>
        ) : (
          <>
            {recent.length ? (
              <section className="sec">
                <h2>Keep listening</h2>
                <div className="list">
                  {recent.map((r) => (
                    <EpisodeCard key={r.ep.id} show={r.show} ep={r.ep} onPlay={startPlay} />
                  ))}
                </div>
              </section>
            ) : null}

            <div className="tabs" role="tablist" aria-label="Browse" ref={tabsRef}>
              {TABS.map((t) => (
                <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} className="tab" onClick={() => chooseTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "trending" ? (
              <section className="sec" role="tabpanel" id="panel-trending" aria-labelledby="tab-trending">
                <h2>{vibe.cat ? `Trending in ${vibe.label.toLowerCase()}` : "Trending now"}</h2>
                <div className="chips" role="group" aria-label="Filter by category">
                  {VIBES.map((v) => (
                    <button key={v.label} className="chip" aria-pressed={v.label === vibe.label} onClick={() => { setVibe(v); setOpen((o) => (o && o.origin === "top" ? o : null)); }}>
                      {v.label}
                    </button>
                  ))}
                </div>
                <ShowGrid gridId="trending" data={trend} {...panel} emptyText="No shows here right now. Try another category." />
              </section>
            ) : tab === "charts" ? (
              <Charts {...panel} country={country} setCountry={setCountry} />
            ) : tab === "radio" ? (
              <Radio country={country} setCountry={setCountry} />
            ) : tab === "foryou" ? (
              <ForYou {...panel} />
            ) : (
              <Favorites {...panel} />
            )}
          </>
        )}
        <Footer />
      </main>

      <NowBar onOpenShow={openAtTop} />
      {debug ? <DebugPanel open={debugOpen} onClose={() => setDebugOpen(false)} /> : null}
      <div className={`toast${player.toast ? " show" : ""}`} role="status" aria-live="polite">{player.toast}</div>
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
        <span className="sub">{show.title}</span>
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

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const n = getComputedStyle(el).gridTemplateColumns.split(" ").filter((t) => t && t !== "0px").length;
      setCols(Math.max(1, n));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data.state, data.feeds.length]);

  const feeds = data.feeds;
  const openIdx = open && open.origin === gridId ? feeds.findIndex((f) => `pi:${f.id}` === open.key) : -1;
  const insertAfter = openIdx >= 0 ? Math.min(feeds.length - 1, Math.floor(openIdx / cols) * cols + cols - 1) : -1;
  const caret = openIdx >= 0 ? (((openIdx % cols) + 0.5) / cols) * 100 : null;

  useEffect(() => {
    if (openIdx < 0 || !gridRef.current) return;
    const tile = gridRef.current.querySelector(`[data-tile="${feeds[openIdx].id}"]`);
    if (tile) setTimeout(() => tile.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIdx]);

  if (data.state === "error") {
    return <div className="empty" role="alert"><b>Shows didn't load.</b>{data.error}</div>;
  }
  if (data.state === "loading" && !feeds.length) {
    return (
      <div className="grid" ref={gridRef} aria-busy="true" aria-label="Loading shows">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="tile skel-tile"><span className="art skel" /><span className="skel skel-line" /></div>
        ))}
      </div>
    );
  }
  if (!feeds.length) return <div className="empty">{emptyText}</div>;

  const items = [];
  feeds.forEach((f, i) => {
    const selected = i === openIdx;
    items.push(
      <button
        key={f.id}
        data-tile={f.id}
        className={`tile${selected ? " selected" : ""}`}
        onClick={() => onToggle(`pi:${f.id}`, gridId)}
        aria-expanded={selected}
      >
        <Art id={f.id} src={f.image} title={f.title} />
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
        <button key={o.id} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

function Charts({ open, onToggle, onClose, onPlay, country, setCountry }) {
  const [mode, setMode] = useState("top");
  const [data, setData] = useState({ state: "loading", shows: [] });
  const c = findCountry(country);

  useEffect(() => {
    if (!country) return;
    const ac = new AbortController();
    setData((d) => ({ state: "loading", shows: d.shows }));
    const url = mode === "top" ? `/api/charts?country=${country}` : `/api/rising?lang=${c.lang}`;
    getJSON(url, ac.signal)
      .then((d) => setData({ state: "ok", shows: d.shows || [] }))
      .catch((err) => {
        if (err.name !== "AbortError") setData({ state: "error", shows: [], error: err.message });
      });
    return () => ac.abort();
  }, [country, mode, c.lang]);

  useEffect(() => {
    if (!open || open.origin !== "charts") return;
    const el = document.querySelector(`[data-chart="${open.key}"]`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, [open]);

  return (
    <section className="sec" role="tabpanel" id="panel-charts" aria-labelledby="tab-charts">
      <h2>{mode === "top" ? `Top podcasts in ${c.name}` : `Rising in ${c.langName}`}</h2>
      <p className="sec-note">
        {mode === "top"
          ? `The 50 most popular shows on Apple Podcasts in ${c.name} right now.`
          : `${c.langName}-language shows climbing fastest over the last few days.`}
      </p>
      <div className="controls-row">
        <Switcher label="Chart type" value={mode} onChange={setMode} options={[{ id: "top", label: "Top" }, { id: "rising", label: "Rising" }]} />
        <CountrySelect country={country} setCountry={setCountry} />
      </div>
      {data.state === "error" ? (
        <div className="empty" role="alert"><b>Charts didn't load.</b>{data.error}</div>
      ) : data.state === "loading" && !data.shows.length ? (
        <ol className="chart" aria-busy="true" aria-label="Loading charts">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}><div className="crow"><span className="rank">{i + 1}</span><span className="art skel" /><span className="meta"><span className="skel skel-line" /></span></div></li>
          ))}
        </ol>
      ) : !data.shows.length ? (
        <div className="empty">No chart for this one yet. Try another country.</div>
      ) : (
        <ol className={`chart${data.state === "loading" ? " dim" : ""}`}>
          {data.shows.map((s) => {
            const key = s.itunesId ? `it:${s.itunesId}` : `pi:${s.id}`;
            const selected = open && open.origin === "charts" && open.key === key;
            return (
              <li key={key} data-chart={key}>
                <button className={`crow${selected ? " selected" : ""}`} onClick={() => onToggle(key, "charts")} aria-expanded={selected}>
                  <span className="rank" aria-label={`Number ${s.rank}`}>{s.rank}</span>
                  <Art id={s.itunesId || s.id} src={s.image} title={s.title} />
                  <span className="meta">
                    <b>{s.title}</b>
                    {s.author ? <span className="sub">{s.author}</span> : null}
                  </span>
                </button>
                {selected ? (
                  <div className="chart-panel">
                    <ShowPanel showKey={key} onClose={onClose} onPlay={onPlay} caret={12} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

const GENRES = [
  { label: "All", tag: "" }, { label: "Talk", tag: "talk" }, { label: "News", tag: "news" }, { label: "Pop", tag: "pop" },
  { label: "Rock", tag: "rock" }, { label: "Hip hop", tag: "hiphop" }, { label: "Jazz", tag: "jazz" }, { label: "Classical", tag: "classical" },
  { label: "Country", tag: "country" }, { label: "Dance", tag: "dance" }, { label: "Sports", tag: "sports" },
];

function Radio({ country, setCountry }) {
  const player = usePlayer();
  const [genre, setGenre] = useState(GENRES[0]);
  const [order, setOrder] = useState("popular");
  const [data, setData] = useState({ state: "loading", stations: [] });
  const c = findCountry(country);

  useEffect(() => {
    if (!country) return;
    const ac = new AbortController();
    setData((d) => ({ state: "loading", stations: d.stations }));
    getJSON(`/api/radio?country=${country}&tag=${encodeURIComponent(genre.tag)}&order=${order}`, ac.signal)
      .then((d) => setData({ state: "ok", stations: d.stations || [] }))
      .catch((err) => {
        if (err.name !== "AbortError") setData({ state: "error", stations: [], error: err.message });
      });
    return () => ac.abort();
  }, [country, genre, order]);

  const playStation = (st) => {
    const nowId = `radio-${st.id}`;
    if (player.ep && player.ep.id === nowId) { player.toggle(); return; }
    const show = { id: `radio:${st.id}`, title: st.name, author: st.country, image: st.image, categories: st.tags, website: st.homepage };
    const ep = { id: nowId, title: st.name, audio: st.url, duration: 0, image: st.image, published: 0, live: true };
    player.play(show, ep, []);
    // Radio Browser asks apps to report plays so popular stations rank well for everyone.
    fetch(`https://de1.api.radio-browser.info/json/url/${encodeURIComponent(st.id)}`, { mode: "no-cors" }).catch(() => {});
  };

  return (
    <section className="sec" role="tabpanel" id="panel-radio" aria-labelledby="tab-radio">
      <h2>Live radio in {c.name}</h2>
      <p className="sec-note">Stations streaming right now. Tap one to tune in.</p>
      <div className="controls-row">
        <Switcher label="Sort stations" value={order} onChange={setOrder} options={[{ id: "popular", label: "Popular" }, { id: "rising", label: "Rising" }]} />
        <CountrySelect country={country} setCountry={setCountry} />
      </div>
      <div className="chips" role="group" aria-label="Filter by genre">
        {GENRES.map((g) => (
          <button key={g.label} className="chip" aria-pressed={g.label === genre.label} onClick={() => setGenre(g)}>{g.label}</button>
        ))}
      </div>
      {data.state === "error" ? (
        <div className="empty" role="alert"><b>Stations didn't load.</b>{data.error}</div>
      ) : data.state === "loading" && !data.stations.length ? (
        <div className="grid" aria-busy="true" aria-label="Loading stations">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="tile skel-tile"><span className="art skel" /><span className="skel skel-line" /></div>
          ))}
        </div>
      ) : !data.stations.length ? (
        <div className="empty">No stations found for this mix. Try another genre or country.</div>
      ) : (
        <div className={`grid${data.state === "loading" ? " dim" : ""}`}>
          {data.stations.map((st) => {
            const now = player.ep && player.ep.id === `radio-${st.id}`;
            const on = now && player.playing;
            return (
              <button key={st.id} className={`tile station${now ? " selected" : ""}`} onClick={() => playStation(st)} aria-label={`${on ? "Pause" : "Play"} ${st.name}`}>
                <span className="station-art">
                  <Art id={st.id} src={st.image} title={st.name} fit="contain" />
                  <span className={`live-pill${on ? " on" : ""}`}>{on ? "Playing" : "Live"}</span>
                </span>
                <b>{st.name}</b>
                <span className="tsub">{st.tags.length ? st.tags.join(", ") : st.country}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ForYou(panel) {
  const player = usePlayer();
  const store = player.store;
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState([]);
  const [data, setData] = useState({ state: "idle", feeds: [] });

  // Categories from the vibes you chose plus the shows you've played most
  const { cats, basis, heard } = useMemo(() => {
    if (!store) return { cats: [], basis: [], heard: new Set() };
    const counts = {};
    store.recent.forEach((r) => (r.show.categories || []).forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
    const fromHistory = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c]) => c);
    const all = [...new Set([...(store.vibes || []), ...fromHistory])].slice(0, 5);
    const labels = all.map((c) => (VIBES.find((v) => v.cat === c) || { label: c }).label.toLowerCase());
    return { cats: all, basis: labels, heard: new Set(store.recent.map((r) => String(r.show.id))) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, player.storeVersion]);

  const catKey = cats.join(",");
  useEffect(() => {
    if (!catKey) { setData({ state: "idle", feeds: [] }); return; }
    const ac = new AbortController();
    setData((d) => ({ state: "loading", feeds: d.feeds }));
    getJSON(`/api/trending?cat=${encodeURIComponent(catKey)}`, ac.signal)
      .then((d) => setData({ state: "ok", feeds: d.feeds || [] }))
      .catch((err) => {
        if (err.name !== "AbortError") setData({ state: "error", feeds: [], error: err.message });
      });
    return () => ac.abort();
  }, [catKey]);

  if (!store) return null;

  if (editing || !cats.length) {
    const toggle = (cat) => setPicked((p) => (p.includes(cat) ? p.filter((c) => c !== cat) : [...p, cat]));
    return (
      <section className="sec" role="tabpanel" id="panel-foryou" aria-labelledby="tab-foryou">
        <h2>What are you into?</h2>
        <p className="sec-note">Pick a few vibes and we'll build a feed for you. It gets better as you listen.</p>
        <div className="chips" role="group" aria-label="Pick your vibes">
          {PICKABLE.map((v) => (
            <button key={v.cat} className="chip" aria-pressed={picked.includes(v.cat)} onClick={() => toggle(v.cat)}>
              {v.label}
            </button>
          ))}
        </div>
        <div className="center">
          <button className="cta" disabled={!picked.length} onClick={() => { player.updateStore((s) => { s.vibes = picked; }); setEditing(false); }}>
            {picked.length ? `Build my feed (${picked.length})` : "Pick at least one"}
          </button>
        </div>
      </section>
    );
  }

  const feeds = data.feeds.filter((f) => !heard.has(String(f.id)));
  return (
    <section className="sec" role="tabpanel" id="panel-foryou" aria-labelledby="tab-foryou">
      <h2>Picked for you</h2>
      <p className="sec-note">
        Based on {basis.join(", ")}.{" "}
        <button className="text-btn" onClick={() => { setPicked(store.vibes || []); setEditing(true); }}>Change vibes</button>
      </p>
      <ShowGrid gridId="foryou" data={{ ...data, feeds }} {...panel} emptyText="Nothing new to suggest right now. Try adding a few more vibes." />
    </section>
  );
}

function Favorites(panel) {
  const player = usePlayer();
  const store = player.store;
  if (!store) return null;
  const shows = Object.values(store.favShows || {}).sort((a, b) => b.savedAt - a.savedAt);
  const eps = Object.values(store.favEps || {}).sort((a, b) => b.savedAt - a.savedAt);

  return (
    <section className="sec" role="tabpanel" id="panel-favorites" aria-labelledby="tab-favorites">
      <h2>Your favorites</h2>
      <p className="sec-note">Saved on this device. Tap the heart on any show or episode to add it here.</p>
      {!shows.length && !eps.length ? (
        <div className="empty"><b>Nothing saved yet.</b>Open a show and tap the heart to keep it close.</div>
      ) : null}
      {eps.length ? (
        <>
          <h3 className="sub-h">Episodes</h3>
          <div className="list">
            {eps.map((r) => <EpisodeCard key={r.ep.id} show={r.show} ep={r.ep} onPlay={panel.onPlay} />)}
          </div>
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
