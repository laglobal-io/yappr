"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "./PlayerProvider";
import Icon, { Dots } from "./Icon";
import Art from "./Art";
import { ago, clock, length } from "@/lib/format";
import { showUrl } from "@/lib/api";

const isAdPhase = (p) => p === "preroll" || p === "postroll";
const SLEEP_OPTIONS = [15, 30, 45, 60];

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

function currentChapter(p) {
  const list = p.extras && p.extras.chapters;
  if (!list || !list.length || p.phase !== "content") return null;
  let cur = null;
  for (const c of list) { if (c.start <= p.pos + 0.5) cur = c; else break; }
  return cur;
}

// Title and subtitle for whatever is playing (episode, ad, or live station with song info)
function labels(p) {
  const ad = isAdPhase(p.phase);
  const left = Math.max(0, p.dur - p.pos);
  if (ad) return { title: `Sponsored by ${p.ad.advertiser}`, sub: p.phase === "preroll" ? `Ad${p.dur ? `, ${p.ep.live ? "station" : "episode"} in ${clock(left)}` : ""}` : "Ad, thanks for listening" };
  if (p.phase === "loading") return { title: p.ep.title, sub: p.slot === "preroll" ? "Starting up" : "Wrapping up" };
  if (p.error) return { title: p.ep.title, sub: p.ep.live ? "Stream stopped. Tap play to reconnect" : "Audio didn't load. Tap play to retry" };
  if (p.ep.live) {
    const n = p.nowPlaying;
    if (n && n.song) return { title: n.song, sub: `${n.artist ? `${n.artist}, ` : ""}live on ${p.show.title}`, art: n.art };
    if (n && n.text) return { title: p.show.title, sub: `Now: ${n.text}` };
    return { title: p.show.title, sub: `Live radio${p.show.author ? `, ${p.show.author}` : ""}` };
  }
  if (p.phase === "done") return { title: p.ep.title, sub: `${p.show.title}, finished` };
  const ch = currentChapter(p);
  return { title: p.ep.title, sub: ch ? `${p.show.title}, ${ch.title}` : p.show.title };
}

function ArtFor({ p, lab, className }) {
  const ad = isAdPhase(p.phase);
  if (ad && p.ad.companion) {
    return (
      <span className={`art companion ${className}`} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.ad.companion.image} alt="" />
      </span>
    );
  }
  if (ad) return <span className={`art ad-art ${className}`} aria-hidden="true">ad</span>;
  return <Art id={p.show.id} src={lab.art || p.ep.image || p.show.image} title={p.show.title} className={className} fit={p.ep.live && !lab.art ? "contain" : "cover"} />;
}

function Track({ p, drag, setDrag }) {
  const ad = isAdPhase(p.phase);
  const live = !!p.ep.live;
  const content = p.phase === "content" && !live;
  if (live && !ad) {
    return (
      <div className="nb-track">
        <span className={`live-pill${p.playing && p.phase === "content" ? " on" : ""}`}>Live</span>
        <span className="live-line" aria-hidden="true"><i /></span>
      </div>
    );
  }
  const bars = progress(p);
  const mainPct = drag != null ? drag / 10 : bars.main;
  const shownPos = drag != null ? (drag / 1000) * p.dur : p.pos;
  const commit = (v) => { p.seekTo((Number(v) / 1000) * p.dur); setDrag(null); };
  const chapters = content ? p.extras.chapters : [];
  return (
    <div className="nb-track">
      <span className="nb-time">{content ? clock(shownPos) : ad ? "Ad" : ""}</span>
      <div className="track">
        <div className="seg ad" title="Ad before"><i style={{ width: `${bars.pre}%` }} /></div>
        <div className={`seg main${content ? " live-thumb" : ""}`} style={{ "--k": `${mainPct}%` }}>
          <i style={{ width: `${mainPct}%` }} />
          {p.dur && chapters.length > 1 ? chapters.slice(1).map((c, i) => <b key={i} className="ch-tick" style={{ left: `${(c.start / p.dur) * 100}%` }} aria-hidden="true" />) : null}
          <input
            type="range" min="0" max="1000" value={Math.round(mainPct * 10)} disabled={!content} aria-label="Seek within episode"
            onChange={(e) => setDrag(Number(e.target.value))}
            onPointerUp={(e) => commit(e.currentTarget.value)} onKeyUp={(e) => commit(e.currentTarget.value)}
          />
        </div>
        <div className="seg ad" title="Ad after"><i style={{ width: `${bars.post}%` }} /></div>
      </div>
      <span className="nb-time">{content ? `-${clock(p.dur - shownPos)}` : ad && p.dur ? clock(p.dur - p.pos) : ""}</span>
    </div>
  );
}

