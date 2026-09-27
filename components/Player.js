"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "./PlayerProvider";
import Icon, { Dots } from "./Icon";
import Art from "./Art";
import { clock, colorsFor, initials, length } from "@/lib/format";

const isAdPhase = (p) => p === "preroll" || p === "postroll";

function progress(p) {
  const pct = p.dur ? Math.min(100, (p.pos / p.dur) * 100) : 0;
  const loadingPre = p.phase === "loading" && p.slot === "preroll";
  const pastContent = p.phase === "postroll" || p.phase === "done" || (p.phase === "loading" && p.slot === "postroll");
  return {
    pct,
    pre: p.phase === "preroll" ? pct : loadingPre ? 0 : 100,
    main: p.phase === "content" ? pct : pastContent ? 100 : 0,
    post: p.phase === "postroll" ? pct : p.phase === "done" ? 100 : 0,
  };
}

function subtitle(p) {
  const left = Math.max(0, p.dur - p.pos);
  if (p.phase === "loading") return p.slot === "preroll" ? "Getting things ready" : "Almost done";
  if (p.phase === "preroll") return `Ad from ${p.ad.advertiser}${p.dur ? `, episode in ${clock(left)}` : ""}`;
  if (p.phase === "postroll") return `Ad from ${p.ad.advertiser}${p.dur ? `, ${clock(left)} left` : ""}`;
  if (p.phase === "done") return "Finished. Tap to see what's next";
  if (p.error) return "Audio didn't load. Tap play to retry";
  return `${p.show.title}${p.dur ? `, ${clock(left)} left` : ""}`;
}

export function MiniPlayer({ onOpen }) {
  const p = usePlayer();
  if (!p.ep) return <div className="mini" aria-hidden="true" />;
  const ad = isAdPhase(p.phase);
  const { pct } = progress(p);
  const label = p.phase === "done" ? "Play again" : p.playing ? "Pause" : "Play";
  return (
    <div className={`mini show${ad ? " is-ad" : ""}`}>
      <button className="mini-open" onClick={onOpen} aria-label="Open player">
        {ad ? (
          <span className="art mini-art ad-art" aria-hidden="true">ad</span>
        ) : (
          <Art id={p.show.id} src={p.ep.image || p.show.image} title={p.show.title} className="mini-art" />
        )}
        <span className="mini-txt">
          <b>{ad ? p.ad.advertiser : p.ep.title}</b>
          <span>{subtitle(p)}</span>
        </span>
      </button>
      <button className="pbtn" style={{ "--p": pct.toFixed(2) }} onClick={p.toggle} aria-label={label}>
        <span>{p.phase === "loading" ? <Dots /> : <Icon name={p.playing ? "pause" : "play"} />}</span>
      </button>
    </div>
  );
}

