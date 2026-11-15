# Deutsch Duo — projekt Etapu 0 i Etapu 1 (MVP)

Data: 2026-11-15 · Źródło wymagań: [docs/SPEC.md](../../SPEC.md)

## 1. Cel i dlaczego

Dwie osoby (para) chcą w 12 miesięcy dojść z A1 do B1. Poprzednie próby rozbijały się o brak regularności, więc aplikacja ma przede wszystkim budować **codzienny nawyk**: otwierasz, wciskasz „Start”, robisz sesję, streak rośnie.

Etap 0 + 1 ma jeden cel: **jak najszybciej przenieść codzienną naukę do własnej aplikacji** — ~600 słów A1 z poprawnymi rodzajnikami, fiszki z FSRS, panel „Heute”, streak, proste statystyki, zainstalowane na obu telefonach.

## 2. Cele, nie-cele, anty-cele

**Cele**
- PWA instalowana na Androidzie i iPhonie, działająca offline, start sesji < 2 s.
- Dwa profile (Nikola, Marcin) wybierane jednym tapnięciem; postęp każdego profilu w chmurze, więc zmiana lub utrata telefonu nie kasuje postępu.
- ~600 słów A1 z rodzajnikiem, l.mn., EN, PL, zdaniem przykładowym; rodzajniki i l.mn. zweryfikowane automatycznie ze słownikiem.
- Fiszki DE→EN i EN→DE z wpisywaniem, harmonogram FSRS.
- Panel „Heute” z jedną sesją dzienną, celem dziennym i streakiem z zamrożeniem.
- Proste statystyki.

**Nie-cele (późniejsze etapy)**
- Wortpasjans i inne gry, liga, pojedynki, streak pary, realtime (Etap 2–3).
- Gramatyka (Etap 4), AI i lepsze TTS (Etap 5), push i widżety (Etap 6).
- Ręczny eksport/import postępu do pliku (kopia zapasowa) — synchronizacja z chmurą to pokrywa; ewentualnie później.
- Własne słowa i import CSV/Anki — szkielet danych na to pozwala, ale UI nie powstaje w tym etapie.
- Tryby fiszek audio→znaczenie, obrazek→słowo, szybki der/die/das.

**Anty-cele (porażka, nawet jeśli „działa”)**
- Błędne rodzajniki/liczby mnogie w danych — utrwalanie błędów.
- Budowa aplikacji zastępuje naukę: Etap 1 nie może się rozrastać; uczycie się w Anki, dopóki MVP nie jest gotowe.
- Sesja, która wymaga sieci albo ładuje się kilka sekund — zabija nawyk w tramwaju.
- Utrata postępu (powtórek) przy konflikcie synchronizacji.

## 3. Ograniczenia

- Mobile-first: projekt pod 375 px, każdy ekran sprawdzany w tym widoku.
- Offline-first: każdy zapis najpierw lokalnie (IndexedDB), sync w tle.
- Tryb ciemny (wg systemu + przełącznik).
- Audio wymowy przy każdym słowie.
- Koszt ~0 zł: darmowe plany Supabase i Cloudflare Pages.
- Licencja CC BY-SA danych z Wiktionary musi być uszanowana (strona „O danych / licencje” w aplikacji).
- Klucze serwisowe nigdy w kodzie klienta (w tym etapie wystarcza publiczny `anon key` + RLS).

## 4. Rozważone podejścia

### Stack
| Opcja | Plusy | Minusy |
|---|---|---|
| **A. React + TS + Vite + PWA + Supabase** ✅ wybrana | najszybszy start, gotowe `ts-fsrs`, dnd-kit/Framer Motion pod przyszły Wortpasjans, dużo komponentów mobilnych | — |
| B. Blazor WASM + ASP.NET Core | projekt .NET do portfolio | wolniejszy start, port FSRS na C#, słabsze UI mobilne |
| C. Expo / React Native | natywne odczucie | konto Apple, publikacja w sklepach — dla 2 osób nie warto |

Wybór Marcina: **A** — priorytetem jest szybkie rozpoczęcie nauki.

