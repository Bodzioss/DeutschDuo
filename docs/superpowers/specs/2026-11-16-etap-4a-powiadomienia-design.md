# Etap 4a: Powiadomienia z przypomnieniem (design)

Status: zatwierdzony przez Marcina w rozmowie („Wszystko git”), 2026-11-16.
Kolejne etapy: 4b więcej rywalizacji w parze, 4c gramatyka w małych dawkach.

## Po co

Nawyk to najważniejsza rzecz w nauce. Dziś aplikacja sama się nie odzywa, więc dzień bez nauki mija niezauważony.
Powiadomienia mają przypomnieć o celu, ratować streak i zaprosić do rywalizacji („Twoja kolej”).

**Cele**
- Przypomnienie o celu o wybranej godzinie, tylko gdy cel dnia nie jest zrobiony.
- „Streak w niebezpieczeństwie” o 21:30, jeśli cel dziś nie jest zrobiony, a wczoraj był (jest seria do stracenia).
- Ruch partnera: zagrał(a) pojedynek dnia; wyprzedził(a) Cię w lidze.
- Każdy rodzaj do wyłączenia w Ustawieniach; godzina przypomnienia do wyboru.

**Nie-cele**: powiadomienia na komputerze projektujemy przy wersji desktopowej; e-mail/SMS; własne dźwięki.

**Anty-cele** (porażka, nawet jeśli technicznie działa):
- Więcej niż 3 powiadomienia dziennie na osobę albo to samo dwa razy.
- Przypomnienie o celu, który jest już zrobiony (np. przez opóźnioną synchronizację w przeciwną stronę: tylko gdy serwer widzi brak minut).
- Prośba o zgodę na powiadomienia bez kliknięcia (iOS i tak odrzuci, a użytkownik się zrazi).

## Ograniczenia

- PWA nie umie sama „obudzić się” o godzinie: potrzebny jest Web Push wysyłany przez serwer.
- iPhone: tylko aplikacja dodana do ekranu głównego, iOS 16.4+; zgoda tylko po geście użytkownika.
- Darmowe plany: Supabase (Edge Functions, pg_cron, pg_net), Cloudflare Pages.
- Jedno konto Auth „pary”, profile w `profiles` (RLS przez `owner_id = auth.uid()`). Klient zna tylko klucz anon.
- Dzień nauki kończy się o 03:00 czasu urządzenia (`localDay`); obaj są w Polsce, ale strefa jest zapisywana z urządzenia.

## Podejścia

1. **Serwer liczy sam z danych, które już ma (wybrane).** Cron co 15 min woła Edge Function `notify`. Funkcja czyta
   `reviews` (minuty z `duration_ms`, `goal_min`, `closes_queue`, `local_day`) i `profiles`, decyduje i wysyła Web Push.
   Zdarzenia partnera (pojedynek, wyprzedzenie w lidze) zgłasza klient, który i tak je wylicza, przez wywołanie `notify`
   z tokenem pary. Logika ligi zostaje w TypeScripcie klienta, serwer niczego nie duplikuje.
2. Klient wysyła „stan dnia” do tabeli, serwer tylko czyta. Odrzucone: dane o minutach już są w `reviews`.
3. Lokalne powiadomienia planowane w przeglądarce (Notification Triggers). Odrzucone: brak wsparcia w Safari/Chrome.

## Projekt

### Dane (migracja 0005)

- `profiles` dostaje: `notify_goal boolean default true`, `notify_goal_hour smallint default 19 check 6..22`,
  `notify_streak boolean default true`, `notify_partner boolean default true`. Synchronizowane jak reszta profilu.
- `push_subscriptions(endpoint text pk, profile_id uuid → profiles, p256dh text, auth text, tz text default 'Europe/Warsaw',
  created_at, updated_at)`. RLS: insert/update/delete/select tylko dla subskrypcji profili właściciela.
  Upsert po `endpoint`: telefon, który przełączy profil, przenosi subskrypcję na nowy profil.
- `notifications_sent(profile_id, day date, kind text, sent_at, primary key (profile_id, day, kind))`. Bez dostępu dla
  klienta (pisze tylko funkcja kluczem service role). Służy do deduplikacji i limitu 3/dzień.

### Decyzja (czysty TS, testowany w Vitest)

`supabase/functions/_shared/decide.ts`, bez API Deno, importowany przez funkcję i testy:

`decideScheduled({ now, tz, prefs, todayMinutes, todayGoalMin, queueClosed, reviewsToday, sentToday })`
→ lista `{ kind, title, body }`:
- dzień = dzień nauki w strefie `tz` (granica 03:00); godzina lokalna z `tz`;
- `goal`: `prefs.goal`, godzina ≥ `goalHour`, przed 23:00, cel niespełniony (`minutes < goalMin` i kolejka nie zamknięta),
  jeszcze nie wysłane dziś; treść z pozostałymi minutami (zaokrąglone w górę);
- `streak`: `prefs.streak`, godzina ≥ 21:30, przed 23:30, cel dziś **niespełniony** i cel **wczoraj spełniony**
  (jest seria do stracenia), nie wysłane dziś. Mrożenia ignorujemy: ostrzeżenie i tak się przydaje. Może przyjść po
  przypomnieniu o celu tego samego dnia: to „ostatnie wezwanie” o innej treści i porze. *(decyzja budowniczego)*
- limit: każdy rodzaj najwyżej raz dziennie; twardy limit 3 na dzień nauki; `goal`, `duel` i `overtake` tylko gdy dziś wysłano mniej niż 2, a `streak` gdy mniej niż 3 (jedno miejsce zawsze zostaje dla streaka).
  *(decyzja budowniczego)*

