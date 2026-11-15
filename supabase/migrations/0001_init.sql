-- Deutsch Duo — Etap 0+1 schema.
-- One Supabase Auth user = the shared "pair" account. It owns the profiles (Nikola, Marcin).
-- Every row is reachable only through a profile owned by auth.uid() (RLS).

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  daily_goal_min int not null default 15 check (daily_goal_min between 5 and 120),
  new_per_day int not null default 10 check (new_per_day between 5 and 20),
  show_pl boolean not null default true,
  created_at timestamptz not null default now()
);
create index profiles_owner_idx on public.profiles (owner_id);

create sequence public.user_cards_seq;

create table public.user_cards (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  card_id text not null,
  word_id text not null,
  direction text not null check (direction in ('de_en', 'en_de')),
  fsrs jsonb not null,
  updated_at timestamptz not null,
  server_seq bigint not null default nextval('public.user_cards_seq'),
  primary key (profile_id, card_id)
);
create index user_cards_seq_idx on public.user_cards (profile_id, server_seq);

-- Every insert/update gets a fresh sequence number, so devices can pull "changes since".
create function public.user_cards_bump_seq() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_seq := nextval('public.user_cards_seq');
  return new;
end $$;
create trigger user_cards_bump_seq before insert or update on public.user_cards
  for each row execute function public.user_cards_bump_seq();

create table public.reviews (
  id uuid primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  card_id text not null,
  rating smallint not null check (rating between 1 and 4),
  duration_ms int not null check (duration_ms >= 0),
  reviewed_at timestamptz not null,
  local_day date not null,
  was_new boolean not null,
  closes_queue boolean not null default false,
  scheduled_days real not null default 0,
  answer text,
  server_seq bigint generated always as identity,
  inserted_at timestamptz not null default now()
);
create index reviews_seq_idx on public.reviews (profile_id, server_seq);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.user_cards enable row level security;
alter table public.reviews enable row level security;

-- Profiles are created by the admin (SETUP.md); the app may only read and edit settings. No delete (would cascade progress).
create policy profiles_select on public.profiles
  for select using (owner_id = auth.uid());
create policy profiles_update on public.profiles
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy user_cards_owner on public.user_cards
  for all using (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));

-- Reviews are append-only: select + insert, no update/delete.
create policy reviews_select on public.reviews
  for select using (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));
create policy reviews_insert on public.reviews
  for insert with check (exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid()));

-- Last-write-wins upsert of cards: a row is only replaced by a newer updated_at.
-- security invoker => RLS of the caller applies.
-- Duplicates of one card in a batch are collapsed to the newest (ON CONFLICT cannot touch a row twice).
create function public.upsert_cards(p_profile uuid, p_cards jsonb) returns void
language sql security invoker set search_path = '' as $$
  insert into public.user_cards (profile_id, card_id, word_id, direction, fsrs, updated_at)
  select distinct on (c->>'card_id')
         p_profile, c->>'card_id', c->>'word_id', c->>'direction', c->'fsrs', (c->>'updated_at')::timestamptz
  from jsonb_array_elements(p_cards) as c
  order by c->>'card_id', (c->>'updated_at')::timestamptz desc
  on conflict (profile_id, card_id) do update
    set word_id = excluded.word_id,
        direction = excluded.direction,
        fsrs = excluded.fsrs,
        updated_at = excluded.updated_at
    where public.user_cards.updated_at < excluded.updated_at;
$$;

-- Explicit privileges (do not rely on project default privileges).
revoke all on public.profiles, public.user_cards, public.reviews from anon;
revoke execute on function public.upsert_cards(uuid, jsonb) from public, anon;
grant execute on function public.upsert_cards(uuid, jsonb) to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.user_cards to authenticated;
grant select, insert on public.reviews to authenticated;
grant usage on sequence public.user_cards_seq to authenticated;
