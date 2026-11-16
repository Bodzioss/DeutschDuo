# Deutsch Duo — konfiguracja kont (Etap 0)

Wszystkie konta zakłada Marcin. Darmowe plany w zupełności wystarczą.

## 1. Supabase (baza w chmurze)

1. Na [supabase.com](https://supabase.com) załóż projekt `deutsch-duo`. Region: **Europe** (najlepiej Central EU, Frankfurt). Hasło bazy wygeneruj i zapisz w menedżerze haseł; aplikacja go nie używa.
   W sekcji **Security**: *Enable Data API* zostaw zaznaczone, *Automatically expose new tables* **odznacz** (migracja nadaje uprawnienia jawnie), *Enable automatic RLS* jest opcjonalne.
2. Otwórz **SQL Editor → New query**, wklej całą zawartość `supabase/migrations/0001_init.sql` i kliknij **Run**.
3. Przejdź do **Authentication → Users → Add user → Create new user**:
   - e-mail pary, np. adres, który oboje znacie (nie musi istnieć skrzynka, ale lepiej, żeby istniała, bo przyda się do resetu hasła),
   - hasło pary: to je wpiszecie raz na każdym telefonie,
   - zaznacz **Auto Confirm User**.
   Skopiuj **User UID** nowego użytkownika.
4. W **Authentication → Sign In / Providers** wyłącz **Allow new users to sign up**.
5. W **SQL Editor** utwórz profile (podmień `<UID>`):
   ```sql
   insert into public.profiles (owner_id, display_name)
   values ('<UID>', 'Nikola'), ('<UID>', 'Marcin');
   ```
6. Skopiuj **Project URL**: to adres `https://<id>.supabase.co`, widoczny np. w **Integrations → Data API** (bez końcówki `/rest/v1/`).
   Skopiuj klucz z **Project Settings → API Keys → Publishable key** (`sb_publishable_…`; starszy klucz „anon” też działa).
   **Nigdy** nie używaj w aplikacji klucza `secret` ani `service_role`.

## 2. Plik `.env` (lokalnie)

Skopiuj `.env.example` do `.env` i uzupełnij:

```
VITE_SUPABASE_URL=<Project URL>
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_PAIR_EMAIL=<e-mail pary>
VITE_BACKEND=supabase
```

Do pracy bez chmury ustaw `VITE_BACKEND=fake`. Hasło to wtedy `test`, a dane zostają w przeglądarce.

## 3. Cloudflare Pages (hosting)

1. Na [dash.cloudflare.com](https://dash.cloudflare.com) wybierz **Workers & Pages → Create application**. Na ekranie „Make something new” kliknij na dole **Continue to Pages** (nie „Connect GitHub”, bo to tworzy Workera). Następnie **Import an existing Git repository** i wybierz repo `Bodzioss/DeutschDuo`.
2. Ustawienia buildu:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Zmienne środowiskowe (Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable key), `VITE_PAIR_EMAIL`, `VITE_BACKEND=supabase`, `NODE_VERSION=22`
3. Plik `public/_redirects` przekierowuje wszystkie ścieżki do `index.html`, więc odświeżenie np. `/stats` działa.
4. Po deployu zanotuj adres `https://<projekt>.pages.dev` (u nas: https://deutschduo.pages.dev).

## 4. Instalacja na telefonach

- **Android (Chrome):** otwórz adres, potem ⋮ → **Zainstaluj aplikację**.
- **iPhone (Safari):** otwórz adres, potem **Udostępnij → Do ekranu początkowego**. Aplikację otwieraj zawsze z ikony na ekranie głównym.
- Przy pierwszym uruchomieniu (z internetem): hasło pary, a potem wybór profilu.

## 5. Sprawdzenie

- Zrób kilka fiszek, włącz tryb samolotowy, zamknij i otwórz aplikację. Wszystko ma działać.
- Wyłącz tryb samolotowy i odczekaj chwilę. W Supabase **Table Editor → reviews** pojawią się nowe wiersze.
- „Nowy telefon”: w przeglądarce w trybie prywatnym otwórz aplikację, wpisz hasło i wybierz profil. Postęp powinien być ten sam.

## 6. Migracje bazy: zawsze **przed** wypchnięciem nowej wersji

Każdą nową migrację z `supabase/migrations/` uruchom w **SQL Editor** (po kolei, każdą raz), a dopiero potem wypchnij kod na `main`.
Nowa aplikacja z brakującą migracją nie potrafi zsynchronizować części danych.

| Plik | Co dodaje |
|---|---|
| `0001_init.sql` | profile, karty, powtórki, RLS |
| `0002_review_goal_min.sql` | cel dzienny zapisany przy każdej powtórce |
| `0003_game_sessions.sql` | wyniki Wortpasjansu |
| `0004_game_duel_day.sql` | pojedynek dnia |
| `0005_notifications.sql` | powiadomienia: preferencje profilu, subskrypcje push, dziennik wysłanych |

## 7. Powiadomienia (Etap 4a)

Przypomnienia o celu i serii oraz powiadomienia od partnera wysyła funkcja Supabase `notify`. Co 15 minut uruchamia ją `pg_cron`.
Klucze VAPID i `CRON_SECRET` są w pliku `supabase/.secrets.local` (nie trafia do repo). Klucza prywatnego nie wpisuj nigdzie poza sekretami Supabase.
`<ref>` to identyfikator projektu: fragment adresu `https://<ref>.supabase.co`.

1. **Migracja:** w **SQL Editor** uruchom `supabase/migrations/0005_notifications.sql` (patrz tabela w §6).
2. **Sekrety funkcji:** w terminalu, w katalogu repo (wartości z `supabase/.secrets.local`):
   ```
   npx supabase secrets set --project-ref <ref> VAPID_PUBLIC_KEY=<klucz publiczny> VAPID_PRIVATE_KEY=<klucz prywatny> VAPID_SUBJECT=mailto:<twój e-mail> CRON_SECRET=<sekret crona>
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY` Supabase dostarcza funkcji sam.
3. **Wdrożenie funkcji:**
   ```
   npx supabase login
   npx supabase functions deploy notify --project-ref <ref> --no-verify-jwt
   ```
   `--no-verify-jwt` jest potrzebne, bo cron nie ma JWT. Funkcja sama sprawdza sekret crona albo JWT pary.
4. **Harmonogram:** w **Database → Extensions** włącz `pg_cron` i `pg_net`. Potem w **SQL Editor** uruchom (podmień `<ref>` i `<CRON_SECRET>`):
   ```sql
   select cron.schedule('notify-every-15-min', '*/15 * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/notify',
       headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
       body := '{"mode":"scheduled"}'::jsonb,
       timeout_milliseconds := 30000
     )
   $$);
   ```
5. **Cloudflare Pages:** w zmiennych środowiskowych (Production) dodaj `VITE_VAPID_PUBLIC_KEY=<klucz publiczny>`, a potem zrób ponowny deploy (**Deployments → Retry deployment**), bo zmienne `VITE_` trafiają do aplikacji przy buildzie.
6. **Na każdym telefonie:** **Ustawienia → Powiadomienia → Włącz powiadomienia** i zezwól na powiadomienia. Na iPhonie działa to tylko w aplikacji otwartej z ekranu głównego.
7. **Sprawdzenie:** po godzinie przypomnienia, gdy cel dnia jest jeszcze niezrobiony, wywołaj funkcję ręcznie:
   ```
   curl -X POST https://<ref>.supabase.co/functions/v1/notify -H "x-cron-secret: <CRON_SECRET>" -H "Content-Type: application/json" -d '{"mode":"scheduled"}'
   ```
   Oczekiwana odpowiedź to `{"sent":1}` i powiadomienie na telefonie. Jeśli go nie ma, zajrzyj do **Edge Functions → notify → Logs**, a dla wywołań crona uruchom w SQL Editor: `select * from net._http_response order by id desc limit 5;`.

**Uwaga:** zmiana kluczy VAPID unieważnia wszystkie istniejące subskrypcje. Po zmianie każdy telefon musi dotknąć „Wyłącz na tym telefonie”, a potem „Włącz powiadomienia”.
