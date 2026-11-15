# Deutsch Duo — specyfikacja aplikacji do nauki niemieckiego

Nov 15, 2026 · @Marcin

## 1. Cel i założenia

**Cel:** w 12 miesięcy dojść z A1 do **B1** — pierwszego poziomu komunikatywnego, na którym sensownie rozmawiacie na codzienne tematy (podróż, praca, plany, doświadczenia). Wymaga to ok. **60 minut dziennie**, z czego część to słuchanie w drodze i rozmowy we dwoje. Możliwa meta: egzamin Goethe B1.

**Główny problem poprzednich prób to zwykle brak regularności**, więc aplikacja jest projektowana pod nawyk: krótkie sesje, jeden przycisk „Start”, streak i partnerka jako osoba, która trzyma Cię przy nauce.

- **Użytkownicy:** 2 osoby połączone w „parę” (z opcją dodania kolejnych znajomych).
- **Język pomostowy:** angielski (DE↔EN), z opcjonalnym podpowiedzeniem PL. Angielski bardzo pomaga (Haus–house, trinken–drink, Buch–book), ale aplikacja oznacza *false friends* (bekommen ≠ become, Gift = trucizna, also ≠ also).
- **Platformy:** Android, iOS i przeglądarka — jeden kod.
- **Wymagania niefunkcjonalne:** mobile-first (projekt pod 375 px), działa offline (nauka w tramwaju), sesja startuje w < 2 s, audio wymowy przy każdym słowie, tryb ciemny.

## 2. Metodyka — na czym opieramy naukę

Rdzeń, od najważniejszego:

1. **Powtórki rozłożone w czasie (spaced repetition) z algorytmem FSRS** — nowszy i skuteczniejszy następca SM-2 z Anki. Gotowa biblioteka: `ts-fsrs`. Każda karta ma swój termin powtórki, a ocena to Again / Hard / Good / Easy.
2. **Active recall** — zawsze najpierw próba przypomnienia, dopiero potem odpowiedź. Dwa kierunki: DE→EN (rozpoznawanie) i EN→DE z wpisywaniem (produkcja — trudniejsza i ważniejsza).
3. **Słowo zawsze z kontekstem:** rodzajnik + kolor rodzaju (der = niebieski, die = czerwony, das = zielony), liczba mnoga, zdanie przykładowe z audio. Rzeczownik nauczony bez rodzajnika traktujemy jako błąd.
4. **Częstotliwość:** poziomy budowane na listach słownictwa Goethe-Institut (A1/A2/B1) i listach najczęstszych słów — najpierw to, co naprawdę się przydaje.
5. **Comprehensible input (i+1):** krótkie teksty i dialogi, w których znasz \~95% słów. Uzupełniająco: Nicos Weg (DW), Easy German.
6. **Gramatyka „zasada → przykłady → drill → mieszanie”:** krótko, konkretnie, potem ćwiczenia przeplatane z innymi zasadami (interleaving). Zasady gramatyki też trafiają do SRS jako karty wzorców.
7. **Słuchanie i mówienie:** shadowing (powtarzanie za nagraniem), dyktanda, nagrywanie się.
8. **Nawyk i zaangażowanie społeczne:** mały dzienny cel, streak z „zamrożeniem” na gorszy dzień, nauka w parze.

**Dzienny budżet (\~60 min):** \~20 min powtórki SRS i gramatyka, \~15–20 min input (podcast, wideo w drodze), \~15 min rozmowa we dwoje lub z AI, \~5–10 min shadowing. Szczegóły w sekcji 6.

## 3. Moduły aplikacji

### 3.1 Panel „Heute” (Dziś)

- Jedna dzienna sesja ułożona automatycznie: powtórki, kilka nowych słów, mini-lekcja gramatyki, jedna gra.
- Pasek celu dziennego, streak, wynik pary w tym tygodniu.

### 3.2 Słownik — „pamięć słówek”

- Każde słowo: DE, rodzajnik, l.mn., EN, PL, część mowy, poziom CEFR, temat, zdanie przykładowe, audio, notatka/mnemotechnika, emoji lub obrazek.
- Statusy: nowe → uczę się → znam → opanowane (wyliczane ze stabilności FSRS).
- Dodawanie własnych słów (np. z serialu), import z CSV/Anki.

