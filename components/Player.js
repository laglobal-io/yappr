"use client";

import { useState } from "react";
import { usePlayer } from "./PlayerProvider";
import Icon, { Dots } from "./Icon";
import Art from "./Art";
import { clock } from "@/lib/format";
import { showUrl } from "@/lib/api";

const isAdPhase = (p) => p === "preroll" || p === "postroll";

function progress(p) {
  const pct = p.dur ? Math.min(100, (p.pos / p.dur) * 100) : 0;
  const loadingPre = p.phase === "loading" && p.slot === "preroll";
  const pastContent = p.phase === "postroll" || p.phase === "done" || (p.phase === "loading" && p.slot === "postroll");
  return {
    pre: p.phase === "preroll" ? pct : loadingPre ? 0 : 100,
    main: p.phase === "content" ? pct : pastContent ? 100 : 0,
    post: p.phase === "postroll" ? pct : p.phase === "done" ? 100 : 0,
  };
}

function subtitle(p) {
  const left = Math.max(0, p.dur - p.pos);
  if (p.phase === "loading") return p.slot === "preroll" ? `${p.show.title}, starting up` : "Wrapping up";
  if (p.phase === "preroll") return `Ad from ${p.ad.advertiser}${p.dur ? `, episode in ${clock(left)}` : ""}`;
  if (p.phase === "postroll") return `Ad from ${p.ad.advertiser}, thanks for listening`;
  if (p.phase === "done") return `${p.show.title}, finished`;
  if (p.error) return p.ep.live ? "Stream stopped. Tap play to reconnect" : "Audio didn't load. Tap play to retry";
  if (p.ep.live) return `Live radio${p.show.author ? `, ${p.show.author}` : ""}`;
  return p.show.title;
}

