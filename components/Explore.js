"use client";

// Explore and topic pages. Loaded only when someone opens them.
import { useEffect, useState } from "react";
import { usePlayer } from "./PlayerProvider";
import Icon from "./Icon";
import { findCountry } from "@/lib/countries";
import { EpisodeCard, ShowGrid, StationTile, TopicChips, useFeed } from "./App";

// Evergreen topics for browsing when nothing's trending in a category you care about
const BROWSE_TOPICS = ["AI", "Politics", "Economy", "Climate", "Space", "Crypto", "Startups", "NFL", "NBA", "Soccer", "Movies", "Music", "Mental Health", "Parenting", "Fitness", "True Crime", "History", "Science"];

/* ---------- Explore and topics ---------- */

export function ExploreView({ openTopic, panel, country, onAskYapi }) {
  const player = usePlayer();
  const lang = findCountry(country).lang;
  const data = useFeed(country ? `/api/explore?lang=${lang}` : null);
  const d = data.raw || {};
  const topics = d.topics || [];
  const followed = Object.values((player.store && player.store.topics) || {});
  const big = topics.slice(0, 4);

  return (
    <section className="sec explore">
      <h1 className="view-h">Explore</h1>
      <p className="sec-note">What podcasts are talking about right now.</p>

      <button className="yapi-promo" onClick={onAskYapi}>
        <span className="yapi-mark"><Icon name="sparkle" /></span>
        <span className="meta"><b>Not sure what to play? Ask yapi</b><span className="sub">Tell it your mood, your commute or a topic, and it finds the right listen.</span></span>
        <Icon name="up" />
      </button>

      {followed.length ? (
        <div className="lib-sec">
          <div className="lib-head"><h2>Topics you follow</h2></div>
          <TopicChips topics={followed.map((t) => ({ topic: t.topic }))} onOpen={openTopic} />
        </div>
      ) : null}

      {data.state === "error" ? <div className="empty" role="alert"><b>Explore didn't load.</b>{data.error}</div> : null}

      <div className="lib-sec">
        <div className="lib-head"><h2>Trending topics</h2></div>
        {data.state === "loading" && !topics.length ? (
          <div className="chips">{Array.from({ length: 10 }).map((_, i) => <span key={i} className="chip skel" style={{ width: 80 + (i % 3) * 30 }}>&nbsp;</span>)}</div>
        ) : topics.length ? (
          <TopicChips topics={topics.slice(0, 18)} onOpen={openTopic} />
        ) : data.state === "ok" ? <p className="q-empty">Nothing is trending across enough shows yet. Try a topic below.</p> : null}
      </div>

      {big.length ? (
        <div className="lib-sec">
          <div className="lib-head"><h2>Big stories</h2></div>
          <div className="story-grid">
            {big.map((t) => (
              <button key={t.topic} className="story-card" onClick={() => openTopic(t.topic)}>
                {t.rising ? <span className="rise-pill"><Icon name="trend" />Rising</span> : null}
                <b>{t.topic}</b>
                <span>{t.shows} shows talking about it{t.recentShows ? `, ${t.recentShows} in the last 12 hours` : ""}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {(d.news || []).length ? (
        <div className="lib-sec">
          <div className="lib-head">
            <h2>Catch up on the news</h2>
            <button className="see-all play-all" onClick={() => player.playAll(d.news)}><Icon name="play" />Play all</button>
          </div>
          <div className="shelf-row wide">{d.news.map((it) => <EpisodeCard key={it.ep.id} show={it.show} ep={it.ep} onPlay={panel.onPlay} />)}</div>
        </div>
      ) : null}

      {(d.fresh || []).length ? (
        <div className="lib-sec">
          <div className="lib-head"><h2>Fresh from popular shows</h2></div>
          <div className="shelf-row wide">{d.fresh.map((it) => <EpisodeCard key={it.ep.id} show={it.show} ep={it.ep} onPlay={panel.onPlay} />)}</div>
        </div>
      ) : null}

      <div className="lib-sec">
        <div className="lib-head"><h2>Browse topics</h2></div>
        <TopicChips topics={BROWSE_TOPICS.map((t) => ({ topic: t }))} onOpen={openTopic} />
      </div>
    </section>
  );
}

export function TopicView({ q, openTopic, panel, country, onBack }) {
  const player = usePlayer();
  const [more, setMore] = useState(false);
  const lang = findCountry(country).lang;
  const data = useFeed(q && country ? `/api/topic?q=${encodeURIComponent(q)}&lang=${lang}&country=${country}` : null);
  const d = data.raw || {};
  const eps = d.episodes || [];
  const following = player.isTopicFollowed(q);
  useEffect(() => { setMore(false); }, [q]);
  if (!q) return null;

  return (
    <section className="sec topic-view">
      <div className="list-head">
        <button className="icon-btn" onClick={onBack} aria-label="Back to Explore"><Icon name="back" /></button>
        <div className="topic-title">
          <h1>{q}</h1>
          {data.state === "ok" ? <p>{eps.length ? `${eps.length} recent episodes from ${d.showCount || eps.length} shows` : "No recent episodes yet"}</p> : null}
        </div>
      </div>
      <div className="topic-actions">
        <button className={`pill-btn${following ? " ghost" : ""}`} onClick={() => player.toggleTopic(q)} aria-pressed={following}>
          <Icon name={following ? "bell" : "plus"} />{following ? "Following" : "Follow topic"}
        </button>
        {eps.length ? <button className="cta" onClick={() => player.playAll(eps.slice(0, 5))}><Icon name="play" />Play the latest</button> : null}
        <button className="round-btn" onClick={() => player.share({ title: `${q} on yappr`, text: `What podcasts are saying about ${q}`, url: `${window.location.origin}/topic/${encodeURIComponent(q)}` })} aria-label="Share topic"><Icon name="share" /></button>
      </div>

      {data.state === "error" ? <div className="empty" role="alert"><b>This topic didn't load.</b>{data.error}</div> : null}
      {data.state === "loading" && !eps.length ? <div className="list" aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="row skel" style={{ height: 92 }} />)}</div> : null}

      {eps.length ? (
        <div className="lib-sec">
          <div className="lib-head"><h2>Latest episodes</h2></div>
          <div className="list">{eps.slice(0, more ? 40 : 8).map((it) => <EpisodeCard key={it.ep.id} show={it.show} ep={it.ep} onPlay={panel.onPlay} />)}</div>
          {eps.length > 8 && !more ? <div className="center"><button className="pill-btn ghost more-btn" onClick={() => setMore(true)}>Show more episodes</button></div> : null}
        </div>
      ) : data.state === "ok" ? <div className="empty">No episodes mention {q} in the last few weeks. Try a related topic, or follow it to hear when one does.</div> : null}

      {(d.shows || []).length ? (
        <div className="lib-sec">
          <div className="lib-head"><h2>Shows about {q}</h2></div>
          <ShowGrid gridId="topic-shows" data={{ state: "ok", feeds: d.shows }} {...panel} emptyText="" />
        </div>
      ) : null}

      {(d.live || []).length ? (
        <div className="lib-sec">
          <div className="lib-head"><h2>{d.liveTitle || "Live now"}</h2></div>
          <div className="shelf-row">{d.live.map((st) => <StationTile key={st.id} st={st} />)}</div>
        </div>
      ) : null}

      {(d.related || []).length ? (
        <div className="lib-sec">
          <div className="lib-head"><h2>Related topics</h2></div>
          <TopicChips topics={d.related.map((t) => ({ topic: t }))} onOpen={openTopic} />
        </div>
      ) : null}
    </section>
  );
}
