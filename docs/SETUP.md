# Deutsch Duo — konfiguracja kont (Etap 0)

Wszystkie konta zakłada Marcin. Darmowe plany w zupełności wystarczą.

## 1. Supabase (baza w chmurze)

1. Na [supabase.com](https://supabase.com) załóż projekt `deutsch-duo`. Region: **EU (Frankfurt)**. Zapisz hasło bazy w menedżerze haseł.
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
6. Z **Project Settings → API** skopiuj **Project URL** i klucz **anon public**.
   **Nigdy** nie używaj w aplikacji klucza `service_role`.

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

1. Na [dash.cloudflare.com](https://dash.cloudflare.com) wybierz **Workers & Pages → Create → Pages → Connect to Git** i połącz repo `Bodzioss/DeutschDuo`.
2. Ustawienia buildu:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Zmienne środowiskowe (Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PAIR_EMAIL`, `VITE_BACKEND=supabase`, `NODE_VERSION=22`
3. Plik `public/_redirects` przekierowuje wszystkie ścieżki do `index.html`, więc odświeżenie np. `/stats` działa.
4. Po deployu zanotuj adres `https://<projekt>.pages.dev`.

## 4. Instalacja na telefonach

- **Android (Chrome):** otwórz adres, potem ⋮ → **Zainstaluj aplikację**.
- **iPhone (Safari):** otwórz adres, potem **Udostępnij → Do ekranu początkowego**. Aplikację otwieraj zawsze z ikony na ekranie głównym.
- Przy pierwszym uruchomieniu (z internetem): hasło pary, a potem wybór profilu.

## 5. Sprawdzenie

- Zrób kilka fiszek, włącz tryb samolotowy, zamknij i otwórz aplikację. Wszystko ma działać.
- Wyłącz tryb samolotowy i odczekaj chwilę. W Supabase **Table Editor → reviews** pojawią się nowe wiersze.
- „Nowy telefon”: w przeglądarce w trybie prywatnym otwórz aplikację, wpisz hasło i wybierz profil. Postęp powinien być ten sam.
