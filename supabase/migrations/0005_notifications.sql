-- Etap 4a: Web Push reminders. Per-profile preferences, push subscriptions, and a server-only dedup log.
alter table public.profiles
  add column notify_goal boolean not null default true,
  add column notify_goal_hour smallint not null default 19 check (notify_goal_hour between 6 and 22),
  add column notify_streak boolean not null default true,
  add column notify_partner boolean not null default true;

create table public.push_subscriptions (
  endpoint text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  tz text not null default 'Europe/Warsaw',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select on public.push_subscriptions for select
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));
create policy push_subscriptions_insert on public.push_subscriptions for insert
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));
create policy push_subscriptions_update on public.push_subscriptions for update
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Written only by the notify Edge Function (service role). No policies, no grants for the client.
create table public.notifications_sent (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (profile_id, day, kind)
);
alter table public.notifications_sent enable row level security;
revoke all on public.notifications_sent from anon, authenticated;
