"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { usePlayer } from "./PlayerProvider";
import Art from "./Art";
import Icon from "./Icon";
import { clock } from "@/lib/format";
import * as S from "@/lib/social";
import { useFocusTrap } from "@/lib/useFocusTrap";

/* ================= context: your profile, sign-in checks, the composer ================= */

const SocialCtx = createContext(null);
export const useSocial = () => useContext(SocialCtx);

export function SocialProvider({ children }) {
  const auth = useAuth();
  const [profile, setProfile] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [setup, setSetup] = useState(false); // show the "pick a handle" card
  const [composer, setComposer] = useState(null); // { attach, atSeconds, onPosted }
  const pending = useRef(null);
  const navRef = useRef({ openPost: () => {}, openProfile: () => {} });

  useEffect(() => {
    if (!auth.enabled || !auth.user) { setProfile(null); setLoaded(!auth.enabled || auth.ready); return; }
    S.myProfile(auth.user.id).then((p) => { setProfile(p); setLoaded(true); }).catch(() => setLoaded(true));
  }, [auth.enabled, auth.user, auth.ready]);

  // Call before any interaction. Sends people to sign in, then to pick a handle, then runs the action.
  const ensure = useCallback((then) => {
    if (!auth.enabled) return false;
    if (!auth.user) { auth.setMenuOpen(true); return false; }
    if (!profile) { pending.current = then || null; setSetup(true); return false; }
    return true;
  }, [auth, profile]);

  const compose = useCallback((opts = {}) => {
    const open = () => setComposer(opts);
    if (ensure(open)) open();
  }, [ensure]);

  const onProfileSaved = (p) => {
    setProfile(p);
    setSetup(false);
    const next = pending.current;
    pending.current = null;
    if (next) setTimeout(next, 0);
  };

  const value = {
    enabled: auth.enabled, user: auth.user, profile, loaded, ensure, compose, setProfile, editProfile: () => setSetup(true),
    setNav: (n) => { navRef.current = n; },
    openPost: (p) => navRef.current.openPost(p),
    openProfile: (h) => navRef.current.openProfile(h),
  };
  return (
    <SocialCtx.Provider value={value}>
      {children}
      {setup ? <ProfileSetup onClose={() => setSetup(false)} onSaved={onProfileSaved} /> : null}
      {composer ? (
        <Modal onClose={() => setComposer(null)} label="New post">
          <Composer attach={composer.attach} atSeconds={composer.atSeconds} quoteOf={composer.quoteOf} autoFocus
            onPosted={(p) => { setComposer(null); composer.onPosted && composer.onPosted(p); }} />
        </Modal>
      ) : null}
    </SocialCtx.Provider>
  );
}

function Modal({ children, onClose, label }) {
  const cardRef = useRef(null);
  useFocusTrap(cardRef);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label={label}>
      <div className="player-scrim" onClick={onClose} />
      <div className="modal-card" ref={cardRef}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        {children}
      </div>
    </div>
  );
}

/* ================= profile setup ================= */

function ProfileSetup({ onClose, onSaved }) {
  const auth = useAuth();
  const social = useSocial();
  const u = auth.user;
  const existing = social && social.profile;
  const suggested = ((u && u.email) || "").split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
  const [handle, setHandle] = useState(existing ? existing.handle : suggested.length >= 3 ? suggested : "");
  const [name, setName] = useState(existing ? existing.display_name : (u && u.user_metadata && u.user_metadata.full_name) || "");
  const [bio, setBio] = useState(existing ? existing.bio : "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    const h = handle.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(h)) { setErr("Handles are 3 to 20 lowercase letters, numbers or underscores."); return; }
    if (!name.trim()) { setErr("Add a display name."); return; }
    setBusy(true);
    try {
      const avatar = (u.user_metadata && u.user_metadata.avatar_url) || (existing && existing.avatar_url) || "";
      onSaved(await S.saveProfile(u.id, { handle: h, display_name: name.trim(), bio: bio.trim(), avatar_url: avatar }));
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <Modal onClose={onClose} label="Your profile">
      <form className="setup" onSubmit={save} noValidate>
        <h2>{existing ? "Edit your profile" : "Pick your handle"}</h2>
        <p className="sec-note left">{existing ? "This is how people see you on yappr." : "You'll need one to post, comment and follow people. You can change it later."}</p>
        <label>Handle
          <span className="handle-input"><span>@</span><input value={handle} onChange={(e) => { setHandle(e.target.value.toLowerCase()); setErr(""); }} maxLength={20} autoComplete="off" autoFocus /></span>
        </label>
        <label>Display name<input value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} maxLength={50} /></label>
        <label>Bio <small>(optional)</small><textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={3} /></label>
        {err ? <p className="acct-err" role="alert">{err}</p> : null}
        <button className="cta wide" type="submit" disabled={busy}>{busy ? "Saving…" : existing ? "Save" : "Continue"}</button>
      </form>
    </Modal>
  );
}