function PlayControls({ p, big }) {
  const live = !!p.ep.live;
  const content = p.phase === "content" && !live;
  const label = p.phase === "done" ? "Play again" : p.playing ? "Pause" : "Play";
  return (
    <div className="nb-controls">
      {!live ? <button className="icon-btn nb-skip" onClick={() => p.seekBy(-15)} disabled={!content} aria-label="Back 15 seconds"><Icon name="rewind" /></button> : null}
      <button className={`nb-play${big ? " big" : ""}`} onClick={p.toggle} aria-label={label}>
        {p.phase === "loading" ? <Dots /> : <Icon name={p.playing ? "pause" : "play"} />}
      </button>
      {!live ? <button className="icon-btn nb-skip" onClick={() => p.seekBy(30)} disabled={!content} aria-label="Forward 30 seconds"><Icon name="fwd" /></button> : null}
    </div>
  );
}

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

// The row of options: sleep, Up next, cast, speed, watch, favorite, share, ad link
function Actions({ p, pop, setPop, showQueue }) {
  const ad = isAdPhase(p.phase);
  const live = !!p.ep.live;
  const content = p.phase === "content" && !live;
  const fav = live && p.show.station ? p.isFavStation(p.show.station.id) : p.isFavEp(p.ep.id);
  const toggleFav = () => (live && p.show.station ? p.toggleFavStation(p.show.station) : p.toggleFavEp(p.show, p.ep));
  const sleepLeft = p.sleep.mode === "time" ? Math.max(1, Math.ceil((p.sleep.until - Date.now()) / 60000)) : 0;
  const hasExtras = p.extras.chapters.length || p.extras.transcript.length;
  const next = p.phase === "done" ? p.nextInQueue() : null;
  return (
    <div className="nb-extras">
      {ad && (p.ad.clickThrough || (p.ad.companion && p.ad.companion.clickThrough)) ? <button className="pill-btn" onClick={() => p.clickAd()}>Learn more</button> : null}
      {next ? <button className="pill-btn next-btn" onClick={p.playNext}><Icon name="next" /> Next episode</button> : null}
      {p.ep.isVideo && p.phase === "content" ? (
        <button className={`pill-btn${p.videoOpen ? " ghost" : ""}`} onClick={() => p.setVideoOpen(!p.videoOpen)} aria-pressed={p.videoOpen}>
          <Icon name="video" /> {p.videoOpen ? "Hide video" : "Watch"}
        </button>
      ) : null}
      <button className={`round-btn sleep-btn${p.sleep.mode !== "off" ? " on" : ""}`} onClick={() => setPop(pop === "sleep" ? null : "sleep")} aria-expanded={pop === "sleep"}
        aria-label={p.sleep.mode === "time" ? `Sleep timer, ${sleepLeft} minutes left` : p.sleep.mode === "end" ? "Sleep timer, end of episode" : "Sleep timer"}>
        <Icon name="moon" />
        {p.sleep.mode === "time" ? <span className="btn-badge">{sleepLeft}m</span> : p.sleep.mode === "end" ? <span className="btn-badge">End</span> : null}
      </button>
      {showQueue ? (
        <button className={`round-btn${pop === "panel" ? " on" : ""}`} onClick={() => setPop(pop === "panel" ? null : "panel")} aria-expanded={pop === "panel"}
          aria-label={hasExtras ? "Up next, chapters and transcript" : "Up next"}>
          <Icon name="queue" />
          {p.upNext.length ? <span className="btn-badge">{p.upNext.length}</span> : hasExtras ? <span className="btn-dot" aria-hidden="true" /> : null}
        </button>
      ) : null}
      {p.castSupported ? <button className="round-btn" onClick={p.cast} aria-label="Play on a speaker or TV"><Icon name="cast" /></button> : null}
      {!live ? <button className="pill-btn ghost nb-speed" onClick={p.cycleRate} disabled={!content} aria-label={`Playback speed ${p.rate}x`}>{p.rate}×</button> : null}
      <button className={`round-btn${fav ? " on" : ""}`} aria-pressed={fav} onClick={toggleFav} aria-label={fav ? "Remove from favorites" : "Save to favorites"}>
        <Icon name={fav ? "heartFill" : "heart"} />
      </button>
      <button className="round-btn" onClick={() => p.share(live
        ? { title: p.show.title, text: `Listening to ${p.show.title} live on yappr`, url: p.show.website || window.location.origin }
        : { title: p.ep.title, text: `${p.ep.title} from ${p.show.title}, on yappr`, url: showUrl(p.show.id, p.ep.id) })} aria-label={live ? "Share station" : "Share episode"}>
        <Icon name="share" />
      </button>
    </div>
  );
}