Dane wejściowe `decideScheduled` dla streaku: minuty, cel i zamknięcie kolejki za dziś i za wczoraj (jedno zapytanie
agregujące `reviews` po `local_day in (dziś, wczoraj)`).

`decidePartner(kind: 'duel' | 'overtake', { prefs, sentToday, partnerName, duelBothPlayed })` → jedno powiadomienie lub nic:
raz dziennie każdego rodzaju, w limicie 3. Cisza nocna: zdarzenia partnera wysyłamy tylko 8:00–22:00 czasu odbiorcy;
poza tym oknem przepadają (bez kolejki). „Dzień” do deduplikacji to dzień nauki odbiorcy w strefie `tz` jego subskrypcji.
*(decyzje budowniczego)*

Treści (PL, forma neutralna jak w UI):
- goal: „⏰ Cel na dziś” / „Zostało ok. {n} min. Kilka fiszek i gotowe.”
- streak: „🔥 Nie przerywaj serii!” / „Do celu brakuje {n} min. Zdążysz przed końcem dnia.”
- duel: „⚔️ {imię} zagrał(a) pojedynek dnia” / „Twoja kolej!” albo, gdy obaj zagrali, „Wynik pojedynku czeka.”
- overtake: „🏆 {imię} wyprzedza Cię w lidze” / „Odbijesz?”
Kliknięcie otwiera: goal/streak → `/`, duel/overtake → `/para`.

### Edge Function `notify` (Deno, `npm:web-push`)

- `verify_jwt = false`; sama sprawdza wywołującego:
  - **cron**: nagłówek `x-cron-secret` równy sekretowi `CRON_SECRET` → tryb `scheduled` dla wszystkich profili
    z aktywną subskrypcją;
  - **klient**: nagłówek `Authorization: Bearer <token pary>` → `auth.getUser()`, potem sprawdza, że `from` i `to` to profile
    tego użytkownika → tryb `partner`.
- Dane czyta kluczem service role (zmienna środowiskowa funkcji). Dla `scheduled` jedno zapytanie agregujące dzisiejsze
  `reviews` na profil (dzień liczony z `tz` subskrypcji).
- Wysyłka: do każdej subskrypcji profilu; 404/410 → usuń subskrypcję. Zapis do `notifications_sent` przed wysyłką
  (`insert … on conflict do nothing`, wysyłamy tylko gdy wiersz się wstawił, więc dwa równoległe crony nie zdublują).
- Sekrety funkcji: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto), `CRON_SECRET`.

### Cron

`pg_cron` + `pg_net`: co 15 min `net.http_post` na `/functions/v1/notify` z `x-cron-secret`. SQL w `docs/SETUP.md`
(sekret wpisuje Marcin, nie trafia do repo).

### Klient

- **Service worker**: `public/push-sw.js` dołączony przez `workbox.importScripts` (dalej `generateSW`): obsługa `push`
  (pokazuje powiadomienie z ikoną i `data.url`) i `notificationclick` (fokus otwartego okna albo otwarcie URL).
- **Ustawienia → Powiadomienia** (`src/features/settings/`):
  - stan: nieobsługiwane / iPhone poza ekranem głównym (krótka instrukcja „Udostępnij → Do ekranu początkowego”) /
    zablokowane w systemie / wyłączone / włączone;
  - przycisk „Włącz powiadomienia” → `Notification.requestPermission()` w geście → `pushManager.subscribe` z
    `VITE_VAPID_PUBLIC_KEY` → zapis subskrypcji w backendzie;
  - przełączniki: przypomnienie o celu + godzina (17–22), streak, ruch partnera; zapis do profilu;
  - „Wyłącz na tym telefonie” → `unsubscribe` + usunięcie wiersza.
- Subskrypcja odświeżana przy starcie (gdy zgoda jest, a wiersza brak albo zmienił się profil).
- **Zdarzenia partnera** (`src/data/notify.ts`):
  - `duel`: po zapisaniu wyniku pojedynku (obok istniejącego `syncNow`) → `notify({ kind: 'duel', from, to })`;
  - `overtake`: po udanej synchronizacji partnerów liczymy `standings`; jeśli jestem samodzielnie pierwszy, a ostatnio
    zapamiętany ranking (meta `leagueLeader`) tego nie mówił → `notify({ kind: 'overtake', from: ja, to: partner })`.
    Czysta funkcja `overtook(prevLeader, standings, me)` w `src/domain/pair.ts`.
  - Offline lub błąd: cicho pomijamy (powiadomienie to dodatek; nie kolejkujemy).
- Backend `fake`: wszystkie wywołania to no-op, żeby e2e i dev działały bez Supabase.

## Zostawione budowniczemu

Szczegóły wyglądu sekcji w Ustawieniach (w stylu obecnych `Segmented`), nazwy plików poza wymienionymi, kształt zapytań SQL,
sposób przekazania `tz` (Intl). Testy: Vitest dla `decide.ts`, `overtook`, mapowania profilu; PGlite dla migracji 0005;
e2e: sekcja Powiadomienia widoczna i w stanie „nieobsługiwane/wyłączone” w Playwright.

## Wdrożenie (kolejność)

1. Marcin uruchamia migrację 0005 w SQL Editor.
2. Klucze VAPID: generuję lokalnie; publiczny → `VITE_VAPID_PUBLIC_KEY` (Cloudflare + `.env.local`), prywatny i
   `CRON_SECRET` → sekrety funkcji w Supabase (nie do repo).
3. Funkcja `notify`: `npx supabase functions deploy notify --no-verify-jwt` (po `npx supabase login`).
4. Włączenie `pg_cron`, `pg_net` i SQL harmonogramu.
5. Push klienta na `main`.
