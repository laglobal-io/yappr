"use client";

import { useEffect, useRef, useState } from "react";
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
  if (p.ep.live) return p.nowPlaying ? `Now: ${p.nowPlaying}` : `Live radio${p.show.author ? `, ${p.show.author}` : ""}`;
  const ch = currentChapter(p);
  return ch ? `${p.show.title}, ${ch.title}` : p.show.title;
}

function currentChapter(p) {
  const list = p.extras && p.extras.chapters;
  if (!list || !list.length || p.phase !== "content") return null;
  let cur = null;
  for (const c of list) { if (c.start <= p.pos + 0.5) cur = c; else break; }
  return cur;
}

const SLEEP_OPTIONS = [15, 30, 45, 60];

function SleepMenu({ p, onClose }) {
  const pick = (v) => { p.setSleep(v); onClose(); };
  return (
    <div className="bar-pop sleep-pop" role="menu" aria-label="Sleep timer">
      <b>Sleep timer</b>
      {SLEEP_OPTIONS.map((m) => <button key={m} role="menuitem" onClick={() => pick(m)}>{m} minutes</button>)}
      {!p.ep.live ? <button role="menuitem" onClick={() => pick("end")}>End of this episode</button> : null}
      {p.sleep.mode !== "off" ? <button role="menuitem" className="off" onClick={() => pick("off")}>Turn off</button> : null}
    </div>
  );
}

