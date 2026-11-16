-- Etap 3: a game can be the pair's duel of a learning day (only the first one of that day counts).
alter table public.game_sessions add column duel_day date;
create index game_sessions_duel_idx on public.game_sessions (profile_id, duel_day) where duel_day is not null;
