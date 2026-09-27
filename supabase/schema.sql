-- yappr database setup. In Supabase: SQL Editor → New query → paste this whole file → Run.

-- Favorites (shows, episodes, stations), one row per item per person
create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('show', 'episode', 'station')),
  item_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);
alter table public.favorites enable row level security;
drop policy if exists "Own favorites" on public.favorites;
create policy "Own favorites" on public.favorites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists favorites_kind_item on public.favorites (kind, item_id);

-- Browser push subscriptions for new-episode alerts
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  keys jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "Own push subscriptions" on public.push_subscriptions;
create policy "Own push subscriptions" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Latest episode seen per show. No policies on purpose: only the server (service role key) can read or write it.
create table if not exists public.feed_state (
  feed_id text primary key,
  last_episode_id text,
  last_published bigint not null default 0,
  checked_at timestamptz not null default now()
);
alter table public.feed_state enable row level security;

-- Listening progress, so you can pick up on any device where you left off
create table if not exists public.playback (
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id text not null,
  position integer not null default 0,
  duration integer not null default 0,
  finished boolean not null default false,
  show jsonb,
  ep jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);
alter table public.playback enable row level security;
drop policy if exists "Own playback" on public.playback;
create policy "Own playback" on public.playback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists playback_recent on public.playback (user_id, updated_at desc);

-- Followed topics are stored as favorites with kind = 'topic' (added after the first release)
alter table public.favorites drop constraint if exists favorites_kind_check;
alter table public.favorites add constraint favorites_kind_check check (kind in ('show', 'episode', 'station', 'topic'));