/* ================= small pieces ================= */

const timeAgo = (iso) => {
  const s = Math.max(1, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function ProfileAvatar({ p, size = 40 }) {
  const name = (p && (p.display_name || p.handle)) || "?";
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {p && p.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatar_url} alt="" referrerPolicy="no-referrer" />
      ) : name.trim()[0].toUpperCase()}
    </span>
  );
}

export function Verified({ kind }) {
  if (!kind) return null;
  const label = kind === "network" ? "Verified network" : kind === "staff" ? "yappr team" : "Verified host";
  return <span className={`verified ${kind}`} title={label} aria-label={label}><Icon name="check" /></span>;
}

function Attachment({ a, atSeconds }) {
  const player = usePlayer();
  if (!a) return null;
  if (a.station) {
    return (
      <button className="attach" onClick={() => player.playStation(a.station)}>
        <Art id={a.station.id} src={a.station.image} title={a.station.name} fit="contain" />
        <span className="attach-meta"><b>{a.station.name}</b><small>Live radio</small></span>
        <span className="go"><Icon name="play" /></span>
      </button>
    );
  }
  if (!a.ep || !a.show) return null;
  const start = () => (Number.isFinite(atSeconds) && atSeconds > 0 ? player.playAt(a.show, a.ep, [], atSeconds) : player.play(a.show, a.ep, []));
  return (
    <button className="attach" onClick={start}>
      <Art id={a.show.id} src={a.ep.image || a.show.image} title={a.show.title} />
      <span className="attach-meta">
        <b>{a.ep.title}</b>
        <small>{a.show.title}{Number.isFinite(atSeconds) && atSeconds > 0 ? `, from ${clock(atSeconds)}` : ""}</small>
      </span>
      <span className="go"><Icon name="play" /></span>
    </button>
  );
}

/* ================= a post (also used for comments) ================= */