### Źródło słownictwa
| Opcja | Plusy | Minusy |
|---|---|---|
| **1. Lista generowana + automatyczna weryfikacja z Wiktextract** ✅ wybrana | pełne pola (l.mn., przykład, PL), pewne rodzajniki, ręczny przegląd tylko oznaczonych | pobranie zrzutu z kaikki.org, obowiązek atrybucji CC BY-SA |
| 2. Gotowa talia Anki A1 | najszybciej | niepełne pola, niepewna jakość i licencja |
| 3. Tylko lista AI | najszybciej | AI myli rodzajniki — sprzeczne z anty-celem |

Wybór Marcina: **1**.

## 5. Projekt

### 5.1 Architektura

- **Frontend:** React 18 + TypeScript + Vite, `vite-plugin-pwa` (Workbox, precache całej aplikacji i danych słów), Tailwind CSS, Zustand (stan UI), Dexie (IndexedDB), `ts-fsrs`, React Router.
- **Backend:** Supabase — Auth (jedno konto pary, e-mail + hasło), Postgres z RLS. Bez Edge Functions w tym etapie.
- **Hosting:** Cloudflare Pages, deploy z gałęzi `main`.
- **Testy:** Vitest (logika), Playwright z viewportem 375×812 (scenariusze end-to-end).

Struktura katalogów (propozycja):
```
src/
  app/            routing, layout, nawigacja dolna
  features/
    today/        panel Heute + budowanie sesji
    review/       ekran fiszek, sprawdzanie odpowiedzi
    words/        przeglądarka słownika (lista + szczegóły słowa)
    stats/
    auth/
    settings/
  domain/         czysta logika: fsrs, sessionBuilder, answerCheck, streak, status
  data/           Dexie (db.ts), sync z Supabase, ładowanie słów
  ui/             wspólne komponenty (GenderWord, AudioButton, ...)
data/vocab/       words-a1.json (źródło), raporty walidacji
scripts/vocab/    walidator vs Wiktextract
supabase/migrations/
```

### 5.2 Dane słów

- Słowa są **statyczne, dołączone do aplikacji** jako JSON (precache PWA), z identyfikatorem i wersją. W tym etapie **nie** ma tabeli `words` w Supabase — postęp odwołuje się do `word_id` (stabilny slug, np. `der-tisch`, `gehen`). Tabela `words` pojawi się razem z własnymi słowami.
- Schemat słowa (zgodny z SPEC §8):
  ```ts
  type Word = {
    id: string;              // stabilny, nigdy nie zmieniany
    de: string;              // bez rodzajnika: "Tisch"
    article?: 'der'|'die'|'das';
    plural?: string | null;  // "Tische"; null = brak l.mn. (np. tylko l.poj.)
    pos: 'noun'|'verb'|'adj'|'adv'|'prep'|'pron'|'conj'|'num'|'phrase'|'other';
    en: string;              // główne znaczenie; alternatywy rozdzielone "; "
    pl?: string;
    cefr: 'A1';
    topic: string;           // np. "Essen", "Familie"
    example_de: string;
    example_en: string;
    false_friend?: string;   // np. "bekommen ≠ become (= dostać)"
    en_prompt?: string;      // doprecyzowanie do pytania EN→DE
    accept?: string[];       // inne poprawne odpowiedzi DE
    note?: string;
    emoji?: string;
  };
  ```
- **Pipeline weryfikacji:**
  1. Claude układa `data/vocab/words-a1.json` (~600 słów) wg tematów listy Goethe A1, z najczęstszymi słowami na początku (pole kolejności = kolejność w pliku).
  2. `scripts/vocab/validate.ts` czyta niemiecki zrzut Wiktextract (kaikki.org, JSONL) i dla każdego rzeczownika porównuje rodzaj i l.mn.; dla wszystkich słów sprawdza istnienie hasła i część mowy.
  3. Wynik: `data/vocab/report.md` z trzema grupami — zgodne, niezgodne (z wartością ze słownika), nieznalezione. Marcin przegląda tylko dwie ostatnie grupy.
  4. Zrzut Wiktextract **nie trafia do repo** (`.gitignore`); pobranie wymaga zgody Marcina przy wykonaniu.
- Atrybucja: ekran „O danych” w Ustawieniach (Wiktionary / Wiktextract, CC BY-SA, link do źródła).

### 5.3 Model danych postępu