// Up next, chapters and transcript, in one panel above the bar
function BarPanel({ p, tab, setTab }) {
  const listRef = useRef(null);
  const [follow, setFollow] = useState(true);
  const chapters = p.extras.chapters;
  const transcript = p.extras.transcript;
  const tabs = [{ id: "queue", label: "Up next" }];
  if (chapters.length) tabs.push({ id: "chapters", label: "Chapters" });
  if (transcript.length) tabs.push({ id: "transcript", label: "Transcript" });
  const active = tabs.some((t) => t.id === tab) ? tab : "queue";
  const content = p.phase === "content";

  let activeCue = -1;
  if (active === "transcript" && p.extras.timed && content) {
    for (let i = 0; i < transcript.length; i++) { if (transcript[i].start != null && transcript[i].start <= p.pos + 0.3) activeCue = i; else if (transcript[i].start != null) break; }
  }
  const curChapter = currentChapter(p);

  useEffect(() => {
    if (!follow || activeCue < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-cue="${activeCue}"]`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeCue, follow]);

  const next = p.nextInQueue();
  return (
    <div className="bar-pop bar-panel" role="dialog" aria-label="Up next, chapters and transcript">
      <div className="panel-tabs" role="tablist">
        {tabs.map((t) => <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      <div className="bar-panel-body" ref={listRef}>
        {active === "queue" ? (
          <>
            {p.upNext.length ? (
              <ul className="q-list">
                {p.upNext.map((x) => (
                  <li key={x.ep.id}>
                    <button className="q-play" onClick={() => p.playQueued(x.ep.id)}>
                      <Art id={x.show.id} src={x.ep.image || x.show.image} title={x.show.title} />
                      <span><b>{x.ep.title}</b><small>{x.show.title}</small></span>
                    </button>
                    <button className="icon-btn q-remove" onClick={() => p.removeFromQueue(x.ep.id)} aria-label={`Remove ${x.ep.title} from Up next`}><Icon name="close" /></button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="q-empty">Nothing queued. Tap <Icon name="queue" /> on any episode to add it here.</p>
            )}
            {!p.ep.live ? (
              <div className="q-auto">
                <div>
                  <b>Autoplay</b>
                  <span>{next ? `Then keep going with “${next.title}”` : "Keep playing the show's next episode"}</span>
                </div>
                <button className={`toggle${p.autoplay ? " on" : ""}`} role="switch" aria-checked={p.autoplay} aria-label="Autoplay" onClick={() => p.setAutoplay(!p.autoplay)} />
              </div>
            ) : null}
          </>
        ) : active === "chapters" ? (
          <ol className="ch-list">
            {chapters.map((c, i) => (
              <li key={i}>
                <button className={curChapter === c ? "on" : ""} onClick={() => p.seekTo(c.start)} disabled={!content}>
                  <span className="ch-time">{clock(c.start)}</span>
                  <span>{c.title}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <>
            {p.extras.timed ? (
              <label className="follow"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow along</label>
            ) : null}
            <div className="tr-list">
              {transcript.map((c, i) => (
                c.start != null ? (
                  <button key={i} data-cue={i} className={`cue${i === activeCue ? " on" : ""}`} onClick={() => p.seekTo(c.start)} disabled={!content}>
                    {c.speaker && (i === 0 || transcript[i - 1].speaker !== c.speaker) ? <b className="spk">{c.speaker}</b> : null}
                    <span className="cue-time">{clock(c.start)}</span> {c.text}
                  </button>
                ) : <p key={i} className="cue plain">{c.text}</p>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// The only player UI: a bar that slides up from the bottom when something plays.
export function NowBar({ onOpenShow }) {
  const p = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const [drag, setDrag] = useState(null);
  const [pop, setPop] = useState(null); // "sleep" | "panel"
  const [tab, setTab] = useState("queue");
  const barRef = useRef(null);

  useEffect(() => {
    if (!pop) return;
    const onDown = (e) => { if (barRef.current && !barRef.current.contains(e.target)) setPop(null); };
    const onKey = (e) => { if (e.key === "Escape") setPop(null); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [pop]);

  if (!p.ep) return <div className="nowbar" aria-hidden="true" />;
  const sleepLeft = p.sleep.mode === "time" ? Math.max(1, Math.ceil((p.sleep.until - Date.now()) / 60000)) : 0;
  const hasExtras = p.extras.chapters.length || p.extras.transcript.length;

  const ad = isAdPhase(p.phase);
  const loading = p.phase === "loading";
  const live = !!p.ep.live;
  const content = p.phase === "content" && !live;
  const bars = progress(p);
  const mainPct = drag != null ? drag / 10 : bars.main;
  const shownPos = drag != null ? (drag / 1000) * p.dur : p.pos;
  const fav = live && p.show.station ? p.isFavStation(p.show.station.id) : p.isFavEp(p.ep.id);
  const toggleFav = () => (live && p.show.station ? p.toggleFavStation(p.show.station) : p.toggleFavEp(p.show, p.ep));
  const next = p.phase === "done" ? p.nextInQueue() : null;
  const label = p.phase === "done" ? "Play again" : p.playing ? "Pause" : "Play";
  const commit = (v) => { p.seekTo((Number(v) / 1000) * p.dur); setDrag(null); };

  const cls = ["nowbar", "show", ad && "is-ad", live && "is-live", expanded && "expanded", p.playing && (ad || p.phase === "content") && "playing"].filter(Boolean).join(" ");

  return (
    <div className={cls} role="region" aria-label="Now playing" ref={barRef}>
      {pop === "sleep" ? <SleepMenu p={p} onClose={() => setPop(null)} /> : null}
      {pop === "panel" ? <BarPanel p={p} tab={tab} setTab={setTab} /> : null}
      {ad && p.ad.companion ? (
        // The advertiser's banner stands in for the artwork while their ad plays
        <button className="nb-art-btn" onClick={() => p.clickAd(p.ad.companion.clickThrough)} aria-label={`Visit ${p.ad.advertiser}`}>
          <span className="art nb-art companion" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.ad.companion.image} alt="" />
          </span>
        </button>
      ) : (
        <button className="nb-art-btn" onClick={() => onOpenShow(p.show.id)} aria-label={`Open ${p.show.title}`}>
          {ad ? <span className="art nb-art ad-art" aria-hidden="true">ad</span> : <Art id={p.show.id} src={p.ep.image || p.show.image} title={p.show.title} className="nb-art" />}
        </button>
      )}

      <div className="nb-text">
        <b title={p.ep.title}>{ad ? `Sponsored by ${p.ad.advertiser}` : p.ep.title}</b>

        <button className="nb-sub" onClick={() => onOpenShow(p.show.id)}>{subtitle(p)}</button>
      </div>

      <div className="nb-controls">
        {!live ? <button className="icon-btn nb-skip" onClick={() => p.seekBy(-15)} disabled={!content} aria-label="Back 15 seconds"><Icon name="rewind" /></button> : null}
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
        {ad && (p.ad.clickThrough || (p.ad.companion && p.ad.companion.clickThrough)) ? <button className="pill-btn" onClick={() => p.clickAd()}>Learn more</button> : null}
        {next ? (
          <button className="pill-btn next-btn" onClick={p.playNext}><Icon name="next" /> Next episode</button>
        ) : null}
        <button className={`round-btn sleep-btn${p.sleep.mode !== "off" ? " on" : ""}`} onClick={() => setPop(pop === "sleep" ? null : "sleep")} aria-expanded={pop === "sleep"}
          aria-label={p.sleep.mode === "time" ? `Sleep timer, ${sleepLeft} minutes left` : p.sleep.mode === "end" ? "Sleep timer, end of episode" : "Sleep timer"}>
          <Icon name="moon" />
          {p.sleep.mode === "time" ? <span className="btn-badge">{sleepLeft}m</span> : p.sleep.mode === "end" ? <span className="btn-badge">End</span> : null}
        </button>
        <button className={`round-btn${pop === "panel" ? " on" : ""}`} onClick={() => setPop(pop === "panel" ? null : "panel")} aria-expanded={pop === "panel"}
          aria-label={hasExtras ? "Up next, chapters and transcript" : "Up next"}>
          <Icon name="queue" />
          {p.upNext.length ? <span className="btn-badge">{p.upNext.length}</span> : hasExtras ? <span className="btn-dot" aria-hidden="true" /> : null}
        </button>
        {p.castSupported ? <button className="round-btn" onClick={p.cast} aria-label="Play on a speaker or TV"><Icon name="cast" /></button> : null}
        {!live ? <button className="pill-btn ghost nb-speed" onClick={p.cycleRate} disabled={!content} aria-label={`Playback speed ${p.rate}x`}>{p.rate}×</button> : null}
        {p.ep.isVideo && p.phase === "content" ? (
          <button className={`pill-btn${p.videoOpen ? " ghost" : ""}`} onClick={() => p.setVideoOpen(!p.videoOpen)} aria-pressed={p.videoOpen}>
            <Icon name="video" /> {p.videoOpen ? "Hide video" : "Watch"}
          </button>
        ) : null}
        <button className={`round-btn${fav ? " on" : ""}`} aria-pressed={fav} onClick={toggleFav} aria-label={fav ? "Remove from favorites" : "Save to favorites"}>
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
