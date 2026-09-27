import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { pi, strip } from "@/lib/podcastindex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Runs on a schedule (see vercel.json). For every show someone has favorited, checks for a newer episode
// than last time and sends a push notification to each fan who turned on alerts.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!url || !serviceKey || !vapidPublic || !vapidPrivate) {
    return Response.json({ error: "Missing Supabase or VAPID environment variables." }, { status: 500 });
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  webpush.setVapidDetails(`mailto:${process.env.CONTACT_EMAIL || "hello@yappr.fm"}`, vapidPublic, vapidPrivate);

  // 1. Which shows are favorited, and by whom
  const { data: favs, error } = await db.from("favorites").select("user_id,item_id,data").eq("kind", "show");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const shows = new Map();
  for (const f of favs || []) {
    if (!/^\d+$/.test(f.item_id)) continue;
    const s = shows.get(f.item_id) || { title: (f.data && f.data.title) || "A show you follow", image: f.data && f.data.image, users: new Set() };
    s.users.add(f.user_id);
    shows.set(f.item_id, s);
  }
  const ids = [...shows.keys()].slice(0, 500);

  const { data: states } = ids.length ? await db.from("feed_state").select("feed_id,last_episode_id,last_published").in("feed_id", ids) : { data: [] };
  const known = new Map((states || []).map((s) => [s.feed_id, s]));

  // 2. Latest episode for each show (a few at a time to be kind to the API)
  const updates = [];
  const fresh = [];
  for (let i = 0; i < ids.length; i += 8) {
    await Promise.all(ids.slice(i, i + 8).map(async (id) => {
      try {
        const d = await pi("/episodes/byfeedid", { id, max: 1 });
        const item = d.items && d.items[0];
        if (!item) return;
        const prev = known.get(id);
        const published = item.datePublished || 0;
        updates.push({ feed_id: id, last_episode_id: String(item.id), last_published: published, checked_at: new Date().toISOString() });
        // First time we see a show we only record a baseline, so nobody gets alerts for old episodes
        if (prev && published > prev.last_published && String(item.id) !== prev.last_episode_id) fresh.push({ id, item });
      } catch { /* skip this show this round */ }
    }));
  }
  if (updates.length) await db.from("feed_state").upsert(updates, { onConflict: "feed_id" });

  // 3. Notify fans
  let sent = 0;
  for (const { id, item } of fresh) {
    const show = shows.get(id);
    const { data: subs } = await db.from("push_subscriptions").select("endpoint,keys").in("user_id", [...show.users]);
    const payload = JSON.stringify({
      title: show.title,
      body: `New episode: ${strip(item.title, 120)}`,
      url: `/show/${id}?ep=${item.id}`,
      icon: "/icon-192.png",
      tag: `show-${id}`,
    });
    for (const sub of subs || []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        sent++;
      } catch (err) {
        // The browser unsubscribed or the subscription expired: clean it up
        if (err && (err.statusCode === 404 || err.statusCode === 410)) await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }
  // 4. Followed topics: the newest episode that mentions each topic, since last time
  const { data: topicFavs } = await db.from("favorites").select("user_id,item_id,data").eq("kind", "topic");
  const topics = new Map();
  for (const f of topicFavs || []) {
    const t = topics.get(f.item_id) || { label: (f.data && f.data.topic) || f.item_id, users: new Set() };
    t.users.add(f.user_id);
    topics.set(f.item_id, t);
  }
  const topicKeys = [...topics.keys()].slice(0, 150);
  let topicAlerts = 0;
  if (topicKeys.length) {
    const stateIds = topicKeys.map((k) => `topic:${k}`);
    const { data: tStates } = await db.from("feed_state").select("feed_id,last_episode_id,last_published").in("feed_id", stateIds);
    const tKnown = new Map((tStates || []).map((x) => [x.feed_id, x]));
    const tUpdates = [];
    for (let i = 0; i < topicKeys.length; i += 5) {
      await Promise.all(topicKeys.slice(i, i + 5).map(async (key) => {
        try {
          const d = await pi("/search/byperson", { q: topics.get(key).label, max: 50 });
          const item = (d.items || []).filter((x) => x.enclosureUrl && `${x.title} ${x.description || ""}`.toLowerCase().includes(key))
            .sort((a, b) => b.datePublished - a.datePublished)[0];
          if (!item) return;
          const sid = `topic:${key}`;
          const prev = tKnown.get(sid);
          tUpdates.push({ feed_id: sid, last_episode_id: String(item.id), last_published: item.datePublished || 0, checked_at: new Date().toISOString() });
          if (!prev || !(item.datePublished > prev.last_published) || String(item.id) === prev.last_episode_id) return;
          const { data: subs } = await db.from("push_subscriptions").select("endpoint,keys").in("user_id", [...topics.get(key).users]);
          const payload = JSON.stringify({
            title: `New on ${topics.get(key).label}`,
            body: `${strip(item.title, 100)}${item.feedTitle ? ` (${strip(item.feedTitle, 40)})` : ""}`,
            url: `/show/${item.feedId}?ep=${item.id}`,
            icon: "/icon-192.png",
            tag: `topic-${key}`,
          });
          for (const sub of subs || []) {
            try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload); topicAlerts++; }
            catch (err) { if (err && (err.statusCode === 404 || err.statusCode === 410)) await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); }
          }
        } catch { /* skip this topic this round */ }
      }));
    }
    if (tUpdates.length) await db.from("feed_state").upsert(tUpdates, { onConflict: "feed_id" });
  }

  return Response.json({ checked: ids.length, newEpisodes: fresh.length, sent, topics: topicKeys.length, topicAlerts });
}
