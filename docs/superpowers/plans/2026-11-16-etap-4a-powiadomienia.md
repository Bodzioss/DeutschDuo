# Etap 4a: Powiadomienia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web Push reminders (goal, streak, partner duel/overtake) with per-profile settings, sent by a Supabase Edge Function.

**Architecture:** Pure decision logic in `supabase/functions/_shared/decide.ts` (no Deno APIs, unit tested in Vitest). A Deno Edge Function `notify` runs it in two modes: `scheduled` (pg_cron every 15 min, `x-cron-secret`) and `partner` (client call with the pair JWT). The client subscribes in Settings, stores prefs on the profile, and reports duel/overtake events.

**Tech Stack:** React 18 + TS strict, vite-plugin-pwa (`generateSW` + `importScripts`), Supabase (Postgres, RLS, Edge Functions on Deno, `npm:web-push@3.6.7`, `npm:@supabase/supabase-js@2`), Vitest, PGlite, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-etap-4a-powiadomienia-design.md`

## Global Constraints

- UI in Polish; texts exactly as in the spec (goal, streak, duel, overtake).
- Max one notification of each kind per learning day; at most 3 per day in total, `streak` always allowed.
- Learning day ends at 03:00 local time of the subscription `tz` (default `Europe/Warsaw`).
- `goal` only when hour ≥ `goalHour` and < 23:00; `streak` only 21:30–23:30; partner events only 08:00–22:00 receiver time.
- `notify_goal_hour` range 6..22, default 19; Settings offers 17–22.
- Client uses only the anon key; service role and VAPID private key live only in Supabase function secrets. Never commit them.
- Offline-first: notifications never block a session; failed partner calls are dropped silently.
- `fake` backend: all push/notify calls are no-ops.
- Check new screens at 375 px, light and dark.

## Review Focus

1. Profiles cached before this change have no notify fields → defaults (all on, 19:00) must apply (Task 2 test).
2. Goal met via a closed queue with few minutes → no goal/streak reminder (Task 1 test).
3. 00:30–02:59 local time belongs to the previous learning day → no reminders fire then, dedupe uses the previous day (Task 1 test).
4. A phone that switches profile moves its subscription to the new profile (upsert by endpoint) (Task 2 SQL test).
5. Overtake fires once when becoming sole leader, not on ties and not again while staying leader (Task 4 test).

---

### Task 1: Decision logic (`decide.ts`)

**Files:**
- Create: `supabase/functions/_shared/decide.ts`
- Test: `tests/unit/notify/decide.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Kind = 'goal' | 'streak' | 'duel' | 'overtake';
  export interface Prefs { goal: boolean; goalHour: number; streak: boolean; partner: boolean }
  export interface DayStat { minutes: number; goalMin: number; queueClosed: boolean } // goalMin already resolved
  export interface Push { kind: Kind; title: string; body: string; url: '/' | '/para' }
  export function localClock(now: Date, tz: string): { day: string; minutesOfDay: number } // learning day (03:00 boundary) + wall-clock minutes since 00:00
  export function prevDay(day: string): string
  export function decideScheduled(i: { now: Date; tz: string; prefs: Prefs; today?: DayStat; yesterday?: DayStat; sentToday: Kind[] }): Push[]
  export function decidePartner(kind: 'duel' | 'overtake', i: { now: Date; tz: string; prefs: Prefs; sentToday: Kind[]; partnerName: string; duelBothPlayed?: boolean }): Push | null
  ```
  `goalMet(d?: DayStat) = !!d && (d.minutes >= d.goalMin || d.queueClosed)`. Remaining minutes = `Math.ceil(goalMin - minutes)`, min 1; no `today` row → remaining = `prefs`-independent `goalMin` passed by caller via `today` (caller always passes `today` with `minutes: 0` when no reviews).

- [ ] **Step 1: Write the failing tests** (`now` built as `new Date('2026-11-16T18:10:00Z')` = 19:10 Warsaw):
  - `localClock`: 19:10 Warsaw → `{ day: '2026-11-16', minutesOfDay: 1150 }`; `2026-11-17T01:30:00Z` (02:30) → day `'2026-11-16'`.
  - goal fires at 19:10 with `goalHour 19`, today `{minutes: 7.2, goalMin: 15, queueClosed: false}` → one push `{ kind: 'goal', title: '⏰ Cel na dziś', body: 'Zostało ok. 8 min. Kilka fiszek i gotowe.', url: '/' }`.
  - no goal at 18:50; none at 23:05; none when `sentToday` has `'goal'`; none when `prefs.goal` false; none when `queueClosed` true with 2 minutes.
  - streak at 21:40: today unmet (`minutes 3, goalMin 15`), yesterday met → `{ kind: 'streak', title: '🔥 Nie przerywaj serii!', body: 'Do celu brakuje 12 min. Zdążysz przed końcem dnia.' }`; none when yesterday unmet; none at 21:20; none at 23:40.
  - at 21:40 with goal also due and not sent → only `streak` returned.
  - streak still returned when `sentToday` = `['goal','duel','overtake']`; goal not returned when `sentToday` = `['duel','overtake','streak']`... (3 already) → `[]`.
  - at 02:30 (previous learning day, wall clock 02:30) → `[]`.
  - `decidePartner('duel', …partnerName 'Nikola')` at 12:00 → `{ kind: 'duel', title: '⚔️ Nikola zagrał(a) pojedynek dnia', body: 'Twoja kolej!', url: '/para' }`; with `duelBothPlayed` → body `'Wynik pojedynku czeka.'`; `'overtake'` → `{ title: '🏆 Nikola wyprzedza Cię w lidze', body: 'Odbijesz?', url: '/para' }`; null at 07:30 and 22:10, null if already sent that kind, null if `prefs.partner` false, null if 3 sent.

- [ ] **Step 2:** Run `npx vitest run tests/unit/notify` → FAIL (module missing).
- [ ] **Step 3:** Implement with `Intl.DateTimeFormat(…, { timeZone: tz, hourCycle: 'h23', year/month/day/hour/minute })`; learning day = calendar date of (local time − 3 h). File must not import from `src/` or use Deno globals.
- [ ] **Step 4:** Run tests → PASS. `npm run typecheck` (add `supabase/functions/_shared` to tsconfig `include` if needed; exclude `supabase/functions/notify`).
- [ ] **Step 5:** Commit `feat(notify): pure decision logic for reminders`.

### Task 2: Migration 0005 + profile prefs in the client

**Files:**
- Create: `supabase/migrations/0005_notifications.sql`
- Modify: `src/domain/types.ts` (Profile), `src/data/backend/supabase.ts` (profile select/update + new methods), `src/data/backend/types.ts`, `src/data/backend/fake.ts`
- Test: `tests/unit/sql/migration.test.ts`, `tests/unit/data/profilePrefs.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/domain/types.ts
  export interface NotifyPrefs { goal: boolean; goalHour: number; streak: boolean; partner: boolean }
  export const DEFAULT_NOTIFY: NotifyPrefs = { goal: true, goalHour: 19, streak: true, partner: true };
  // Profile gets: notify?: NotifyPrefs  (optional: cached profiles predate it)
  export const notifyPrefs = (p: Profile): NotifyPrefs => ({ ...DEFAULT_NOTIFY, ...p.notify });
  // Backend gets:
  savePushSubscription(profileId: string, sub: { endpoint: string; p256dh: string; auth: string; tz: string }): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<void>;
  notifyPartner(e: { kind: 'duel' | 'overtake'; from: string; to: string; duelBothPlayed?: boolean }): Promise<void>; // fake: no-op
  ```
- SQL: columns `notify_goal`, `notify_goal_hour`, `notify_streak`, `notify_partner` on `profiles` (defaults per spec, hour check 6..22); tables `push_subscriptions` and `notifications_sent` per spec; RLS on `push_subscriptions` via `exists (select 1 from profiles p where p.id = profile_id and p.owner_id = auth.uid())` for select/insert/update/delete; `grant select, insert, update, delete on push_subscriptions to authenticated`; `notifications_sent`: RLS on, no policies, no grants to anon/authenticated.

- [ ] **Step 1: Failing tests:**
  - PGlite: owner can insert a subscription for own profile; other user cannot insert for it; `insert … on conflict (endpoint) do update set profile_id = excluded.profile_id` moves the endpoint to P1b (second profile of U1); authenticated cannot select `notifications_sent` (permission error); `notify_goal_hour = 23` rejected.
  - `notifyPrefs({ id, displayName, dailyGoalMin: 15, newPerDay: 10, showPl: true })` → `DEFAULT_NOTIFY`; partial `notify: { goal: false } as NotifyPrefs` keeps other defaults.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Write migration; extend `ProfileRow`/`toProfile` and `updateProfile` with the four columns; implement the three backend methods (`notifyPartner` = `sb.functions.invoke('notify', { body: { mode: 'partner', ...e } })`, errors swallowed); fake no-ops; fake profiles get `notify: DEFAULT_NOTIFY`.
- [ ] **Step 4:** `npm test` and `npm run typecheck` → PASS.
- [ ] **Step 5:** Commit `feat(notify): migration 0005, profile notify prefs, push subscription backend`.

### Task 3: Service worker push handler + Settings section

**Files:**
- Create: `public/push-sw.js`, `src/data/push.ts`, `src/features/settings/NotificationsSection.tsx`
- Modify: `vite.config.ts` (`workbox.importScripts: ['push-sw.js']`), `src/features/settings/SettingsScreen.tsx`, `src/vite-env.d.ts` (`VITE_VAPID_PUBLIC_KEY`), `.env.local` (not committed), `docs/SETUP.md`
- Test: `tests/unit/data/push.test.ts`, `tests/e2e/smoke.spec.ts` (or new `tests/e2e/notifications.spec.ts`)

**Interfaces:**
- Consumes: `Backend.savePushSubscription/deletePushSubscription`, `notifyPrefs`, `DEFAULT_NOTIFY` (Task 2).
- Produces (`src/data/push.ts`):
  ```ts
  export type PushState = 'unsupported' | 'ios-not-installed' | 'denied' | 'off' | 'on';
  export function pushState(env?: { ua: string; standalone: boolean; hasPush: boolean; permission: NotificationPermission | 'n/a'; subscribed: boolean }): PushState
  export async function enablePush(profileId: string): Promise<PushState>   // must be called from a click handler
  export async function disablePush(): Promise<void>
  export async function refreshPushSubscription(profileId: string): Promise<void> // on app start: re-save if permission granted
  ```
  `pushState` is pure over its `env` argument (defaults read from `navigator`/`window`): iPhone/iPad UA and not standalone → `'ios-not-installed'`; no `PushManager` → `'unsupported'`; permission `denied` → `'denied'`; subscribed → `'on'`; else `'off'`.
- `push-sw.js`: `push` → `showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url }, tag: kind })`; `notificationclick` → focus an existing client and `navigate(url)`, else `clients.openWindow(url)`.

- [ ] **Step 1: Failing tests:** `pushState` for: iPhone Safari not standalone → `'ios-not-installed'`; iPhone standalone, permission default, not subscribed → `'off'`; Android Chrome granted + subscribed → `'on'`; no push → `'unsupported'`; denied → `'denied'`. E2E: Settings shows heading „Powiadomienia” and, in Playwright Chromium (no VAPID key in fake build), the text „Powiadomienia nie są dostępne w tej wersji” or the enable button; no horizontal scroll at 375 px.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Section UI (Polish): status line per state; `ios-not-installed` → „Na iPhonie dodaj aplikację do ekranu głównego: Udostępnij → Do ekranu początkowego, potem otwórz ją z ikony.”; `denied` → „Powiadomienia są zablokowane w ustawieniach telefonu.”; `off` → button „Włącz powiadomienia”; `on` → toggles „Przypomnienie o celu” + godzina `Segmented` 17–22, „Streak w niebezpieczeństwie (21:30)”, „Ruchy partnera”, and link-button „Wyłącz na tym telefonie”. Toggles call existing `updateProfile({ ...profile, notify: { ...notifyPrefs(profile), … } })`. Missing `VITE_VAPID_PUBLIC_KEY` or fake backend → treat as `'unsupported'` with text „Powiadomienia nie są dostępne w tej wersji.” Call `refreshPushSubscription` once from `ProfileGate` after profile selection.
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run e2e` → PASS; check the section at 375 px light/dark.
- [ ] **Step 5:** Commit `feat(notify): push subscription, service worker handler, settings section`.

