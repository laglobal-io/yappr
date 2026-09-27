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