-- =====================================================================
-- Social: profiles, posts, comments, votes, likes, reposts, follows,
-- verified hosts and networks, and reports. Safe to re-run.
-- =====================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 50),
  bio text not null default '' check (char_length(bio) <= 200),
  avatar_url text not null default '',
  verified text check (verified in ('host', 'network', 'staff')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public" on public.profiles for select using (true);
drop policy if exists "Create own profile" on public.profiles;
create policy "Create own profile" on public.profiles for insert with check (auth.uid() = id and verified is null);
drop policy if exists "Edit own profile" on public.profiles;
create policy "Edit own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Nobody can give themselves a verified badge; only the server (service role) can
create or replace function public.protect_verified() returns trigger language plpgsql as $$
begin
  if new.verified is distinct from old.verified and coalesce(auth.role(), '') <> 'service_role' then
    new.verified := old.verified;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_verified on public.profiles;
create trigger profiles_protect_verified before update on public.profiles for each row execute function public.protect_verified();

-- Hosts claim shows by adding a code to their podcast feed (checked by /api/verify-show)
create table if not exists public.show_claims (
  user_id uuid not null references public.profiles (id) on delete cascade,
  show_id text not null,
  code text not null,
  status text not null default 'pending' check (status in ('pending', 'verified')),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  primary key (user_id, show_id)
);
alter table public.show_claims enable row level security;
drop policy if exists "See verified hosts and own claims" on public.show_claims;
create policy "See verified hosts and own claims" on public.show_claims for select using (status = 'verified' or auth.uid() = user_id);
drop policy if exists "Start own claim" on public.show_claims;
create policy "Start own claim" on public.show_claims for insert with check (auth.uid() = user_id and status = 'pending');
drop policy if exists "Remove own claim" on public.show_claims;
create policy "Remove own claim" on public.show_claims for delete using (auth.uid() = user_id);

-- Posts, comments (kind = 'comment', on an episode or as a reply) and reposts share one table
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'post' check (kind in ('post', 'comment', 'repost')),
  body text not null default '' check (char_length(body) <= 1000),
  parent_id bigint references public.posts (id) on delete cascade,
  repost_of bigint references public.posts (id) on delete cascade,
  show_id text,
  episode_id text,
  station_id text,
  attachment jsonb,
  at_seconds integer,
  up_count integer not null default 0,
  down_count integer not null default 0,
  like_count integer not null default 0,
  repost_count integer not null default 0,
  reply_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists posts_created on public.posts (created_at desc);
create index if not exists posts_episode on public.posts (episode_id, created_at desc) where episode_id is not null;
create index if not exists posts_parent on public.posts (parent_id) where parent_id is not null;
create index if not exists posts_user on public.posts (user_id, created_at desc);
alter table public.posts enable row level security;
drop policy if exists "Visible posts are public" on public.posts;
create policy "Visible posts are public" on public.posts for select using (not hidden);
drop policy if exists "Write own posts" on public.posts;
create policy "Write own posts" on public.posts for insert with check (
  auth.uid() = user_id and not hidden
  and up_count = 0 and down_count = 0 and like_count = 0 and repost_count = 0 and reply_count = 0
);
drop policy if exists "Delete own posts" on public.posts;
create policy "Delete own posts" on public.posts for delete using (auth.uid() = user_id);

create table if not exists public.votes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id bigint not null references public.posts (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (user_id, post_id)
);
alter table public.votes enable row level security;
drop policy if exists "Own votes" on public.votes;
create policy "Own votes" on public.votes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id bigint not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.likes enable row level security;
drop policy if exists "Own likes" on public.likes;
create policy "Own likes" on public.likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.follows (
  follower uuid not null references public.profiles (id) on delete cascade,
  followee uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
alter table public.follows enable row level security;
drop policy if exists "Follows are public" on public.follows;
create policy "Follows are public" on public.follows for select using (true);
drop policy if exists "Manage own follows" on public.follows;
create policy "Manage own follows" on public.follows for insert with check (auth.uid() = follower);
drop policy if exists "Unfollow" on public.follows;
create policy "Unfollow" on public.follows for delete using (auth.uid() = follower);

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id bigint not null references public.posts (id) on delete cascade,
  reason text not null check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "File reports" on public.reports;
create policy "File reports" on public.reports for insert with check (auth.uid() = reporter);

-- Keep counts on each post up to date (these run with elevated rights so nobody can fake counts)
create or replace function public.recount_post(pid bigint) returns void language sql security definer set search_path = public as $$
  update public.posts set
    up_count = (select count(*) from public.votes where post_id = pid and value = 1),
    down_count = (select count(*) from public.votes where post_id = pid and value = -1),
    like_count = (select count(*) from public.likes where post_id = pid),
    repost_count = (select count(*) from public.posts where repost_of = pid and kind = 'repost'),
    reply_count = (select count(*) from public.posts where parent_id = pid and not hidden)
  where id = pid;
$$;
create or replace function public.on_reaction() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recount_post(coalesce(new.post_id, old.post_id));
  return null;
end $$;
drop trigger if exists votes_recount on public.votes;
create trigger votes_recount after insert or update or delete on public.votes for each row execute function public.on_reaction();
drop trigger if exists likes_recount on public.likes;
create trigger likes_recount after insert or delete on public.likes for each row execute function public.on_reaction();
create or replace function public.on_post_change() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  r := coalesce(new, old);
  if r.parent_id is not null then perform public.recount_post(r.parent_id); end if;
  if r.repost_of is not null then perform public.recount_post(r.repost_of); end if;
  return null;
end $$;
drop trigger if exists posts_recount on public.posts;
create trigger posts_recount after insert or delete on public.posts for each row execute function public.on_post_change();

-- Feeds
create or replace function public.feed_hot(lim integer default 30, off integer default 0)
returns setof public.posts language sql stable as $$
  select * from public.posts
  where not hidden and parent_id is null and kind in ('post', 'repost')
  order by ((up_count - down_count) + like_count + repost_count * 2 + reply_count + 1)
           / power(extract(epoch from (now() - created_at)) / 3600 + 2, 1.5) desc, created_at desc
  limit lim offset off;
$$;
create or replace function public.feed_following(lim integer default 30, off integer default 0)
returns setof public.posts language sql stable as $$
  select p.* from public.posts p
  where not p.hidden and p.parent_id is null and p.kind in ('post', 'repost')
    and (
      p.user_id = auth.uid()
      or p.user_id in (select followee from public.follows where follower = auth.uid())
      -- verified hosts of shows you've favorited
      or p.user_id in (
        select c.user_id from public.show_claims c
        join public.favorites f on f.kind = 'show' and f.item_id = c.show_id and f.user_id = auth.uid()
        where c.status = 'verified'
      )
    )
  order by p.created_at desc
  limit lim offset off;
$$;