### 3.3 Fiszki SRS

- Tryby: DE→EN, EN→DE z wpisywaniem, audio→znaczenie, obrazek→słowo, szybki wybór der/die/das.
- Tolerancja literówek i wpisywania ä/ö/ü/ß jako ae/oe/ue/ss.

### 3.4 Gramatyka — „pamięć zasad”

- Ścieżka A1→B1: sein/haben i odmiana czasowników, szyk zdania (czasownik na 2. miejscu, na końcu w zdaniu podrzędnym), rodzajniki i przypadki (Nom/Akk/Dat), Perfekt, czasowniki rozdzielnie złożone, modalne, przyimki z Akk/Dat, Präteritum, podstawy Konjunktiv II.
- Każda zasada: ściąga, tabela, przykłady, ćwiczenia, sekcja „pułapki dla Polaków i anglojęzycznych”.
- Każda zasada ma poziom opanowania i wraca w powtórkach.

### 3.5 Czytanie i słuchanie

- Krótkie teksty na Twoim poziomie; klik w słowo → tłumaczenie + „dodaj do fiszek”.
- Teksty generowane przez AI z Twoich znanych słów + kilku nowych.

### 3.6 Mówienie

- Shadowing, rozpoznawanie mowy (Web Speech API) do sprawdzania wymowy, nagrania głosowe wysyłane partnerce.

### 3.7 Gry

- Wortpasjans (Solitaire Association, sekcja 4), der/die/das Rush, Memory DE–EN, „Ułóż zdanie” (szyk), odmiana na czas.

### 3.8 Statystyki

- Liczba znanych słów w czasie, retencja, czas nauki, heatmapa aktywności, lista najtrudniejszych słów.

## 4. Wortpasjans — Solitaire Association w wersji do nauki

Roboczo nazywam ją „Wortpasjans”, żeby była Wasza własna, a nie kopia cudzej gry.

### Podstawowa mechanika

- Plansza jak w pasjansie: kolumny częściowo zakrytych kart, stos do dobierania i kilka pól na kategorie.
- Karta kategorii (np. *Essen*, *Familie*, *Verben der Bewegung*) otwiera pole; potem dokładasz do niej pasujące słowa, aż kategoria się zamknie (np. 4–6 kart).
- W kolumnach można kłaść na siebie karty z tej samej kategorii.
- Limit ruchów i ocena gwiazdkowa (1–3) za liczbę ruchów i podpowiedzi.

### Różnica 1: poziomy słówek

- Talie przypisane do poziomów: A1.1, A1.2, A2.1 … B1 — mapa „podróży” (np. Berlin → Hamburg → Monachium → Wiedeń → Zurych), każde miasto to kilka plansz.
- Oprócz kategorii tematycznych są **kategorie gramatyczne**: „rodzaj die”, „czasowniki rozdzielne”, „przyimki z Dativ”, „liczba mnoga na -en”. To ćwiczy gramatykę mimochodem.
- Talia składana częściowo z Twoich słów z SRS: \~60% do powtórki, \~30% znanych, \~10% nowych.

### Różnica 2: odwracanie karty

- Przytrzymanie karty (long press) lub ikona 🔄 odwraca ją i pokazuje znaczenie EN (+ opcjonalnie PL) i odtwarza audio.
- Odwracanie ma koszt, żeby nie stało się nawykiem: np. 3 darmowe podglądy na planszę, każdy kolejny obniża wynik.
- Każde odwrócone słowo trafia do SRS jako „słabe” i wraca szybciej w fiszkach.
- Po grze podsumowanie: słowa, które odwracałeś, z przyciskiem „ćwicz teraz”.

### Tryby

- **Solo** — przechodzenie mapy.
- **Pojedynek** — oboje dostajecie tę samą planszę (to samo ziarno losowania), wygrywa mniej ruchów / krótszy czas / mniej podglądów.
- **Co-op** (później) — wspólna plansza, ruchy na zmianę.

### Uwagi techniczne