### Task 4: Partner events from the client

**Files:**
- Modify: `src/domain/pair.ts`, `src/features/game/BoardScreen.tsx` (after duel `syncNow`), `src/data/useSync.ts` (after partner sync)
- Create: `src/data/notify.ts`
- Test: `tests/unit/domain/pair.test.ts`, `tests/unit/data/notify.test.ts`

**Interfaces:**
- Consumes: `Backend.notifyPartner` (Task 2), `standings`, `duelGameOf` (existing).
- Produces:
  ```ts
  // src/domain/pair.ts
  export function soleLeader(s: Standing[]): string | null          // profileId of a non-tied #1, else null
  export function overtook(prevLeader: string | null, s: Standing[], me: string): boolean // soleLeader(s) === me && prevLeader !== me
  // src/data/notify.ts
  export async function reportDuel(me: string, partner: string, today: string): Promise<void>
  export async function checkOvertake(me: string, partners: string[], today: string): Promise<void> // reads both DBs, meta 'leagueLeader' in my DB
  ```
  `checkOvertake` stores `soleLeader` in meta `leagueLeader` every run, and calls `notifyPartner({ kind: 'overtake', from: me, to: partner })` only when `overtook` is true and `prevLeader` was not null (first run after install only records). `reportDuel` passes `duelBothPlayed` = partner already has a duel game for `today`. Both skip when `navigator.onLine === false` and swallow errors.