export function PostCard({ post, mine, hosts, onOpen: openProp, onOpenProfile: profileProp, onDeleted, compact }) {
  const social = useSocial();
  const onOpen = openProp || social.openPost;
  const onOpenProfile = profileProp || social.openProfile;
  const player = usePlayer();
  const isRepost = post.kind === "repost" && post.original;
  const shown = isRepost && !post.body ? post.original : post; // plain reposts show the original
  const [vote, setVote] = useState((mine && mine.votes[shown.id]) || 0);
  const [liked, setLiked] = useState(!!(mine && mine.likes.has(shown.id)));
  const [reposted, setReposted] = useState(!!(mine && mine.reposts.has(shown.id)));
  const [counts, setCounts] = useState({ up: shown.up_count, down: shown.down_count, like: shown.like_count, repost: shown.repost_count, reply: shown.reply_count });
  const [menu, setMenu] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    setVote((mine && mine.votes[shown.id]) || 0);
    setLiked(!!(mine && mine.likes.has(shown.id)));
    setReposted(!!(mine && mine.reposts.has(shown.id)));
  }, [mine, shown.id]);

  if (gone) return null;
  const me = social.user && social.user.id;
  const act = (fn) => (e) => { e.stopPropagation(); if (social.ensure()) fn(); };
  const fail = (x) => player.notify(x.message);

  const doVote = (v) => {
    const next = vote === v ? 0 : v;
    setCounts((c) => ({ ...c, up: c.up + (next === 1) - (vote === 1), down: c.down + (next === -1) - (vote === -1) }));
    setVote(next);
    S.vote(me, shown.id, next).catch(fail);
  };
  const doLike = () => {
    setCounts((c) => ({ ...c, like: c.like + (liked ? -1 : 1) }));
    setLiked(!liked);
    S.like(me, shown.id, !liked).catch(fail);
  };
  const doRepost = () => {
    setCounts((c) => ({ ...c, repost: c.repost + (reposted ? -1 : 1) }));
    setReposted(!reposted);
    S.repost(me, shown, !reposted).then(() => player.notify(reposted ? "Repost removed" : "Reposted")).catch(fail);
  };
  const quote = () => social.compose({ quoteOf: shown });
  const share = (e) => {
    e.stopPropagation();
    player.share({ title: `Post by @${shown.author.handle}`, text: shown.body ? shown.body.slice(0, 120) : "On yappr", url: `${window.location.origin}/post/${shown.id}` });
  };
  const remove = async () => {
    setMenu(false);
    if (!window.confirm("Delete this post?")) return;
    try { await S.deletePost(post.id); setGone(true); onDeleted && onDeleted(post.id); player.notify("Deleted"); } catch (x) { fail(x); }
  };
  const doReport = async () => {
    setMenu(false);
    const reason = window.prompt("What's wrong with this post? (spam, harassment, hate, something else)");
    if (!reason) return;
    try { await S.report(shown.id, reason); player.notify("Thanks. We'll take a look."); } catch (x) { fail(x); }
  };

  const author = shown.author || {};
  const isHost = hosts && hosts.has(author.id);
  const score = counts.up - counts.down;

  return (
    <article className={`post${compact ? " compact" : ""}`} onClick={() => onOpen && onOpen(shown)}>
      {isRepost ? (
        <p className="repost-line"><Icon name="repost" />{post.author ? `${post.author.display_name} reposted` : "Reposted"}</p>
      ) : null}
      <div className="post-row">
        <button className="avatar-link" onClick={(e) => { e.stopPropagation(); onOpenProfile && onOpenProfile(author.handle); }} aria-label={`@${author.handle}`}>
          <ProfileAvatar p={author} size={compact ? 34 : 42} />
        </button>
        <div className="post-main">
          <div className="post-head">
            <button className="name" onClick={(e) => { e.stopPropagation(); onOpenProfile && onOpenProfile(author.handle); }}>{author.display_name}</button>
            <Verified kind={author.verified} />
            {isHost ? <span className="host-tag">Host</span> : null}
            <span className="handle">@{author.handle}</span>
            <span className="dot-sep" aria-hidden="true" />
            <time dateTime={shown.created_at}>{timeAgo(shown.created_at)}</time>
            <button className="icon-btn post-menu-btn" onClick={(e) => { e.stopPropagation(); setMenu(!menu); }} aria-label="More options"><Icon name="more" /></button>
            {menu ? (
              <div className="post-menu" onClick={(e) => e.stopPropagation()}>
                {me && (post.user_id === me) ? <button onClick={remove}>Delete</button> : null}
                <button onClick={() => { if (social.ensure()) doReport(); }}>Report</button>
              </div>
            ) : null}
          </div>
          {isRepost && post.body ? <p className="post-body">{post.body}</p> : null}
          {isRepost && post.body ? (
            <div className="quoted">
              <p className="quoted-head"><b>{author.display_name}</b> <span>@{author.handle}</span></p>
              {shown.body ? <p className="post-body">{shown.body}</p> : null}
              <Attachment a={shown.attachment} atSeconds={shown.at_seconds} />
            </div>
          ) : (
            <>
              {shown.body ? <p className="post-body">{shown.body}</p> : null}
              <Attachment a={shown.attachment} atSeconds={shown.at_seconds} />
            </>
          )}
          <div className="post-actions">
            <span className="vote">
              <button className={vote === 1 ? "on up" : ""} onClick={act(() => doVote(1))} aria-pressed={vote === 1} aria-label="Upvote"><Icon name="arrowUp" /></button>
              <b aria-label={`Score ${score}`}>{score}</b>
              <button className={vote === -1 ? "on down" : ""} onClick={act(() => doVote(-1))} aria-pressed={vote === -1} aria-label="Downvote"><Icon name="arrowDown" /></button>
            </span>
            <button onClick={(e) => { e.stopPropagation(); onOpen && onOpen(shown); }} aria-label="Replies"><Icon name="comment" />{counts.reply || ""}</button>
            <span className="repost-wrap">
              <button className={reposted ? "on repost" : ""} onClick={act(doRepost)} aria-pressed={reposted} aria-label="Repost"><Icon name="repost" />{counts.repost || ""}</button>
              <button className="quote-btn" onClick={act(quote)} aria-label="Quote">Quote</button>
            </span>
            <button className={liked ? "on like" : ""} onClick={act(doLike)} aria-pressed={liked} aria-label="Like"><Icon name={liked ? "heartFill" : "heart"} />{counts.like || ""}</button>
            <button onClick={share} aria-label="Share"><Icon name="share" /></button>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ================= composer ================= */

export function Composer({ attach, atSeconds, parentId, episode, placeholder, onPosted, autoFocus, quoteOf }) {
  const social = useSocial();
  const player = usePlayer();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [useTime, setUseTime] = useState(Number.isFinite(atSeconds) && atSeconds > 5);
  const a = attach || null;
  const limit = 1000;

  const submit = async () => {
    if (!social.ensure()) return;
    if (!text.trim() && !a && !quoteOf) { player.notify("Write something first."); return; }
    setBusy(true);
    try {
      const me = social.user.id;
      let p;
      if (quoteOf) p = await S.repost(me, quoteOf, true, text);
      else if (episode) p = await S.createPost(me, { kind: "comment", body: text, parentId, attach: episode, atSeconds: useTime ? atSeconds : null });
      else if (parentId) p = await S.createPost(me, { kind: "comment", body: text, parentId });
      else p = await S.createPost(me, { body: text, attach: a, atSeconds: useTime ? atSeconds : null });
      setText("");
      player.notify(quoteOf ? "Reposted" : episode || parentId ? "Comment posted" : "Posted");
      onPosted && onPosted(p);
    } catch (x) { player.notify(x.message); }
    setBusy(false);
  };

  const me = social.profile;
  return (
    <div className="composer" onClick={(e) => e.stopPropagation()}>
      {me ? <ProfileAvatar p={me} size={38} /> : <span className="avatar" style={{ width: 38, height: 38 }}><Icon name="user" /></span>}
      <div className="composer-main">
        <textarea
          value={text} onChange={(e) => setText(e.target.value.slice(0, limit))} rows={episode || parentId ? 2 : 3} autoFocus={autoFocus}
          placeholder={placeholder || (quoteOf ? "Add your take…" : a ? "What did you think?" : "What are you listening to?")}
          aria-label={placeholder || "Write a post"}
        />
        {quoteOf ? <div className="quoted small"><p className="quoted-head"><b>{quoteOf.author.display_name}</b> <span>@{quoteOf.author.handle}</span></p>{quoteOf.body ? <p className="post-body">{quoteOf.body}</p> : null}</div> : null}
        {a ? <Attachment a={a} atSeconds={useTime ? atSeconds : null} /> : null}
        <div className="composer-foot">
          {Number.isFinite(atSeconds) && atSeconds > 5 ? (
            <label className="follow"><input type="checkbox" checked={useTime} onChange={(e) => setUseTime(e.target.checked)} /> At {clock(atSeconds)}</label>
          ) : <span />}
          <span className={`count${text.length > limit - 50 ? " warn" : ""}`}>{text.length ? `${limit - text.length}` : ""}</span>
          <button className="cta" onClick={submit} disabled={busy}>{busy ? "Posting…" : quoteOf ? "Repost" : episode || parentId ? "Comment" : "Post"}</button>
        </div>
      </div>
    </div>
  );
}

/* ================= lists ================= */

export function usePostList(loader, deps) {
  const social = useSocial();
  const [state, setState] = useState({ status: "loading", posts: [], page: 0, done: false, error: "" });
  const [mine, setMine] = useState(null);
  const me = social && social.user && social.user.id;

  const load = useCallback(async (page) => {
    try {
      const rows = (await loader(page)) || [];
      setState((s) => ({ status: "ok", posts: page ? [...s.posts, ...rows] : rows, page, done: rows.length < 20, error: "" }));
      const ids = rows.flatMap((p) => [p.id, p.repost_of]).filter(Boolean);
      if (me && ids.length) S.myReactions(me, ids).then((r) => setMine((m) => (m && page ? { votes: { ...m.votes, ...r.votes }, likes: new Set([...m.likes, ...r.likes]), reposts: new Set([...m.reposts, ...r.reposts]) } : r))).catch(() => {});
    } catch (x) {
      setState((s) => ({ ...s, status: "error", error: x.message }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, ...deps]);

  useEffect(() => { setState({ status: "loading", posts: [], page: 0, done: false, error: "" }); load(0); }, [load]);
  const prepend = (p) => setState((s) => ({ ...s, posts: [p, ...s.posts] }));
  return { ...state, mine, more: () => load(state.page + 1), reload: () => load(0), prepend };
}

export function PostList({ list, hosts, emptyText, onOpenPost, onOpenProfile, compact }) {
  if (list.status === "error") return <div className="empty" role="alert"><b>This didn't load.</b>{list.error}</div>;
  if (list.status === "loading") return <div className="posts" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="post skel" style={{ height: 120 }} />)}</div>;
  if (!list.posts.length) return <div className="empty small">{emptyText}</div>;
  return (
    <div className="posts">
      {list.posts.map((p) => <PostCard key={p.id} post={p} mine={list.mine} hosts={hosts} onOpen={onOpenPost} onOpenProfile={onOpenProfile} compact={compact} />)}
      {!list.done ? <div className="center"><button className="pill-btn ghost more-btn" onClick={list.more}>Load more</button></div> : null}
    </div>
  );
}

/* ================= comments on an episode ================= */

export function CommentsThread({ show, ep, onOpenPost, onOpenProfile, compact }) {
  const player = usePlayer();
  const [sort, setSort] = useState("top");
  const [hosts, setHosts] = useState(new Set());
  const list = usePostList(() => S.episodeComments(ep.id, sort), [ep.id, sort]);
  useEffect(() => { S.hostsOf(show.id).then(setHosts).catch(() => {}); }, [show.id]);
  const now = player.ep && player.ep.id === ep.id && player.phase === "content" ? player.pos : null;

  return (
    <div className={`comments${compact ? " compact" : ""}`} onClick={(e) => e.stopPropagation()}>
      <div className="comments-head">
        <b>{list.status === "ok" ? `${list.posts.length}${list.done ? "" : "+"} comment${list.posts.length === 1 ? "" : "s"}` : "Comments"}</b>
        <div className="switcher small" role="group" aria-label="Sort comments">
          <button aria-pressed={sort === "top"} onClick={() => setSort("top")}>Top</button>
          <button aria-pressed={sort === "new"} onClick={() => setSort("new")}>New</button>
        </div>
      </div>
      <Composer episode={{ show: { id: show.id, title: show.title, image: show.image, author: show.author || "" }, ep: { id: ep.id, title: ep.title, audio: ep.audio, image: ep.image, duration: ep.duration } }}
        atSeconds={now} placeholder="Add a comment…" onPosted={(p) => list.prepend(p)} />
      <PostList list={list} hosts={hosts} compact onOpenPost={onOpenPost} onOpenProfile={onOpenProfile} emptyText="No comments yet. Start the conversation." />
    </div>
  );
}

/* ================= claiming a show (hosts) ================= */

export function ClaimShow({ show }) {
  const social = useSocial();
  const player = usePlayer();
  const [open, setOpen] = useState(false);
  const [claim, setClaim] = useState(null);
  const [busy, setBusy] = useState(false);
  const me = social.user && social.user.id;

  useEffect(() => { if (open && me) S.myClaim(me, show.id).then(setClaim).catch(() => {}); }, [open, me, show.id]);
  if (!social.enabled) return null;
  if (claim && claim.status === "verified") return <p className="claim-ok"><Verified kind="host" /> You're the verified host of this show.</p>;

  const start = async () => {
    if (!social.ensure()) return;
    setBusy(true);
    try { setClaim(await S.startClaim(me, show.id)); } catch (x) { player.notify(x.message); }
    setBusy(false);
  };
  const check = async () => {
    setBusy(true);
    try { await S.verifyClaim(show.id); setClaim({ ...claim, status: "verified" }); player.notify("Verified. Your Host badge is live."); social.setProfile({ ...social.profile, verified: social.profile.verified || "host" }); }
    catch (x) { player.notify(x.message); }
    setBusy(false);
  };

  if (!open) return <button className="text-btn claim-link" onClick={() => { if (social.ensure(() => setOpen(true))) setOpen(true); }}>Are you the host? Claim this show</button>;
  return (
    <div className="claim-box" onClick={(e) => e.stopPropagation()}>
      <b>Claim {show.title}</b>
      {!claim ? (
        <>
          <p>Get a verified Host badge so listeners know it's really you when you post and reply. You'll prove it's your show by adding a short code to its feed.</p>
          <button className="cta" onClick={start} disabled={busy}>Get my code</button>
        </>
      ) : (
        <>
          <p>Add this code anywhere in your show's description (in your podcast host's settings), then publish:</p>
          <code className="claim-code">{claim.code}</code>
          <p className="small-note">Using Podcasting 2.0? You can add it as <code>{`<podcast:txt purpose="verify">${claim.code}</podcast:txt>`}</code> instead. Once verified, you can remove it.</p>
          <button className="cta" onClick={check} disabled={busy}>{busy ? "Checking…" : "I've added it, verify me"}</button>
        </>
      )}
    </div>
  );
}