**Lokalnie (Dexie):**
- `cards` — `id` (`${wordId}:${direction}`), `wordId`, `direction` (`de_en`|`en_de`), pola karty FSRS (`due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `reps`, `lapses`, `state`, `last_review`), `updatedAt`, `dirty`.
- `reviews` — `id` (UUID generowany na kliencie), `cardId`, `rating`, `durationMs`, `reviewedAt`, `answer` (wpisany tekst), `synced`.
- `meta` — ustawienia, stan streaka, data ostatniego sync.

**Supabase (Postgres + RLS):**
- Jest **jedno konto Supabase Auth: konto pary** (decyzja Marcina, wariant 1). RLS: zalogowane konto pary widzi i zapisuje tylko wiersze profili należących do niego (`profiles.owner_id = auth.uid()`).
- `profiles` — `id` (UUID), `owner_id` (= uid konta pary), `display_name` („Nikola”, „Marcin”), `daily_goal`, `new_per_day`, `show_pl`, `created_at`. Dwa wiersze zakładane w migracji/seedzie.
- `user_cards` — `profile_id`, `card_id`, `word_id`, `direction`, pola FSRS, `updated_at`; PK `(profile_id, card_id)`.
- `reviews` — `id` (UUID z klienta), `profile_id`, `card_id`, `rating`, `duration_ms`, `reviewed_at`, `local_day`, `was_new`; tylko insert.
- Nazwa `user_cards` zostaje zgodnie ze SPEC; „user” oznacza tu profil.
- *(decyzja Claude)* **Bez tabeli `daily_activity` i bez przechowywanego streaka.** Aktywność dnia (liczba recenzji, nowe słowa, minuty jako suma `duration_ms`, spełnienie celu), streak i liczba zamrożeń są **wyliczane deterministycznie z historii `reviews`** (odtworzenie dzień po dniu). Dzięki temu dwa telefony offline nie mogą się „pokłócić” o dzień, a streak przeżywa reinstalację. Wynik można cache'ować lokalnie w `meta`, ale źródłem prawdy są recenzje.
- Granica dnia liczona w **strefie czasowej urządzenia** w chwili recenzji; `reviews` przechowują dodatkowo `local_day` (data, z końcem doby o 3:00), żeby przeliczenie na innym urządzeniu dawało ten sam wynik. Pole `profiles.timezone` nie jest potrzebne.

**Synchronizacja:**
- Po każdej ocenie: zapis karty i recenzji w Dexie (natychmiast), potem kolejka sync w tle (przy starcie aplikacji, po sesji, przy `online`).
- `reviews` są append-only z UUID → idempotentny upsert, nic nie ginie.
- `user_cards`: konflikt per karta — wygrywa nowszy `updated_at` (zgodnie ze SPEC §7). Dodatkowe zabezpieczenie: karta jest odtwarzalna z historii `reviews`, więc w razie wątpliwości można ją przeliczyć.
- *(decyzja Claude)* **Lokalna baza Dexie jest osobna dla każdego profilu** (nazwa bazy z `profile_id`). Nie da się wymieszać recenzji dwóch osób, nawet jeśli oboje używacie tego samego telefonu.
- **Dane lokalne to kopia robocza, chmura to źródło prawdy.** Na nowym telefonie: hasło pary → wybór profilu → pobranie kart i recenzji z Supabase → nauka od miejsca, w którym skończyliście. Jedyne ryzyko utraty: recenzje zrobione offline na telefonie, który zginie, zanim złapie sieć.
- Sync nie wymaga ponownego logowania: sesja Supabase jest przechowywana i odświeżana automatycznie; offline nauka działa normalnie, a kolejka wysyła się po powrocie sieci.

### 5.4 Fiszki

- Każde słowo = dwie karty: **DE→EN** (rozpoznanie) i **EN→DE** (produkcja, z wpisywaniem). Karta EN→DE danego słowa odblokowuje się dopiero po pierwszej ocenie „Good/Easy” karty DE→EN (najpierw poznajesz, potem produkujesz).
  - *(decyzja Claude)* Odblokowana karta EN→DE pojawia się **najwcześniej następnego dnia**, nie w tej samej sesji. Nie zużywa limitu `new_per_day` (limit liczy **nowe słowa**, nie karty), ale wchodzi do dziennej kolejki i limitu 150. Realnie: 10 nowych słów dziennie ≈ 10 nowych kart DE→EN dziś + 10 kart EN→DE jutro.
- **DE→EN:** pokazuje słowo z rodzajnikiem w kolorze rodzaju (der niebieski, die czerwony, das zielony), l.mn., auto-audio; tap „Pokaż” → EN (+PL jeśli włączone), zdanie przykładowe z audio → oceny Again/Hard/Good/Easy.
- **EN→DE z wpisywaniem:** pokazuje EN (+emoji), pole tekstowe z przyciskami ä ö ü ß. Sprawdzenie:
  - normalizacja: wielkość liter ignorowana, `ae/oe/ue/ss` ≡ `ä/ö/ü/ß`, zbędne spacje;
  - **rzeczownik bez rodzajnika lub z błędnym rodzajnikiem = błąd** (wyraźny komunikat „rodzajnik!”);
  - literówka (odległość Levenshteina 1 dla słów ≥ 5 liter) = „prawie” → zaliczone, ale domyślnie podpowiedziana ocena Hard;
  - wynik → podpowiedziana ocena (błąd → Again, poprawnie → Good), użytkownik może zmienić przed przejściem dalej.
  - *(decyzja Claude)* **Synonimy:** schemat słowa dostaje dwa opcjonalne pola — `en_prompt` (doprecyzowany opis do pytania EN→DE, np. „to go (by vehicle)” dla *fahren*) i `accept` (lista innych poprawnych odpowiedzi DE). Jeśli użytkownik wpisze inne istniejące słowo z bazy o tym samym znaczeniu EN, dostaje komunikat „poprawne słowo, ale szukamy innego” i ponowną próbę bez kary. Walidator słów oznacza duplikaty znaczeń EN bez `en_prompt`.
- Audio: Web Speech API, głos `de-DE`; jeśli urządzenie nie ma niemieckiego głosu — przycisk audio ukryty i jednorazowy komunikat w Ustawieniach.
- Statusy słowa z FSRS (wg wyższej stabilności z obu kart, bez zmian dla nowych): **nowe** (brak ocen) → **uczę się** (stabilność < 7 dni) → **znam** (7–30 dni) → **opanowane** (> 30 dni).

### 5.5 Panel „Heute”

- Jeden duży przycisk **Start**. Sesja układa się automatycznie:
  1. powtórki, których termin minął (najpierw najbardziej zaległe), limit 150 na dzień, żeby po przerwie nie zalać;
  2. nowe słowa: domyślnie 10 dziennie (ustawienie 5–20), w kolejności z pliku; nowe wplatane między powtórki.
- Można przerwać w dowolnym momencie — postęp zapisany po każdej karcie; „Start” wznawia.
- **Cel dzienny:** domyślnie 15 minut nauki **lub** ukończenie dzisiejszej kolejki — co nastąpi pierwsze. Pasek postępu celu na panelu.
- **Streak:** dzień liczy się, gdy cel dzienny jest spełniony. Dzień liczony w strefie czasowej urządzenia, z końcem doby o 3:00 (nauka po północy liczy się do poprzedniego dnia).
- **Zamrożenie:** za każde 7 dni streaka zdobywasz 1 zamrożenie (max 2 w zapasie); dzień bez nauki automatycznie zużywa zamrożenie zamiast zerować streak.
- Wynik pary z tygodnia: **poza zakresem** (Etap 3) — w panelu tylko własne dane.

### 5.6 Słownik (przeglądarka)

- Lista słów z wyszukiwarką (DE/EN/PL) i filtrem tematu i statusu; słowo w kolorze rodzaju.
- Szczegóły słowa: wszystkie pola, audio słowa i zdania, status, termin następnej powtórki.

### 5.7 Statystyki

- Liczba słów w statusach „znam + opanowane” w czasie (wykres liniowy, z historii `reviews`).
- Heatmapa aktywności (ostatnie ~16 tygodni) wyliczana z `reviews`.
- Retencja: % ocen ≠ Again dla powtórek (nie nowych) w ostatnich 30 dniach.
- Czas nauki dziennie/tygodniowo.
- Top 10 najtrudniejszych słów (najwięcej `lapses`).

### 5.8 Hasło pary i wybór profilu (decyzja Marcina: wariant 1)

- **Raz na urządzenie:** ekran „Hasło pary” z jednym polem. Pod spodem logowanie Supabase e-mail + hasło na wspólne konto pary; e-mail konta jest w konfiguracji aplikacji (`VITE_PAIR_EMAIL`), więc wpisuje się tylko hasło. Pierwsze uruchomienie wymaga sieci.
- Hasło wpisuje się w samej aplikacji, więc problem linków otwieranych w Safari na iPhonie nie występuje (rezygnujemy z linku/kodu z e-maila).
- **Za każdym razem (lub tylko gdy nie zapamiętano):** ekran „Kto się uczy?” z dwoma dużymi kafelkami **Nikola / Marcin**. Wybór jest zapamiętany na urządzeniu, więc na co dzień aplikacja otwiera się od razu na panelu „Heute”. Przełączenie profilu: avatar w nagłówku.
- Bez PIN-ów dla profili — ufacie sobie nawzajem.
- Konto pary i hasło zakłada Marcin w Etapie 0 (instrukcja krok po kroku); rejestracja nowych kont w Supabase wyłączona.
- Ustawienia profilu: cel dzienny, nowe słowa dziennie, podpowiedź PL wł./wył., motyw, „Zmień profil”, „Wyloguj to urządzenie”, „O danych”.
- Dodanie kolejnych znajomych (SPEC §1) później = nowy wiersz w `profiles`; model danych już to wspiera.

### 5.9 Etap 0 — infrastruktura

- Repo z `CLAUDE.md` (stack, komendy `npm run dev` / `npm test` / `npm run e2e`, zasady: mobile-first 375 px, offline-first, kolory rodzajów).
- Szkielet PWA z manifestem, ikonami, splash; instalowalny na Android/iOS.
- Konta (zakłada Marcin, Claude podaje instrukcję krok po kroku): projekt Supabase (URL + anon key do zmiennych środowiskowych), projekt Cloudflare Pages podpięty do repo GitHub.
- Migracje SQL w `supabase/migrations/`, zastosowane w projekcie Supabase.
- Kryterium ukończenia Etapu 0: aplikacja pod publicznym URL, instaluje się na obu telefonach, hasło pary i wybór profilu działają, uruchamia się w trybie samolotowym.

### 5.10 Testy

- Vitest: `answerCheck` (normalizacja, rodzajniki, literówki), `sessionBuilder` (limity, kolejność, wplatanie), `streak` (granica 3:00, zamrożenia), `status`, scalanie sync (nowszy wygrywa, idempotentne recenzje), walidator słów.
- Playwright (375×812, Chromium + WebKit): hasło pary (z testowym kontem Supabase lub mockiem) → wybór profilu → sesja Heute → ocena kart → stan po przeładowaniu; tryb offline (przeładowanie bez sieci działa); „nowy telefon” (czysta przeglądarka → logowanie → postęp pobrany z chmury).
- Pomiar startu: Lighthouse (PWA, czas do interakcji) w CI lub ręcznie przed zakończeniem etapu.

## 6. Kryteria ukończenia Etapu 1

- ~600 słów A1 w aplikacji; raport walidacji przejrzany przez Marcina, wszystkie niezgodności rozstrzygnięte.
- Oboje używacie aplikacji codziennie zamiast Anki; postęp przeżywa reinstalację i zmianę telefonu (sprawdzone: wyczyszczona przeglądarka → hasło pary → profil → ten sam postęp).
- Sesja startuje < 2 s na telefonie przy ponownym uruchomieniu, działa w trybie samolotowym.
- Testy przechodzą, każdy ekran sprawdzony w 375 px w obu motywach.

## 7. Pozostawione wykonawcy

- Konkretne komponenty UI, animacje, ikony aplikacji, dokładna paleta (poza kolorami rodzajów).
- Biblioteka wykresów (lekka, np. własne SVG lub uPlot).
- Parametry FSRS: domyślne `ts-fsrs` z `request_retention = 0.9`; optymalizacja pod Wasze dane później (z tabeli `reviews`).
- Kolejność tematów w liście słów i dobór zdań przykładowych (w ramach A1).
- Import postępu z Anki — poza zakresem; jeśli okaże się potrzebny, osobna decyzja.