- Rozdanie deterministyczne z `seed`, żeby pojedynki były uczciwe.
- Solver sprawdzający, czy rozdanie jest do przejścia, zanim trafi do gracza.
- Animacje przeciągania kart przyjazne dla dotyku (np. biblioteka dnd-kit lub Framer Motion).

## 5. Rywalizacja i współpraca w parze

**Rywalizacja**

- **Liga tygodniowa:** XP za powtórki, lekcje i gry; reset w poniedziałek. Realna stawka poza aplikacją: przegrany gotuje / wybiera film / stawia kawę.
- **Pojedynek dnia:** ta sama plansza Wortpasjansu albo ten sam quiz 10 pytań; porównanie czasu i błędów.
- **Wyzwania asynchroniczne:** wysyłasz partnerce 10 słów, których się właśnie nauczyłeś — ona ma 24 h, żeby je zaliczyć.
- **Odznaki:** 100 słów, 30 dni streaka, pierwsza bezbłędna sesja, „Der-Die-Das-Meister”.

**Współpraca**

- **Wspólny cel tygodnia** (np. 300 powtórek razem) odblokowuje nagrodę — np. motyw graficzny albo kolejne miasto na mapie.
- **Streak pary** obok indywidualnego; partner może raz w tygodniu „uratować” Twój streak.
- **Wspólne mnemotechniki:** jedno dodaje skojarzenie do trudnego słowa, drugie może je polubić lub poprawić.

**Fair play — żeby rywalizacja nie demotywowała**

- XP ważone trudnością (wpisanie EN→DE warte więcej niż rozpoznanie), żeby nie dało się „farmić” łatwych kart.
- Ranking oparty o **% realizacji własnego celu dziennego**, a nie tylko surowe XP — wygrywa systematyczność, a nie to, kto ma więcej czasu.
- Opcjonalny handicap dla osoby z niższym poziomem.

## 6. Mówienie i rozmowy

Rozmowa to główny cel, więc mówienie jest od pierwszego tygodnia, a nie dopiero „jak będę umiał więcej”.

### Od pierwszego dnia (bez czekania na aplikację)

- **„Nur Deutsch”:** 15 minut dziennie we dwoje tylko po niemiecku (kolacja, spacer). Prosto i z błędami — liczy się mówienie.
- **Tryb głosowy w aplikacji Claude:** np. „Rozmawiaj ze mną po niemiecku na poziomie A1, mów wolno, a po rozmowie wypisz moje 5 najważniejszych błędów z poprawkami”.

### Rozmowy we dwoje (w panelu)

- **Karty ról** losowane z Waszego poziomu (kelner i klient, wynajem mieszkania, u lekarza) z listą potrzebnych słów i zwrotów (*Redemittel*).
- **Temat dnia** + 5 pytań do zadania sobie nawzajem.
- **Timer i licznik minut po niemiecku** — wspólne XP dla obojga (tu współpraca, nie rywalizacja).
- **Nagranie → transkrypcja → poprawki AI** osobno dla każdego. To chroni przed utrwalaniem sobie nawzajem tych samych błędów. Poprawione zdania trafiają do SRS jako karty zdań.

### Rozmowa z AI

- **Partner AI w rolach**, dopasowany do poziomu: używa głównie słów, które już znasz, plus kilku nowych.
- **Przebieg:** mowa → transkrypcja (Web Speech API lub Whisper) → model (API Claude) → synteza mowy. Na start tryb „przytrzymaj i mów”, rozmowa w czasie rzeczywistym później.
- **Raport po rozmowie:** 3–5 najważniejszych błędów, poprawna wersja, nowe słowa do fiszek.
- **Styl korekty do wyboru:** delikatne przeformułowanie w trakcie albo poprawki dopiero na końcu (żeby nie wybijać z rytmu).

### Wymowa i akcent

- **Ocena wymowy:** np. Azure Pronunciation Assessment (niemiecki de-DE) — wynik dokładności i płynności dla całego zdania i poszczególnych słów/głosek.
- **Shadowing:** zdanie wzorcowe → Twoje nagranie → odsłuch na zmianę i wynik.
- **Pary minimalne:** Staat/Stadt, schon/schön, Hölle/Hülle, Bach/Bauch, ich/ach.
- **Pułapki dla Polaka:** ü i ö, długie vs krótkie samogłoski, dwa różne „ch” (ich vs ach), końcówka -er (Vater), gardłowe r, przydechowe h.