/* ---------- detail tabs: Song, Up next, Chapters, Transcript, About ---------- */

function SongTab({ p }) {
  const n = p.nowPlaying;
  const earlier = p.songHistory.filter((h) => !(n && h.song === n.song && h.artist === n.artist));
  return (
    <div className="song-tab">
      {n && n.song ? (
        <div className="song-now">
          {n.art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.art} alt="" />
          ) : <span className="song-note"><Icon name="radio" /></span>}
          <div>
            <span className="eyebrow-soft">Playing now</span>
            <b>{n.song}</b>
            {n.artist ? <span>{n.artist}</span> : null}
          </div>
        </div>
      ) : n && n.text ? (
        <p className="q-empty">On air: <b>{n.text}</b></p>
      ) : (
        <p className="q-empty">{p.phase === "content" ? "This station isn't sharing song info right now. It may be on a talk segment or ad break." : "Song info appears once the station starts playing."}</p>
      )}
      {earlier.length ? (
        <>
          <h4 className="tab-sub">Played earlier</h4>
          <ul className="song-list">
            {earlier.map((h, i) => (
              <li key={i}>
                <span className="cue-time">{new Date(h.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                <span><b>{h.song}</b>{h.artist ? <small>{h.artist}</small> : null}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function AboutTab({ p, onOpenShow }) {
  if (p.ep.live) {
    const st = p.show.station || {};
    return (
      <div className="about-tab">
        <b className="about-title">{p.show.title}</b>
        <p className="about-meta">{[st.country, (st.tags || []).join(", ")].filter(Boolean).join(". ")}</p>
        {st.network === "SomaFM" ? <p className="about-desc">SomaFM is listener-supported and commercial-free, so yappr doesn't play ads before it.</p> : null}
        <div className="about-links">
          {p.show.website ? <a className="pill-link" href={p.show.website} target="_blank" rel="noopener noreferrer">Station website</a> : null}
          {st.network === "SomaFM" ? <a className="pill-link" href="https://somafm.com/support/" target="_blank" rel="noopener noreferrer">Support SomaFM</a> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="about-tab">
      <b className="about-title">{p.ep.title}</b>
      <p className="about-meta">{[p.ep.published ? ago(p.ep.published) : "", length(p.ep.duration)].filter(Boolean).join(", ")}</p>
      {p.ep.description ? <p className="about-desc">{p.ep.description}</p> : null}
      <button className="pill-btn ghost" onClick={() => onOpenShow(p.show.id)}>See all episodes of {p.show.title}</button>
    </div>
  );
}

function DetailTabs({ p, tab, setTab, big, onOpenShow }) {
  const listRef = useRef(null);
  const [follow, setFollow] = useState(true);
  const live = !!p.ep.live;
  const chapters = p.extras.chapters;
  const transcript = p.extras.transcript;
  const tabs = [];
  if (live) tabs.push({ id: "song", label: "Song" });
  if (!live) tabs.push({ id: "queue", label: "Up next" });
  if (chapters.length) tabs.push({ id: "chapters", label: `Chapters (${chapters.length})` });
  if (transcript.length) tabs.push({ id: "transcript", label: "Transcript" });
  if (big) tabs.push({ id: "about", label: "About" });
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;
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
    <div className="detail-tabs">
      <div className="panel-tabs" role="tablist">
        {tabs.map((t) => <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      <div className="bar-panel-body" ref={listRef}>
        {active === "song" ? <SongTab p={p} /> : active === "about" ? <AboutTab p={p} onOpenShow={onOpenShow} /> : active === "queue" ? (
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
            ) : <p className="q-empty">Nothing queued. Tap <Icon name="queue" /> on any episode to add it here.</p>}
            <div className="q-auto">
              <div>
                <b>Autoplay</b>
                <span>{next ? `Then keep going with “${next.title}”` : "Keep playing the show's next episode"}</span>
              </div>
              <button className={`toggle${p.autoplay ? " on" : ""}`} role="switch" aria-checked={p.autoplay} aria-label="Autoplay" onClick={() => p.setAutoplay(!p.autoplay)} />
            </div>
          </>
        ) : active === "chapters" ? (
          <ol className="ch-list">
            {chapters.map((c, i) => (
              <li key={i}>
                <button className={curChapter === c ? "on" : ""} onClick={() => p.seekTo(c.start)} disabled={!content}>
                  <span className="ch-time">{clock(c.start)}</span><span>{c.title}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <>
            {p.extras.timed ? <label className="follow"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow along</label> : null}
            <div className="tr-list">
              {transcript.map((c, i) => (c.start != null ? (
                <button key={i} data-cue={i} className={`cue${i === activeCue ? " on" : ""}`} onClick={() => p.seekTo(c.start)} disabled={!content}>
                  {c.speaker && (i === 0 || transcript[i - 1].speaker !== c.speaker) ? <b className="spk">{c.speaker}</b> : null}
                  <span className="cue-time">{clock(c.start)}</span> {c.text}
                </button>
              ) : <p key={i} className="cue plain">{c.text}</p>))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- the play bar, which expands into a full "Now playing" view ---------- */

export function NowBar({ onOpenShow }) {
  const p = usePlayer();
  const [big, setBig] = useState(false);
  const [drag, setDrag] = useState(null);
  const [pop, setPop] = useState(null); // "sleep" | "panel"
  const [tab, setTab] = useState("queue");
  const barRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!pop) return;
    const onDown = (e) => { if (barRef.current && !barRef.current.contains(e.target)) setPop(null); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pop]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { if (pop) setPop(null); else setBig(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pop]);
  useEffect(() => {
    document.body.classList.toggle("player-open", big);
    if (big) setTimeout(() => closeRef.current && closeRef.current.focus(), 60);
  }, [big]);
  // Live stations open on the Song tab, episodes on Up next
  const kind = p.ep ? (p.ep.live ? "live" : "ep") : null;
  useEffect(() => { setTab(kind === "live" ? "song" : "queue"); }, [kind]);

  if (!p.ep) return <div className="nowbar" aria-hidden="true" />;

  const ad = isAdPhase(p.phase);
  const live = !!p.ep.live;
  const lab = labels(p);
  const openShow = (id) => { setBig(false); onOpenShow(id); };
  const stateCls = [ad && "is-ad", live && "is-live", p.playing && (ad || p.phase === "content") && "playing"].filter(Boolean).join(" ");

  if (big) {
    return (
      <>
        <div className="player-scrim" onClick={() => setBig(false)} />
        <section className={`nowbar show big ${stateCls}`} role="dialog" aria-modal="true" aria-label="Now playing" ref={barRef}>
          <div className="big-head">
            <button ref={closeRef} className="icon-btn" onClick={() => setBig(false)} aria-label="Shrink player"><Icon name="down" /></button>
            <span className="big-kicker">{ad ? "Quick ad" : live ? "Live radio" : p.phase === "done" ? "All done" : "Now playing"}</span>
            <span className="big-spacer" />
          </div>
          <div className="big-body">
            <div className="big-left">
              <div className="big-art-wrap"><ArtFor p={p} lab={lab} className="big-art" /></div>
              <div className="big-titles">
                <h2>{lab.title}</h2>
                <button className="nb-sub" onClick={() => (live ? null : openShow(p.show.id))}>{lab.sub}</button>
              </div>
              <Track p={p} drag={drag} setDrag={setDrag} />
              <PlayControls p={p} big />
              <div className="big-actions">
                {pop === "sleep" ? <SleepMenu p={p} onClose={() => setPop(null)} /> : null}
                <Actions p={p} pop={pop} setPop={setPop} showQueue={false} />
              </div>
            </div>
            <div className="big-right">
              <DetailTabs p={p} tab={tab} setTab={setTab} big onOpenShow={openShow} />
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <div className={`nowbar show ${stateCls}`} role="region" aria-label="Now playing" ref={barRef}>
      {pop === "sleep" ? <SleepMenu p={p} onClose={() => setPop(null)} /> : null}
      {pop === "panel" ? <div className="bar-pop bar-panel"><DetailTabs p={p} tab={tab} setTab={setTab} onOpenShow={openShow} /></div> : null}
      <button className="nb-art-btn" onClick={() => setBig(true)} aria-label="Open the full player">
        <ArtFor p={p} lab={lab} className="nb-art" />
      </button>
      <button className="nb-text" onClick={() => setBig(true)} aria-label={`${lab.title}. Open the full player`}>
        <b>{lab.title}</b>
        <span className="nb-sub">{lab.sub}</span>
      </button>
      <PlayControls p={p} />
      <Track p={p} drag={drag} setDrag={setDrag} />
      <Actions p={p} pop={pop} setPop={setPop} showQueue />
      <button className="icon-btn nb-expand" onClick={() => setBig(true)} aria-label="Open the full player"><Icon name="up" /></button>
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
