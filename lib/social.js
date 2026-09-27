// Social data layer (browser). Everything goes through Supabase with row-level security, so people
// can only change their own posts, votes, likes and follows. Counts are kept by database triggers.
import { supabase } from "./supabase";

const AUTHOR = "author:profiles!posts_user_id_fkey(id,handle,display_name,avatar_url,verified)";
export const POST_FIELDS = `*, ${AUTHOR}, original:posts!posts_repost_of_fkey(*, ${AUTHOR})`;
const PAGE = 20;

const db = () => {
  if (!supabase) throw new Error("Accounts aren't set up on this site yet.");
  return supabase;
};
const must = ({ data, error }) => {
  if (error) throw new Error(error.message || "Something went wrong. Try again.");
  return data;
};

/* ---------- profiles ---------- */
export async function myProfile(userId) {
  return must(await db().from("profiles").select("*").eq("id", userId).maybeSingle());
}
export async function profileByHandle(handle) {
  return must(await db().from("profiles").select("*").eq("handle", String(handle).toLowerCase()).maybeSingle());
}
export async function saveProfile(userId, { handle, display_name, bio, avatar_url }) {
  const row = { id: userId, handle: handle.toLowerCase(), display_name, bio: bio || "", avatar_url: avatar_url || "" };
  const { data, error } = await db().from("profiles").upsert(row, { onConflict: "id" }).select().single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) throw new Error("That handle is taken. Try another.");
    if (/check/i.test(error.message)) throw new Error("Handles are 3 to 20 lowercase letters, numbers or underscores.");
    throw new Error(error.message);
  }
  return data;
}
export async function followCounts(userId) {
  const [a, b] = await Promise.all([
    db().from("follows").select("*", { count: "exact", head: true }).eq("followee", userId),
    db().from("follows").select("*", { count: "exact", head: true }).eq("follower", userId),
  ]);
  return { followers: a.count || 0, following: b.count || 0 };
}
export async function isFollowing(me, them) {
  const d = must(await db().from("follows").select("followee").eq("follower", me).eq("followee", them).maybeSingle());
  return !!d;
}
export async function setFollow(me, them, on) {
  if (on) must(await db().from("follows").insert({ follower: me, followee: them }));
  else must(await db().from("follows").delete().match({ follower: me, followee: them }));
}

/* ---------- reading posts ---------- */
export async function feed(kind, page = 0) {
  const off = page * PAGE;
  if (kind === "latest") {
    return must(await db().from("posts").select(POST_FIELDS).is("parent_id", null).in("kind", ["post", "repost"]).order("created_at", { ascending: false }).range(off, off + PAGE - 1));
  }
  const fn = kind === "following" ? "feed_following" : "feed_hot";
  return must(await db().rpc(fn, { lim: PAGE, off }).select(POST_FIELDS));
}
export async function postsByUser(userId, page = 0) {
  const off = page * PAGE;
  return must(await db().from("posts").select(POST_FIELDS).eq("user_id", userId).is("parent_id", null).order("created_at", { ascending: false }).range(off, off + PAGE - 1));
}
export async function postById(id) {
  return must(await db().from("posts").select(POST_FIELDS).eq("id", id).maybeSingle());
}
export async function replies(parentId) {
  return must(await db().from("posts").select(POST_FIELDS).eq("parent_id", parentId).order("created_at", { ascending: true }).limit(200));
}
// Episode comments: top-level comments ranked by votes (or newest)
export async function episodeComments(episodeId, sort = "top") {
  let q = db().from("posts").select(POST_FIELDS).eq("episode_id", String(episodeId)).eq("kind", "comment").is("parent_id", null);
  q = sort === "new" ? q.order("created_at", { ascending: false }) : q.order("up_count", { ascending: false }).order("like_count", { ascending: false }).order("created_at", { ascending: false });
  return must(await q.limit(100));
}
// Which of these posts I've voted on, liked or reposted
export async function myReactions(userId, ids) {
  if (!userId || !ids.length) return { votes: {}, likes: new Set(), reposts: new Set() };
  const [v, l, r] = await Promise.all([
    db().from("votes").select("post_id,value").eq("user_id", userId).in("post_id", ids),
    db().from("likes").select("post_id").eq("user_id", userId).in("post_id", ids),
    db().from("posts").select("repost_of").eq("user_id", userId).eq("kind", "repost").in("repost_of", ids),
  ]);
  return {
    votes: Object.fromEntries((v.data || []).map((x) => [x.post_id, x.value])),
    likes: new Set((l.data || []).map((x) => x.post_id)),
    reposts: new Set((r.data || []).map((x) => x.repost_of)),
  };
}
// People verified as hosts of a show (their comments get a "Host" label)
export async function hostsOf(showId) {
  if (!supabase || !showId) return new Set();
  const { data } = await supabase.from("show_claims").select("user_id").eq("show_id", String(showId)).eq("status", "verified");
  return new Set((data || []).map((x) => x.user_id));
}

/* ---------- writing ---------- */
export async function createPost(userId, { body, kind = "post", parentId = null, repostOf = null, attach = null, atSeconds = null }) {
  const row = {
    user_id: userId, kind, body: (body || "").trim().slice(0, 1000), parent_id: parentId, repost_of: repostOf,
    show_id: attach && attach.show ? String(attach.show.id) : null,
    episode_id: attach && attach.ep ? String(attach.ep.id) : null,
    station_id: attach && attach.station ? String(attach.station.id) : null,
    attachment: attach || null,
    at_seconds: Number.isFinite(atSeconds) ? Math.floor(atSeconds) : null,
  };
  if (!row.body && !row.attachment && kind !== "repost") throw new Error("Write something first.");
  return must(await db().from("posts").insert(row).select(POST_FIELDS).single());
}
export async function deletePost(id) {
  must(await db().from("posts").delete().eq("id", id));
}
export async function vote(userId, postId, value) {
  if (value === 0) must(await db().from("votes").delete().match({ user_id: userId, post_id: postId }));
  else must(await db().from("votes").upsert({ user_id: userId, post_id: postId, value }, { onConflict: "user_id,post_id" }));
}
export async function like(userId, postId, on) {
  if (on) must(await db().from("likes").insert({ user_id: userId, post_id: postId }));
  else must(await db().from("likes").delete().match({ user_id: userId, post_id: postId }));
}
export async function repost(userId, post, on, quote = "") {
  if (on) return createPost(userId, { kind: "repost", body: quote, repostOf: post.id });
  must(await db().from("posts").delete().match({ user_id: userId, kind: "repost", repost_of: post.id }));
  return null;
}
export async function report(postId, reason) {
  must(await db().from("reports").insert({ post_id: postId, reason: reason.slice(0, 300) }));
}

/* ---------- claiming a show ---------- */
export async function myClaim(userId, showId) {
  if (!supabase || !userId) return null;
  const { data } = await supabase.from("show_claims").select("code,status").eq("user_id", userId).eq("show_id", String(showId)).maybeSingle();
  return data || null;
}
export async function startClaim(userId, showId) {
  const code = `yappr-verify-${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 6)}`;
  must(await db().from("show_claims").insert({ user_id: userId, show_id: String(showId), code }));
  return { code, status: "pending" };
}
export async function verifyClaim(showId) {
  const { data } = await db().auth.getSession();
  const token = data && data.session && data.session.access_token;
  const res = await fetch("/api/verify-show", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ showId }) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Verification failed. Try again.");
  return d;
}
