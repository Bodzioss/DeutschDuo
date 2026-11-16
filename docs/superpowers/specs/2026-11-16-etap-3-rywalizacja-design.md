# Deutsch Duo — Etap 3: rywalizacja i współpraca w parze (design)

Date: 2026-11-16 · Source: `docs/SPEC.md` §5. Marcin asked for "sensible assumptions"; every decision below is **Claude's call** and can be changed later.

## 1. Intent
Learning together keeps the habit alive. The pair sees each other's effort every week, has one small duel per day, and shares goals. Competition must reward **regularity**, not who has more free time (spec §5 "fair play").

**Goals**
- **Weekly league** (Mon–Sun, learning days with the 03:00 boundary):
  - rank by % of one's own daily goal achieved, averaged over the week's days so far;
  - XP as tie-break and activity measure;
  - this week plus last week's result.
- **Duel of the day**: the same Wortpasjans board for both players every day. A result comparison is shown once both have played.
- **Pair streak**: consecutive days on which both met their goal.
- **Joint weekly goal**: 300 reviews together per week, with a progress bar.
- A **„Para”** screen reachable from Heute; duel entry from Heute and from the Gra map.

**Non-goals (later)**: async "10 words" challenges, badges, streak saving, shared mnemonics, handicap, realtime/live duels, push notifications, real stakes UI.

**Anti-goals**: ranking that rewards farming easy cards; seeing the partner's data requires being online every time (it must work offline from the last sync); writing to the partner's data.

## 2. Rules
- **XP** (derived from history, never stored):
  - each review: DE→EN = 1, EN→DE = 2; an "Again" rating gives 0;
  - each game: stars × 3;
  - each won duel: +10.
- **Goal %** for a day = `min(1, minutes / goal)`, or 1 when the queue was closed. The day's own goal snapshot is used (as for the streak). Week % = mean over the days from Monday until today (today included only if > 0, so the morning doesn't drag the score down).
- **Standing**: higher week % first, then higher XP.
- **Duel**:
  - Seed and level come from the learning day. Level rotates over Berlin–München boards (15 levels) by day number.
  - The pool is introduction order (same words for both, independent of SRS).
  - Only the **first** duel game of a day counts.
  - Winner order: won > fewer moves > shorter time > fewer peeks. If everything is equal, it is a draw.
  - A duel game also counts as a normal Wortpasjans game for map progress.
- **Pair streak**: consecutive days up to yesterday where both met their goal, plus today if both already did. No freezes.
- **Joint goal**: reviews of both this week ≥ 300.

## 3. Data
- The pair account owns both profiles, so RLS already lets a device read the partner's rows.
- A device **pulls the partner's reviews and games** into a separate local Dexie DB per profile (the same `openProfileDb(partnerId)`). This is read-only in practice: nothing is ever written locally for the partner, so sync pushes nothing.
- The partner is synced when the Para screen opens, after one's own sync, and every 5 minutes while the app is visible.
- `GameRecord.duelDay?: string` (YYYY-MM-DD) plus migration `0004_game_duel_day.sql` (`game_sessions.duel_day date`, nullable).

## 4. UI
- **Heute**: a card "🏆 Liga tygodnia" (both names, week %, ⚔️ duel status: „zagraj” / „czekamy na X” / „wygrał/a X”) that opens `/para`.
- **/para**:
  - this week's two standings (name, week %, XP, days met);
  - pair streak 🔥;
  - joint goal bar;
  - the duel card with both results (or "nie zagrał/a jeszcze") and a "Zagraj pojedynek" button;
  - last week's winner line.
- **Duel board**: `/game/<level>?duel=<day>`. It uses the same BoardScreen and shows a ⚔️ header. The summary shows the comparison if the partner has played, otherwise "czekamy na …". Replays of the same day count as normal games only.
- **Gra map**: a "⚔️ Pojedynek dnia" button at the top.

## 5. Testing
- Unit tests: XP, goal %, standings and tie-breaks; week boundaries (Monday 03:00); pair streak; duel seed/level determinism and rotation; duel winner rules; first-duel-only.
- Partner sync: the partner DB pulls only and never pushes.
- PGlite test for migration 0004.
- E2E: Para screen shows both players; a duel board from `?duel=` uses the day's seed (the same deal for both profiles).
