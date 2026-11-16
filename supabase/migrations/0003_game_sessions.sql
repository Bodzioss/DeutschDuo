-- Wortpasjans: finished boards (Etap 2). Append-only like reviews; used by the league in Etap 3.
create table public.game_sessions (
  id uuid primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  level text not null,
  seed integer not null,
  won boolean not null,
  stars smallint not null check (stars between 0 and 3),
  moves integer not null check (moves >= 0),
  par integer not null check (par >= 0),
  peeks integer not null check (peeks >= 0),
  peeked_word_ids text[] not null default '{}',
  duration_ms integer not null check (duration_ms >= 0),
  played_at timestamptz not null,
  local_day date not null,
  server_seq bigint generated always as identity,
  changed_at timestamptz not null default clock_timestamp(),
  inserted_at timestamptz not null default now()
);
create index game_sessions_seq_idx on public.game_sessions (profile_id, server_seq);
create index game_sessions_changed_idx on public.game_sessions (profile_id, changed_at);

alter table public.game_sessions enable row level security;

create policy game_sessions_select on public.game_sessions
  for select using (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));
create policy game_sessions_insert on public.game_sessions
  for insert with check (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));

revoke all on public.game_sessions from anon;
grant select, insert on public.game_sessions to authenticated;