### Plan na 12 miesięcy

| Okres | Poziom | Mówienie |
| --- | --- | --- |
| Miesiące 1–3 | domknięcie A1 | scenki z kart ról, przedstawianie się, codzienność |
| Miesiące 4–8 | A2 | opowiadanie o przeszłości (Perfekt), plany, rozmowy z AI 3× w tygodniu |
| Miesiące 9–12 | B1 | rozmowy na tematy (praca, podróże, opinie), dłuższe wypowiedzi, próbny egzamin |

## 7. Architektura i stack technologiczny

**Rekomendacja: PWA (Progressive Web App).** Jeden kod działa w przeglądarce i instaluje się na ekranie głównym Androida i iPhone’a jak zwykła aplikacja, działa offline i nie wymaga sklepów ani opłat. Na iOS powiadomienia push działają w PWA dodanej do ekranu głównego (od iOS 16.4). Gdyby kiedyś była potrzeba sklepu — opakowujemy to samo w Capacitor.

### Opcja A — najszybsza z Claude Code (rekomendowana)

- **Frontend:** React + TypeScript + Vite, `vite-plugin-pwa`, Tailwind CSS, Zustand (stan), Dexie (IndexedDB — dane offline), `ts-fsrs`.
- **Backend:** Supabase — Postgres, logowanie, Realtime (pojedynki na żywo), Row Level Security, Edge Functions.
- **Hosting:** Vercel / Netlify / Cloudflare Pages. Na darmowych planach koszt \~0 zł.

### Opcja B — .NET (jeśli chcesz przy okazji rozwijać się zawodowo)

- Blazor WebAssembly jako PWA + ASP.NET Core Minimal API + SignalR (realtime) + EF Core + PostgreSQL.
- Plus: realny projekt w .NET do portfolio. Minus: wolniejszy start, mniej gotowych komponentów UI pod mobile; FSRS trzeba przenieść na C# (algorytm jest krótki, istnieją też porty społeczności — do sprawdzenia).

### Opcja C — natywne aplikacje

- Expo / React Native (+ web). Lepsze odczucie natywne, ale publikacja w App Store to konto deweloperskie Apple (płatne rocznie) i więcej zachodu. Dla dwóch osób raczej nie warto.

### Usługi dodatkowe

- **Audio (TTS):** start z darmowym Web Speech API; później lepsze głosy (np. Azure TTS) z cache nagrań.
- **AI:** API Claude do generowania zdań przykładowych, tekstów i+1, wyjaśniania błędów i rozmów w rolach. Klucz API tylko po stronie serwera (Edge Function), nigdy w aplikacji.
- **Dane słownikowe:** listy Goethe A1–B1 jako szkielet; rodzajniki i liczby mnogie z Wiktionary (np. zrzuty Wiktextract — licencja CC BY-SA, trzeba ją uszanować).

### Offline-first

- Wszystko zapisuje się najpierw lokalnie (Dexie), synchronizacja z Supabase w tle; konflikty rozstrzygane per karta (nowszy wpis wygrywa).

## 8. Model danych

| Tabela | Najważniejsze pola |
| --- | --- |
| users | id, nazwa, avatar, cel dzienny, język UI |
| groups, group\_members | para / grupa znajomych, członkowie |
| words | de, article, plural, part\_of\_speech, en, pl, cefr, topic, example\_de, example\_en, audio\_url, tags, false\_friend |
| user\_cards | user\_id, word\_id, direction (de\_en / en\_de), due, stability, difficulty, reps, lapses, state, last\_review |
| reviews | user\_id, card\_id, rating, czas odpowiedzi (ms), reviewed\_at |
| grammar\_rules | cefr, tytuł, wyjaśnienie (markdown), przykłady, ćwiczenia |
| user\_grammar | user\_id, rule\_id, poziom opanowania + pola FSRS |
| game\_sessions | user\_id, gra, seed, poziom, wynik, ruchy, liczba odwróceń, czas |
| duels | group\_id, gra, seed, autor, wyniki obu graczy |
| xp\_events, weekly\_leagues | źródło XP, ilość, data; tabela ligi tygodnia |
| mnemonics | word\_id, autor, treść, polubienia |

