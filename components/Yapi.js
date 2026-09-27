"use client";

// yapi, the AI search. Loaded only when someone opens Ask yapi.
import { useEffect, useRef, useState } from "react";
import { usePlayer } from "./PlayerProvider";
import Icon from "./Icon";
import { findCountry } from "@/lib/countries";
import { PostCard } from "./Social";
import { EpisodeCard, ShowGrid, StationTile, TopicChips } from "./App";

export default YapiView;

/* ---------- yapi: AI search ---------- */

const YAPI_SUGGESTIONS = [
  "Something funny for a 30-minute drive",
  "Catch me up on today's news",
  "Podcasts like Serial",
  "Chill radio for working",
  "What's everyone talking about this week?",
  "A true story to fall asleep to",
];
const THINKING = ["Listening in…", "Searching millions of shows…", "Checking what's trending…", "Picking the best ones…"];

function YapiView({ panel, country, openTopic, switcher }) {
  const player = usePlayer();
  const [msgs, setMsgs] = useState([]); // { role, text, results?, error? }
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const lang = findCountry(country).lang;

  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
  useEffect(() => {
    if (!busy) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1800);
    return () => clearInterval(iv);
  }, [busy]);
  useEffect(() => { if (msgs.length) endRef.current && endRef.current.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, busy]);

  const send = async (raw) => {
    const text = String(raw || input).trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user", text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setTick(0);
    try {
      const res = await fetch("/api/yapi", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text })), country: country || "us", lang }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "yapi couldn't answer that. Try again.");
      setMsgs((m) => [...m, { role: "assistant", text: d.text, results: d.results }]);
    } catch (x) {
      setMsgs((m) => [...m, { role: "assistant", text: x.message, error: true }]);
    }
    setBusy(false);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  };

  const inputBox = (
      <form className={`yapi-input${msgs.length ? " sticky" : ""}${player.ep ? " above-player" : ""}`} onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="yapi-q">Ask yapi</label>
        <input id="yapi-q" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value.slice(0, 500))} placeholder={msgs.length ? "Ask a follow-up…" : "What do you feel like listening to?"} autoComplete="off" disabled={busy} />
        <button className="nb-play" type="submit" disabled={busy || !input.trim()} aria-label="Ask yapi"><Icon name="send" /></button>
      </form>
  );

  return (
    <section className="sec yapi">
      <h1 className="view-h">Search</h1>
      {switcher}
      {!msgs.length ? (
        <div className="yapi-intro">
          <span className="yapi-mark big"><Icon name="sparkle" /></span>
          <h2>Ask yapi</h2>
          <p>Tell yapi what you're in the mood for, where you're headed, or what you want to hear about. It searches millions of podcasts and thousands of live stations for you.</p>
          {inputBox}
          <div className="chips">
            {YAPI_SUGGESTIONS.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}
          </div>
        </div>
      ) : null}

      <div className="yapi-thread" aria-live="polite">
        {msgs.map((m, i) => (m.role === "user" ? (
          <div key={i} className="yapi-you"><p>{m.text}</p></div>
        ) : (
          <div key={i} className={`yapi-answer${m.error ? " error" : ""}`}>
            <span className="yapi-mark"><Icon name="sparkle" /></span>
            <div className="yapi-body">
              <p className="yapi-text">{m.text}</p>
              {m.results ? <YapiResults r={m.results} idx={i} panel={panel} openTopic={openTopic} /> : null}
            </div>
          </div>
        )))}
        {busy ? (
          <div className="yapi-answer thinking">
            <span className="yapi-mark spin"><Icon name="sparkle" /></span>
            <div className="yapi-body"><p className="yapi-text">{THINKING[tick % THINKING.length]}</p></div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {msgs.length ? inputBox : null}
      <p className="yapi-note">yapi is AI and can get things wrong. It only suggests shows and stations it actually found on yappr.{msgs.length ? <> <button className="text-btn" onClick={() => setMsgs([])}>Start over</button></> : null}</p>
    </section>
  );
}

function YapiResults({ r, idx, panel, openTopic }) {
  const any = r.episodes.length || r.shows.length || r.stations.length || r.topics.length || r.posts.length;
  if (!any) return null;
  return (
    <div className="yapi-results">
      {r.episodes.length ? <div className="list">{r.episodes.map((x) => <EpisodeCard key={x.ep.id} show={x.show} ep={x.ep} onPlay={panel.onPlay} />)}</div> : null}
      {r.shows.length ? <ShowGrid gridId={`yapi-${idx}`} data={{ state: "ok", feeds: r.shows }} {...panel} emptyText="" /> : null}
      {r.stations.length ? <div className="shelf-row">{r.stations.map((st) => <StationTile key={st.id} st={st} />)}</div> : null}
      {r.topics.length ? <TopicChips topics={r.topics.map((t) => ({ topic: t }))} onOpen={openTopic} /> : null}
      {r.posts.length ? <div className="posts">{r.posts.map((p) => <PostCard key={p.id} post={p} compact />)}</div> : null}
    </div>
  );
}