- [ ] **Step 1: Failing tests:** `soleLeader` null on tie, id otherwise; `overtook(null…)` true when me sole leader; false when `prevLeader === me`; false on tie. `checkOvertake` with fake backend spy: first run (no meta) records leader, no call; second run after partner led → one call with `{ kind: 'overtake', from: me, to: partner }`; third run unchanged → no call.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; wire `reportDuel` in `Board.finish` when `duelDay` (after `syncNow` resolves), `checkOvertake` after a successful partner sync in `useSync`.
- [ ] **Step 4:** `npm test`, `npm run typecheck`, `npm run e2e` → PASS.
- [ ] **Step 5:** Commit `feat(notify): duel and league overtake events`.

### Task 5: Edge Function `notify` + setup docs

**Files:**
- Create: `supabase/functions/notify/index.ts`, `supabase/config.toml` (`[functions.notify] verify_jwt = false`)
- Modify: `docs/SETUP.md` (§ Powiadomienia: VAPID keys, secrets, deploy, pg_cron SQL), `tsconfig*.json` exclude `supabase/functions/notify`

**Interfaces:**
- Consumes: `decide.ts` (Task 1) via `../_shared/decide.ts`; tables from Task 2.
- Request bodies: `{ mode: 'scheduled' }` with header `x-cron-secret`; `{ mode: 'partner', kind, from, to, duelBothPlayed? }` with `Authorization: Bearer <user JWT>`.
- Behaviour:
  - scheduled: load all `push_subscriptions` joined to `profiles`; per profile (tz from its newest subscription) compute `localClock`; query `reviews` for `local_day in (day, prevDay(day))` summing `duration_ms/60000`, `bool_or(closes_queue)`, `min(goal_min)` (fallback `daily_goal_min`); load `notifications_sent` kinds for that day; `decideScheduled`; for each push `insert into notifications_sent … on conflict do nothing returning 1` and only then send.
  - partner: `createClient(url, anon, { global: { headers: { Authorization } } }).auth.getUser()`; both `from` and `to` must have `owner_id = user.id` (service client query); receiver prefs/tz/sentToday → `decidePartner` with sender `display_name`; same insert-then-send.
  - send: `webpush.sendNotification(sub, JSON.stringify(push), { TTL: 3600 })`; status 404/410 → delete subscription.
  - responses: 401 bad secret/JWT, 403 foreign profile, 200 `{ sent: n }`.

- [ ] **Step 1:** Write the function (no local Deno: keep logic in `decide.ts`; this file is wiring only).
- [ ] **Step 2:** `npm test`, `npm run typecheck` still PASS (function excluded from tsc).
- [ ] **Step 3:** Generate VAPID keys with `npx web-push generate-vapid-keys`; put the public key in `.env.local`; give Marcin the private key and a random `CRON_SECRET` via a gitignored file `supabase/.secrets.local` (add to `.gitignore`).
- [ ] **Step 4:** Write SETUP §: run 0005; `npx supabase login`; `npx supabase secrets set --project-ref <ref> VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:… CRON_SECRET=…`; `npx supabase functions deploy notify --project-ref <ref> --no-verify-jwt`; enable `pg_cron`, `pg_net`; `select cron.schedule('notify-every-15-min', '*/15 * * * *', $$ select net.http_post(url := 'https://<ref>.supabase.co/functions/v1/notify', headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'), body := '{"mode":"scheduled"}'::jsonb) $$);`; Cloudflare env `VITE_VAPID_PUBLIC_KEY`.
- [ ] **Step 5:** Commit `feat(notify): notify edge function and setup guide`.