Tabela `reviews` to pełna historia — pozwala później przeliczyć parametry FSRS pod Wasze tempo i robić statystyki.

## 9. Roadmapa MVP i praca w Claude Code

**Ważne:** zacznijcie się uczyć od razu (np. gotowa talia A1 w Anki), zanim aplikacja będzie gotowa. Budowanie apki łatwo staje się zastępstwem nauki — a słówka z Anki później zaimportujecie.

### Etapy

1. **Etap 0 (weekend):** repozytorium, `CLAUDE.md`, szkielet PWA, logowanie, deploy — aplikacja instaluje się na obu telefonach.
2. **Etap 1 — MVP (2–3 tyg.):** \~600 słów A1 z rodzajnikami, fiszki z FSRS, panel „Heute”, streak, proste statystyki. Od tego momentu uczycie się w swojej aplikacji.
3. **Etap 2:** Wortpasjans solo — poziomy, odwracanie kart, integracja z SRS.
4. **Etap 3:** rywalizacja — para, liga tygodniowa, pojedynki na tym samym seedzie, realtime.
5. **Etap 4:** gramatyka A1–A2 z ćwiczeniami, der/die/das Rush, „Ułóż zdanie”.
6. **Etap 5:** AI i audio — teksty i+1, wyjaśnianie błędów, rozmowy w rolach, lepsze TTS.
7. **Etap 6:** dopracowanie — powiadomienia push, widżet „słowo dnia”, ewentualnie Capacitor.

### Jak pracować z Claude Code

- Wyeksportuj ten dokument do Markdown i wrzuć do repo jako `docs/SPEC.md`.
- W `CLAUDE.md` opisz stack, konwencje, komendy (`npm run dev`, `npm test`) i zasady: mobile-first, każdy ekran sprawdzany w widoku 375 px, wszystkie dane najpierw offline.
- Pracuj etapami: najpierw poproś o plan etapu, zatwierdź go, potem implementacja i testy (Vitest + Playwright z widokiem telefonu).
- Słówka: Claude może wygenerować JSON z listą, ale rodzajniki i liczby mnogie zweryfikuj ze słownikiem — AI czasem się myli.

Przykładowy pierwszy prompt:

```
Przeczytaj docs/SPEC.md. Zbudujemy Etap 0 i Etap 1.
Zaproponuj strukturę projektu (React + TS + Vite + PWA + Supabase + Dexie + ts-fsrs),
schemat bazy dla words, user_cards i reviews oraz plan zadań.
Nie pisz jeszcze kodu — najpierw plan do mojej akceptacji.
```

## 10. Bank dodatkowych pomysłów

- **Naklejki do mieszkania:** aplikacja generuje PDF z kartkami „der Kühlschrank”, „die Tür”, „das Fenster” w kolorach rodzajów do przyklejenia na przedmioty.
- **Dziennik po niemiecku:** 3 zdania dziennie; AI poprawia i wyjaśnia błędy, partnerka może skomentować.
- **Rozmowy w rolach z AI:** kelner w Wiedniu, recepcja hotelu w Berlinie, zakupy na targu — na Waszym poziomie słownictwa.
- **„Nur Deutsch”:** 15 minut rozmowy we dwoje tylko po niemiecku z timerem; aplikacja podsuwa temat i potrzebne słowa.
- **Tryb serialowy:** log odcinków Nicos Weg / Easy German i słówka z danego odcinka do fiszek.
- **Boss tygodnia:** test podsumowujący, który odblokowuje kolejne miasto na mapie.
- **Słowo dnia** w powiadomieniu lub na widżecie.
- **Kolory rodzajników wszędzie** — w fiszkach, grach, tekstach, nawet w naklejkach.
- **Cel z datą:** egzamin Goethe A2 lub B1 jako meta całej podróży, z odliczaniem.
- **Tryb podróży:** przed wyjazdem do Niemiec/Austrii pakiet słów i zwrotów przydatnych na miejscu.
- **Tryb kuchenny:** przepisy po niemiecku — gotujecie razem i uczycie się słówek kuchennych.