export function FullPlayer({ open, onClose, onShow, onPlay }) {
  const p = usePlayer();
  const closeRef = useRef(null);
  const [drag, setDrag] = useState(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => closeRef.current && closeRef.current.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!p.ep) return <section className="player" aria-hidden="true" />;

  const ad = isAdPhase(p.phase);
  const loading = p.phase === "loading";
  const content = p.phase === "content";
  const [c1, c2] = colorsFor(p.show.id);
  const bars = progress(p);
  const mainPct = drag != null ? drag / 10 : bars.main;
  const left = Math.max(0, p.dur - p.pos);
  const label = p.phase === "done" ? "Play again" : p.playing ? "Pause" : "Play";
  const kicker = ad ? "Quick ad" : loading ? "Loading" : p.phase === "done" ? "All done" : "Now playing";

  let next = null;
  if (p.phase === "done" && p.queue.length) {
    const i = p.queue.findIndex((e) => e.id === p.ep.id);
    if (i >= 0 && i < p.queue.length - 1) next = p.queue[i + 1];
  }

  const cls = ["player", open && "open", ad && "is-ad", content && "content", p.playing && (ad || content) && "playing"]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={cls} style={{ "--c1": c1, "--c2": c2 }} role="dialog" aria-modal="true" aria-label="Now playing" aria-hidden={!open}>
      <div className="player-inner">
        <div className="p-top">
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Minimize player">
            <Icon name="down" />
          </button>
          <span className="p-kicker">{kicker}</span>
          <span className="spacer" />
        </div>

        <div className="stage">
          <div className="blob">
            {ad ? (
              <span className="blob-txt">{p.phase === "preroll" ? "Your episode starts right after this" : "Thanks for listening"}</span>
            ) : loading ? (
              <Dots />
            ) : (
              <>
                <span className="blob-ini">{initials(p.show.title)}</span>
                {p.ep.image || p.show.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.ep.image || p.show.image} alt="" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                ) : null}
              </>
            )}
          </div>
        </div>

        <div className="p-info">
          <h2>{p.ep.title}</h2>
          <button className="p-show" onClick={() => onShow(p.show.id)}>{p.show.title}</button>
        </div>

        {ad ? (
          <div className="adbar">
            <div>
              <b>Sponsored by {p.ad.advertiser}</b>
              {p.ad.line ? <span>{p.ad.line}</span> : null}
            </div>
            {p.ad.clickThrough ? <button className="pill-btn" onClick={p.clickAd}>Learn more</button> : null}
          </div>
        ) : null}

        {p.error ? <p className="p-error" role="alert">{p.error}</p> : null}

        <div className="track">
          <div className="seg ad" title="Ad before"><i style={{ width: `${bars.pre}%` }} /></div>
          <div className="seg main" style={{ "--k": `${mainPct}%` }}>
            <i style={{ width: `${mainPct}%` }} />
            <input
              type="range"
              min="0"
              max="1000"
              value={Math.round(mainPct * 10)}
              disabled={!content}
              aria-label="Seek within episode"
              onChange={(e) => setDrag(Number(e.target.value))}
              onPointerUp={(e) => { p.seekTo((Number(e.currentTarget.value) / 1000) * p.dur); setDrag(null); }}
              onKeyUp={(e) => { p.seekTo((Number(e.currentTarget.value) / 1000) * p.dur); setDrag(null); }}
            />
          </div>
          <div className="seg ad" title="Ad after"><i style={{ width: `${bars.post}%` }} /></div>
        </div>
        <div className="times">
          <span>{content ? clock(drag != null ? (drag / 1000) * p.dur : p.pos) : ad ? "Ad" : ""}</span>
          <span>{content ? `-${clock(drag != null ? p.dur - (drag / 1000) * p.dur : left)}` : ad && p.dur ? clock(left) : ""}</span>
        </div>

        <div className="controls">
          <button className="icon-btn lg" onClick={() => p.seekBy(-15)} disabled={!content} aria-label="Back 15 seconds"><Icon name="back" /></button>
          <button className="play-big" onClick={p.toggle} aria-label={label}>
            {loading ? <Dots /> : <Icon name={p.playing ? "pause" : "play"} />}
          </button>
          <button className="icon-btn lg" onClick={() => p.seekBy(30)} disabled={!content} aria-label="Forward 30 seconds"><Icon name="fwd" /></button>
        </div>

        <div className="p-foot">
          <button className="pill-btn ghost" onClick={p.cycleRate} disabled={!content}>{p.rate}× speed</button>
          <p className="note"><i />Yellow is ads. Nothing interrupts the middle.</p>
        </div>

        {p.phase === "done" ? (
          <div className="upnext">
            {next ? (
              <>
                <p>Up next</p>
                <button className="row" onClick={() => onPlay(p.show, next, p.queue, true)}>
                  <Art id={p.show.id} src={next.image || p.show.image} title={p.show.title} />
                  <span className="meta">
                    <b>{next.title}</b>
                    <span className="sub">{p.show.title}{length(next.duration) ? `, ${length(next.duration)}` : ""}</span>
                  </span>
                  <span className="go"><Icon name="play" /></span>
                </button>
              </>
            ) : (
              <>
                <p>That's the latest from {p.show.title}.</p>
                <button className="pill-btn ghost" onClick={() => onShow(p.show.id)}>See all episodes</button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
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