// The only player UI: a bar that slides up from the bottom when something plays.
export function NowBar({ onOpenShow }) {
  const p = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const [drag, setDrag] = useState(null);

  if (!p.ep) return <div className="nowbar" aria-hidden="true" />;

  const ad = isAdPhase(p.phase);
  const loading = p.phase === "loading";
  const live = !!p.ep.live;
  const content = p.phase === "content" && !live;
  const bars = progress(p);
  const mainPct = drag != null ? drag / 10 : bars.main;
  const shownPos = drag != null ? (drag / 1000) * p.dur : p.pos;
  const fav = p.isFavEp(p.ep.id);
  const next = p.phase === "done" ? p.nextInQueue() : null;
  const label = p.phase === "done" ? "Play again" : p.playing ? "Pause" : "Play";
  const commit = (v) => { p.seekTo((Number(v) / 1000) * p.dur); setDrag(null); };

  const cls = ["nowbar", "show", ad && "is-ad", live && "is-live", expanded && "expanded", p.playing && (ad || p.phase === "content") && "playing"].filter(Boolean).join(" ");

  return (
    <div className={cls} role="region" aria-label="Now playing">
      <button className="nb-art-btn" onClick={() => onOpenShow(p.show.id)} aria-label={`Open ${p.show.title}`}>
        {ad ? <span className="art nb-art ad-art" aria-hidden="true">ad</span> : <Art id={p.show.id} src={p.ep.image || p.show.image} title={p.show.title} className="nb-art" />}
      </button>

      <div className="nb-text">
        <b title={p.ep.title}>{ad ? `Sponsored by ${p.ad.advertiser}` : p.ep.title}</b>

        <button className="nb-sub" onClick={() => onOpenShow(p.show.id)}>{subtitle(p)}</button>
      </div>

      <div className="nb-controls">
        {!live ? <button className="icon-btn nb-skip" onClick={() => p.seekBy(-15)} disabled={!content} aria-label="Back 15 seconds"><Icon name="back" /></button> : null}
        <button className="nb-play" onClick={p.toggle} aria-label={label}>
          {loading ? <Dots /> : <Icon name={p.playing ? "pause" : "play"} />}
        </button>
        {!live ? <button className="icon-btn nb-skip" onClick={() => p.seekBy(30)} disabled={!content} aria-label="Forward 30 seconds"><Icon name="fwd" /></button> : null}
      </div>

      {live && !ad ? (
        <div className="nb-track">
          <span className={`live-pill${p.playing && p.phase === "content" ? " on" : ""}`}>Live</span>
          <span className="live-line" aria-hidden="true"><i /></span>
        </div>
      ) : (
      <div className="nb-track">
        <span className="nb-time">{content ? clock(shownPos) : ad ? "Ad" : ""}</span>
        <div className="track">
          <div className="seg ad" title="Ad before"><i style={{ width: `${bars.pre}%` }} /></div>
          <div className={`seg main${content ? " live" : ""}`} style={{ "--k": `${mainPct}%` }}>
            <i style={{ width: `${mainPct}%` }} />
            <input
              type="range" min="0" max="1000"
              value={Math.round(mainPct * 10)}
              disabled={!content}
              aria-label="Seek within episode"
              onChange={(e) => setDrag(Number(e.target.value))}
              onPointerUp={(e) => commit(e.currentTarget.value)}
              onKeyUp={(e) => commit(e.currentTarget.value)}
            />
          </div>
          <div className="seg ad" title="Ad after"><i style={{ width: `${bars.post}%` }} /></div>
        </div>
        <span className="nb-time">{content ? `-${clock(p.dur - shownPos)}` : ad && p.dur ? clock(p.dur - p.pos) : ""}</span>
      </div>
      )}

      <div className="nb-extras">
        {ad && p.ad.clickThrough ? <button className="pill-btn" onClick={p.clickAd}>Learn more</button> : null}
        {next ? (
          <button className="pill-btn next-btn" onClick={p.playNext}><Icon name="next" /> Next episode</button>
        ) : null}
        {!live ? <button className="pill-btn ghost nb-speed" onClick={p.cycleRate} disabled={!content} aria-label={`Playback speed ${p.rate}x`}>{p.rate}×</button> : null}
        <button className={`round-btn${fav ? " on" : ""}`} aria-pressed={fav} onClick={() => p.toggleFavEp(p.show, p.ep)} aria-label={fav ? "Remove episode from favorites" : "Save episode to favorites"}>
          <Icon name={fav ? "heartFill" : "heart"} />
        </button>
        <button className="round-btn" onClick={() => p.share(live
          ? { title: p.show.title, text: `Listening to ${p.show.title} live on yappr`, url: p.show.website || window.location.origin }
          : { title: p.ep.title, text: `${p.ep.title} from ${p.show.title}, on yappr`, url: showUrl(p.show.id, p.ep.id) })} aria-label={live ? "Share station" : "Share episode"}>
          <Icon name="share" />
        </button>
      </div>

      <button className="icon-btn nb-expand" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} aria-label={expanded ? "Fewer controls" : "More controls"}>
        <Icon name="up" />
      </button>
    </div>
  );
}

export function DebugPanel({ open, onClose }) {
  const p = usePlayer();
  if (!open) return null;
  const mode = process.env.NEXT_PUBLIC_VAST_PREROLL_URL || process.env.NEXT_PUBLIC_VAST_POSTROLL_URL
    ? "VAST ad tags are configured."
    : "No VAST tags set, so house ads from public/ads/house-ads.json are used.";
  return (
    <aside className="dev open" aria-label="Ad events">
      <div className="dev-head">
        <b>Ad events</b>
        <button className="icon-btn" onClick={onClose} aria-label="Close ad events"><Icon name="close" /></button>
      </div>
      <p>{mode} Every request and tracking ping shows up here.</p>
      <ul className="dev-log">
        {p.logs.length ? (
          p.logs.map((l, i) => (
            <li key={l.t + "-" + i}>
              <time>{new Date(l.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
              <span>{l.msg}</span>
            </li>
          ))
        ) : (
          <li className="none">Play an episode to see ad requests and tracking events.</li>
        )}
      </ul>
    </aside>
  );
}
