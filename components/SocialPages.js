"use client";

// The Feed, single posts and profiles. Loaded only when someone opens them, to keep the first visit light.
import { useEffect, useState } from "react";
import { usePlayer } from "./PlayerProvider";
import Icon from "./Icon";
import * as S from "@/lib/social";
import { useSocial, usePostList, PostList, PostCard, Composer, ProfileAvatar, Verified } from "./Social";

/* ================= Feed ================= */

export function FeedView({ onOpenPost, onOpenProfile }) {
  const social = useSocial();
  const [tab, setTab] = useState("hot");
  const list = usePostList((page) => S.feed(tab === "hot" ? "hot" : tab, page), [tab]);

  if (!social.enabled) {
    return <section className="sec feed"><h1 className="view-h">Feed</h1><div className="empty"><b>The Feed is coming soon.</b>Posting and comments need accounts, which aren't switched on for this site yet.</div></section>;
  }
  return (
    <section className="sec feed">
      <h1 className="view-h">Feed</h1>
      <div className="controls-row">
        <div className="switcher" role="group" aria-label="Which feed">
          {[["hot", "For you"], ["following", "Following"], ["latest", "Latest"]].map(([id, label]) => (
            <button key={id} aria-pressed={tab === id} onClick={() => { if (id === "following" && !social.ensure()) return; setTab(id); }}>{label}</button>
          ))}
        </div>
      </div>
      <div className="feed-compose"><Composer onPosted={(p) => list.prepend(p)} /></div>
      <PostList list={list} onOpenPost={onOpenPost} onOpenProfile={onOpenProfile}
        emptyText={tab === "following" ? "Follow people and favorite shows to fill this with posts from them and their hosts." : "No posts yet. Say something about what you're listening to."} />
    </section>
  );
}

/* ================= one post with its replies ================= */

export function PostView({ id, onBack, onOpenPost, onOpenProfile }) {
  const [post, setPost] = useState({ status: "loading" });
  const [hosts, setHosts] = useState(new Set());
  const repliesList = usePostList(() => S.replies(id), [id]);
  useEffect(() => {
    S.postById(id).then((p) => { setPost(p ? { status: "ok", p } : { status: "missing" }); if (p && p.show_id) S.hostsOf(p.show_id).then(setHosts); })
      .catch((x) => setPost({ status: "error", error: x.message }));
  }, [id]);

  return (
    <section className="sec post-view">
      <div className="list-head"><button className="icon-btn" onClick={onBack} aria-label="Back"><Icon name="back" /></button><h1>Post</h1></div>
      {post.status === "loading" ? <div className="post skel" style={{ height: 160 }} /> : null}
      {post.status === "missing" ? <div className="empty"><b>This post isn't available.</b>It may have been deleted.</div> : null}
      {post.status === "error" ? <div className="empty" role="alert"><b>This post didn't load.</b>{post.error}</div> : null}
      {post.status === "ok" ? (
        <>
          <PostCard post={post.p} mine={repliesList.mine} hosts={hosts} onOpenProfile={onOpenProfile} onDeleted={onBack} />
          <div className="replies">
            <Composer parentId={post.p.id} placeholder="Write a reply…" onPosted={(p) => repliesList.prepend(p)} />
            <PostList list={repliesList} hosts={hosts} compact onOpenPost={onOpenPost} onOpenProfile={onOpenProfile} emptyText="No replies yet." />
          </div>
        </>
      ) : null}
    </section>
  );
}

/* ================= profiles ================= */

export function ProfileView({ handle, onBack, onOpenPost, onOpenProfile }) {
  const social = useSocial();
  const player = usePlayer();
  const [prof, setProf] = useState({ status: "loading" });
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const me = social.user && social.user.id;

  useEffect(() => {
    setProf({ status: "loading" });
    S.profileByHandle(handle).then((p) => {
      if (!p) { setProf({ status: "missing" }); return; }
      setProf({ status: "ok", p });
      S.followCounts(p.id).then(setCounts).catch(() => {});
      if (me && me !== p.id) S.isFollowing(me, p.id).then(setFollowing).catch(() => {});
    }).catch((x) => setProf({ status: "error", error: x.message }));
  }, [handle, me]);
  const list = usePostList((page) => (prof.p ? S.postsByUser(prof.p.id, page) : Promise.resolve([])), [prof.p && prof.p.id]);

  const toggleFollow = async () => {
    if (!social.ensure()) return;
    const next = !following;
    setFollowing(next);
    setCounts((c) => ({ ...c, followers: c.followers + (next ? 1 : -1) }));
    try { await S.setFollow(me, prof.p.id, next); } catch (x) { setFollowing(!next); player.notify(x.message); }
  };

  return (
    <section className="sec profile-view">
      <div className="list-head"><button className="icon-btn" onClick={onBack} aria-label="Back"><Icon name="back" /></button></div>
      {prof.status === "missing" ? <div className="empty"><b>No one here.</b>There's no yappr profile called @{handle}.</div> : null}
      {prof.status === "error" ? <div className="empty" role="alert"><b>This profile didn't load.</b>{prof.error}</div> : null}
      {prof.status === "ok" ? (
        <>
          <div className="profile-head">
            <ProfileAvatar p={prof.p} size={84} />
            <div className="profile-info">
              <h1>{prof.p.display_name} <Verified kind={prof.p.verified} /></h1>
              <p className="handle">@{prof.p.handle}{prof.p.verified === "host" ? ", verified host" : prof.p.verified === "network" ? ", verified network" : ""}</p>
              {prof.p.bio ? <p className="bio">{prof.p.bio}</p> : null}
              <p className="follow-counts"><b>{counts.followers}</b> followers <b>{counts.following}</b> following</p>
            </div>
            <div className="profile-actions">
              {me === prof.p.id ? <button className="pill-btn ghost" onClick={social.editProfile}>Edit profile</button>
                : <button className={`pill-btn${following ? " ghost" : ""}`} onClick={toggleFollow} aria-pressed={following}>{following ? "Following" : "Follow"}</button>}
              <button className="round-btn" onClick={() => player.share({ title: `${prof.p.display_name} on yappr`, text: `@${prof.p.handle} on yappr`, url: `${window.location.origin}/u/${prof.p.handle}` })} aria-label="Share profile"><Icon name="share" /></button>
            </div>
          </div>
          <PostList list={list} onOpenPost={onOpenPost} onOpenProfile={onOpenProfile} emptyText="No posts yet." />
        </>
      ) : null}
    </section>
  );
}

