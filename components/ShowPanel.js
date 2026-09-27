"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "./PlayerProvider";
import { useAuth } from "./AuthProvider";
import Art from "./Art";
import Icon from "./Icon";
import { ago, clock, length } from "@/lib/format";
import { getJSON, showUrl } from "@/lib/api";

const PAGE = 10;

function languageName(code) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) || "";
  } catch {
    return "";
  }
}

// showKey is "pi:<Podcast Index id>" or "it:<Apple id>" (from Charts).
export default function ShowPanel({ showKey, focusEp, onClose, onPlay, caret }) {
  const player = usePlayer();
  const auth = useAuth();
  const [data, setData] = useState({ state: "loading" });
  const [count, setCount] = useState(PAGE);
  const [more, setMore] = useState(false);
  const [nudge, setNudge] = useState(false);
  const rootRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const ac = new AbortController();
    const [kind, key] = showKey.split(":");
    setData({ state: "loading" });
    setCount(PAGE);
    setMore(false);
    getJSON(kind === "it" ? `/api/podcast/itunes/${key}` : `/api/podcast/${key}`, ac.signal)
      .then((d) => setData({ state: "ok", ...d }))
      .catch((err) => {
        if (err.name !== "AbortError") setData({ state: "error", error: err.message });
      });
    return () => ac.abort();
  }, [showKey]);

  // Deep links (/show/123?ep=456): make sure the episode is visible and bring it into view
  useEffect(() => {
    if (data.state !== "ok" || !focusEp) return;
    const i = data.episodes.findIndex((e) => e.id === focusEp);
    if (i >= count) setCount(i + 1);
    const t = setTimeout(() => {
      const el = rootRef.current && rootRef.current.querySelector(`[data-ep="${CSS.escape(focusEp)}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.state, focusEp]);

  useEffect(() => {
    if (data.state === "ok" && closeRef.current) closeRef.current.focus({ preventScroll: true });
  }, [data.state]);

  const feed = data.feed;
  const eps = useMemo(() => data.episodes || [], [data.episodes]);
  const store = player.store;

  let body;
  if (data.state === "loading") {
    body = (
      <div className="panel-head" aria-busy="true">
        <span className="art panel-art skel" />
        <div className="panel-info">
          <span className="skel skel-line wide" />
          <span className="skel skel-line" />
          <span className="skel skel-line" />
        </div>
      </div>
    );
  } else if (data.state === "error") {
    body = <div className="empty" role="alert"><b>This show didn't load.</b>{data.error}</div>;
  } else {
    const fav = player.isFavShow(feed.id);
    const lang = languageName(feed.language);
    const hasVideo = feed.medium === "video" || eps.some((e) => e.isVideo);
    const hasAudio = eps.some((e) => !e.isVideo);
    const format = hasVideo && hasAudio ? "Watch + Listen" : hasVideo ? "Watch" : "Listen";
    const longDesc = feed.description && feed.description.length > 220;
    const facts = [
      feed.episodeCount ? `${feed.episodeCount.toLocaleString()} episodes` : eps.length ? `${eps.length} episodes` : "",
      feed.updated ? `New episode ${ago(feed.updated).toLowerCase()}` : "",
      lang,
    ].filter(Boolean);

    body = (
      <>
        <div className="panel-head">
          <Art id={feed.id} src={feed.image} title={feed.title} className="panel-art" />
          <div className="panel-info">
            <div className="badges">
              {feed.categories.slice(0, 3).map((c) => <span key={c} className="badge">{c}</span>)}
              {feed.explicit ? <span className="badge warn">Explicit</span> : null}
              <span className={`badge fmt${hasVideo ? " video" : ""}`}><Icon name={hasVideo ? "video" : "headphones"} />{format}</span>
            </div>
            <h2 id={`panel-title-${feed.id}`}>{feed.title}</h2>
            {feed.author ? <p className="host">Hosted by {feed.author}</p> : null}
            {facts.length ? <ul className="facts">{facts.map((f) => <li key={f}>{f}</li>)}</ul> : null}
            <div className="panel-actions">
              {eps.length ? (
                <button className="cta" onClick={() => onPlay(feed, eps[0], eps)}>
                  <Icon name="play" />
                  Play latest
                </button>
              ) : null}
              <button className={`round-btn${fav ? " on" : ""}`} aria-pressed={fav} onClick={() => { const added = player.toggleFavShow(feed); if (added && auth.enabled && auth.user && auth.alerts === "off") setNudge(true); }} aria-label={fav ? "Remove show from favorites" : "Save show to favorites"}>
                <Icon name={fav ? "heartFill" : "heart"} />
              </button>
              <button className="round-btn" onClick={() => player.share({ title: feed.title, text: `Listen to ${feed.title} on yappr`, url: showUrl(feed.id) })} aria-label="Share show">
                <Icon name="share" />
              </button>
              {feed.website ? (
                <a className="round-btn" href={feed.website} target="_blank" rel="noopener noreferrer" aria-label="Show website">
                  <Icon name="globe" />
                </a>
              ) : null}
              {feed.funding ? (
                <a className="pill-link" href={feed.funding.url} target="_blank" rel="noopener noreferrer">
                  {feed.funding.message || "Support the show"}
                </a>
              ) : null}
            </div>
            {fav && auth.enabled ? <AlertNudge auth={auth} player={player} show={nudge} /> : null}
          </div>
        </div>

        {feed.description ? (
          <div className="panel-desc-wrap">
            <p className={`panel-desc${more || !longDesc ? " open" : ""}`}>{feed.description}</p>
            {longDesc ? <button className="text-btn" onClick={() => setMore((m) => !m)}>{more ? "Show less" : "Read more"}</button> : null}
          </div>
        ) : null}

        <h3 className="panel-h3">Episodes</h3>
        {eps.length ? (
          <>
            <ul className="eps">
              {eps.slice(0, count).map((e) => (
                <EpisodeRow key={e.id} feed={feed} ep={e} eps={eps} onPlay={onPlay} focused={e.id === focusEp} store={store} />
              ))}
            </ul>
            {count < eps.length ? (
              <div className="center">
                <button className="pill-btn ghost more-btn" onClick={() => setCount((c) => c + PAGE)}>Show more episodes</button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="empty">This show doesn't have any playable audio episodes right now.</div>
        )}
      </>
    );
  }

  return (
    <div
      ref={rootRef}
      className="panel"
      style={caret != null ? { "--caret": `${caret}%` } : undefined}
      role="region"
      aria-labelledby={feed ? `panel-title-${feed.id}` : undefined}
      aria-label={feed ? undefined : "Show details"}
    >
      {caret != null ? <span className="panel-caret" aria-hidden="true" /> : null}
      <button ref={closeRef} className="icon-btn panel-close" onClick={onClose} aria-label="Close show details">
        <Icon name="close" />
      </button>
      {body}
    </div>
  );
}

// After favoriting: nudge toward signing in, or toward turning on new-episode alerts
function AlertNudge({ auth, player }) {
  if (!auth.user) {
    return (
      <p className="nudge">
        <Icon name="bell" />
        <span>Want to know when new episodes drop? <button className="text-btn" onClick={() => auth.setMenuOpen(true)}>Sign in for alerts</button></span>
      </p>
    );
  }
  if (auth.alerts === "on") return <p className="nudge quiet"><Icon name="bell" /><span>Alerts are on. We'll let you know when this show posts.</span></p>;
  if (auth.alerts === "blocked" || auth.alerts === "unsupported") return null;
  const turnOn = async () => {
    try { await auth.turnOnAlerts(); player.notify("Alerts on. We'll ping you about new episodes."); }
    catch (err) { player.notify(err.message); }
  };
  return (
    <p className="nudge">
      <Icon name="bell" />
      <span>Get a heads-up when this show posts. <button className="text-btn" onClick={turnOn} disabled={auth.alerts === "working"}>Turn on alerts</button></span>
    </p>
  );
}

function EpisodeRow({ feed, ep, eps, onPlay, focused, store }) {
  const player = usePlayer();
  const now = player.ep && player.ep.id === ep.id;
  const playingNow = now && player.playing && (player.phase === "content" || player.phase === "preroll" || player.phase === "postroll" || player.phase === "loading");
  const resume = store && store.resume[ep.id];
  const done = store && store.played[ep.id];
  const fav = player.isFavEp(ep.id);
  const guests = ep.people.filter((p) => p.role !== "host").map((p) => p.name);
  const code = [ep.season ? `S${ep.season}` : "", ep.number ? `E${ep.number}` : ""].filter(Boolean).join(" ");

  let progress = null;
  if (now && player.phase === "content" && player.dur) progress = player.pos / player.dur;
  else if (!done && resume && ep.duration) progress = resume / ep.duration;

  return (
    <li className={`ep${now ? " now" : ""}${focused ? " focus" : ""}`} data-ep={ep.id}>
      <button
        className="ep-play"
        onClick={() => (now ? player.toggle() : onPlay(feed, ep, eps))}
        aria-label={playingNow ? `Pause ${ep.title}` : `Play ${ep.title}`}
      >
        <Icon name={playingNow ? "pause" : "play"} />
      </button>
      <div className="meta">
        <b>{ep.title}</b>
        {ep.description ? <p>{ep.description}</p> : null}
        <div className="facts">
          {ep.isVideo ? <span className="vid-tag"><Icon name="video" />Video</span> : null}
          {code ? <span>{code}</span> : null}
          {ep.published ? <span>{ago(ep.published)}</span> : null}
          {length(ep.duration) ? <span>{length(ep.duration)}</span> : null}
          {ep.explicit ? <span>Explicit</span> : null}
          {done ? <span className="done">Played</span> : resume && ep.duration && !now ? <span>{clock(ep.duration - resume)} left</span> : null}
          {guests.length ? <span>With {guests.slice(0, 2).join(" and ")}</span> : null}
        </div>
        {progress != null ? <span className="bar"><i style={{ width: `${Math.max(2, Math.min(100, progress * 100))}%` }} /></span> : null}
      </div>
      <div className="ep-actions">
        <button className={`round-btn sm${fav ? " on" : ""}`} aria-pressed={fav} onClick={() => player.toggleFavEp(feed, ep)} aria-label={fav ? "Remove episode from favorites" : "Save episode to favorites"}>
          <Icon name={fav ? "heartFill" : "heart"} />
        </button>
        <button className="round-btn sm" onClick={() => player.share({ title: ep.title, text: `${ep.title} from ${feed.title}, on yappr`, url: showUrl(feed.id, ep.id) })} aria-label="Share episode">
          <Icon name="share" />
        </button>
      </div>
    </li>
  );
}
