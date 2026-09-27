"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayerProvider, usePlayer } from "./PlayerProvider";
import { MiniPlayer, FullPlayer, DebugPanel } from "./Player";
import Art from "./Art";
import Icon from "./Icon";
import { ago, clock, length } from "@/lib/format";

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

async function getJSON(url, signal) {
  const res = await fetch(url, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default function App() {
  return (
    <PlayerProvider>
      <Shell />
    </PlayerProvider>
  );
}

function Shell() {
  const player = usePlayer();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState({ state: "idle", feeds: [] });
  const [vibe, setVibe] = useState(VIBES[0]);
  const [trend, setTrend] = useState({ state: "loading", feeds: [] });
  const [sheetId, setSheetId] = useState(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [debug, setDebug] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("debug"));
  }, []);

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

  const startPlay = useCallback(
    (show, ep, queue, full) => {
      const first = !player.ep;
      player.play(show, ep, queue);
      if (full || first) setPlayerOpen(true);
    },
    [player]
  );

  // Lock background scroll while an overlay is open
  useEffect(() => {
    document.body.style.overflow = sheetId || playerOpen ? "hidden" : "";
  }, [sheetId, playerOpen]);

  // Keyboard: Escape closes overlays, space toggles playback
  const toggleRef = useRef(player.toggle);
  toggleRef.current = player.toggle;
  const hasEp = !!player.ep;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (debugOpen) setDebugOpen(false);
        else if (playerOpen) setPlayerOpen(false);
        else if (sheetId) setSheetId(null);
      } else if (e.key === " " && hasEp && !/INPUT|TEXTAREA|BUTTON|SELECT/.test(document.activeElement?.tagName || "")) {
        e.preventDefault();
        toggleRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [debugOpen, playerOpen, sheetId, hasEp]);

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
    e.preventDefault();
    setQuery("");
    setVibe(VIBES[0]);
    setSheetId(null);
    setPlayerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const searching = query.trim().length >= 2;

  return (
    <>
      <header className="top">
        <a className="logo" href="/" onClick={goHome} aria-label="yappr home">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 4C8.8 4 3 8.9 3 15c0 3.3 1.7 6.3 4.5 8.3L6.6 28l5.5-2.8c1.2.3 2.6.5 3.9.5 7.2 0 13-4.9 13-11S23.2 4 16 4z" fill="var(--pink)" />
            <circle cx="10.5" cy="15" r="1.9" fill="#fff" />
            <circle cx="16" cy="15" r="1.9" fill="#fff" />
            <circle cx="21.5" cy="15" r="1.9" fill="#fff" />
          </svg>
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
          <p className="pitch">Every podcast, free. One short ad before and after, never in the middle.</p>
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

        {searching ? (
          <section className="sec">
            <h2>Shows matching “{query.trim()}”</h2>
            <ShowGrid data={search} onOpen={setSheetId} emptyText={`Nothing matches “${query.trim()}”. Try a show name, a host, or a topic like history or sleep.`} />
          </section>
        ) : (
          <>
            {recent.length ? (
              <section className="sec">
                <h2>Keep listening</h2>
                <div className="list">
                  {recent.map((r) => {
                    const resume = (player.store && player.store.resume[r.ep.id]) || 0;
                    return (
                      <button key={r.ep.id} className="row" onClick={() => startPlay(r.show, r.ep, [], false)} aria-label={`Resume ${r.ep.title}`}>
                        <Art id={r.show.id} src={r.ep.image || r.show.image} title={r.show.title} />
                        <span className="meta">
                          <b>{r.ep.title}</b>
                          <span className="sub">{r.show.title}</span>
                          {r.ep.duration ? (
                            <span className="bar"><i style={{ width: `${Math.max(3, Math.min(100, (resume / r.ep.duration) * 100))}%` }} /></span>
                          ) : null}
                        </span>
                        <span className="go"><Icon name="play" /></span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="sec">
              <h2>{vibe.cat ? `Trending in ${vibe.label.toLowerCase()}` : "Trending now"}</h2>
              <div className="chips" role="group" aria-label="Filter by category">
                {VIBES.map((v) => (
                  <button key={v.label} className="chip" aria-pressed={v.label === vibe.label} onClick={() => setVibe(v)}>
                    {v.label}
                  </button>
                ))}
              </div>
              <ShowGrid data={trend} onOpen={setSheetId} emptyText="No shows here right now. Try another category." />
            </section>
          </>
        )}
        <footer className="foot">
          Podcast data from <a href="https://podcastindex.org" target="_blank" rel="noopener noreferrer">Podcast Index</a>
        </footer>
      </main>

      <div
        className={`scrim${sheetId || playerOpen ? " show" : ""}`}
        onClick={() => {
          setPlayerOpen(false);
          setSheetId(null);
        }}
      />
      <ShowSheet id={sheetId} onClose={() => setSheetId(null)} onPlay={startPlay} />
      <MiniPlayer onOpen={() => setPlayerOpen(true)} />
      <FullPlayer
        open={playerOpen}
        onClose={() => setPlayerOpen(false)}
        onShow={(id) => {
          setPlayerOpen(false);
          setSheetId(id);
        }}
        onPlay={startPlay}
      />
      {debug ? <DebugPanel open={debugOpen} onClose={() => setDebugOpen(false)} /> : null}
      <div className={`toast${player.toast ? " show" : ""}`} role="status" aria-live="polite">{player.toast}</div>
    </>
  );
}

function ShowGrid({ data, onOpen, emptyText }) {
  if (data.state === "error") {
    return (
      <div className="empty" role="alert">
        <b>Shows didn't load.</b>
        {data.error}
      </div>
    );
  }
  if (data.state === "loading" && !data.feeds.length) {
    return (
      <div className="grid" aria-busy="true" aria-label="Loading shows">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="tile skel-tile"><span className="art skel" /><span className="skel skel-line" /></div>
        ))}
      </div>
    );
  }
  if (!data.feeds.length) {
    return <div className="empty">{emptyText}</div>;
  }
  return (
    <div className={`grid${data.state === "loading" ? " dim" : ""}`}>
      {data.feeds.map((f) => (
        <button key={f.id} className="tile" onClick={() => onOpen(f.id)}>
          <Art id={f.id} src={f.image} title={f.title} />
          <b>{f.title}</b>
          {f.author ? <span className="tsub">{f.author}</span> : null}
        </button>
      ))}
    </div>
  );
}

function ShowSheet({ id, onClose, onPlay }) {
  const player = usePlayer();
  const [shownId, setShownId] = useState(null);
  const [data, setData] = useState({ state: "idle" });
  const sheetRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (id) setShownId(id);
  }, [id]);

  useEffect(() => {
    if (!shownId) return;
    const ac = new AbortController();
    setData({ state: "loading" });
    getJSON(`/api/podcast/${shownId}`, ac.signal)
      .then((d) => setData({ state: "ok", ...d }))
      .catch((err) => {
        if (err.name !== "AbortError") setData({ state: "error", error: err.message });
      });
    return () => ac.abort();
  }, [shownId]);

  useEffect(() => {
    if (id) {
      if (sheetRef.current) sheetRef.current.scrollTop = 0;
      const t = setTimeout(() => closeRef.current && closeRef.current.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [id]);

  const feed = data.feed;
  const eps = data.episodes || [];
  const store = player.store;

  return (
    <section ref={sheetRef} className={`sheet${id ? " open" : ""}`} role="dialog" aria-modal="true" aria-label={feed ? feed.title : "Show details"} aria-hidden={!id}>
      <div className="sheet-top">
        <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close show"><Icon name="close" /></button>
      </div>
      <div className="sheet-body">
        {data.state === "loading" || data.state === "idle" ? (
          <div className="show-head" aria-busy="true">
            <span className="art skel" />
            <span className="skel skel-line wide" />
            <span className="skel skel-line" />
          </div>
        ) : data.state === "error" ? (
          <div className="empty" role="alert"><b>This show didn't load.</b>{data.error}</div>
        ) : (
          <>
            <div className="show-head">
              <Art id={feed.id} src={feed.image} title={feed.title} />
              {feed.categories.length ? <span className="cat">{feed.categories.slice(0, 2).join(", ")}</span> : null}
              <h2>{feed.title}</h2>
              {feed.author ? <p className="host">{feed.author}</p> : null}
              {feed.description ? <p className="desc">{feed.description}</p> : null}
              {eps.length ? (
                <button className="cta" onClick={() => onPlay(feed, eps[0], eps, true)}>
                  <Icon name="play" />
                  Play latest episode
                </button>
              ) : null}
            </div>
            <h3>Episodes</h3>
            {eps.length ? (
              <ul className="eps">
                {eps.map((e) => {
                  const now = player.ep && player.ep.id === e.id;
                  const resume = store && store.resume[e.id];
                  const done = store && store.played[e.id];
                  return (
                    <li key={e.id} className={`ep${now ? " now" : ""}`}>
                      <div className="meta">
                        <b>{e.title}</b>
                        {e.description ? <p>{e.description}</p> : null}
                        <div className="facts">
                          {e.published ? <span>{ago(e.published)}</span> : null}
                          {e.duration ? <span>{length(e.duration)}</span> : null}
                          {done ? <span className="done">Played</span> : resume && e.duration ? <span>{clock(e.duration - resume)} left</span> : null}
                        </div>
                      </div>
                      <button className="ep-play" onClick={() => onPlay(feed, e, eps, false)} aria-label={`Play ${e.title}`}>
                        <Icon name="play" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty">This show doesn't have any playable audio episodes right now.</div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
