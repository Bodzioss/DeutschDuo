# Deutsch Duo — Etap 2: Wortpasjans (design)

Date: 2026-11-16 · Sources: `docs/SPEC.md` §4, Etap 0+1 design. Marcin asked for "sensible assumptions"; every decision below is **Claude's call** unless marked otherwise and can be changed later.

## 1. Intent

A word solitaire that is fun on its own and practises vocabulary and grammar along the way: grouping words into categories forces recall of meaning, gender and plural, and the cards a player had to peek at feed back into the flashcards. It is our own game. It shares a genre with category solitaires, but not a name, look, levels or content.

**Goals**
- Solo play: a travel map of 5 cities × 5 boards, 1–3 stars per board, cities unlock in order.
- Topic categories (from word topics) and grammar categories (gender, plural ending, separable verbs, preposition cases).
- Peeking a card (long press or 🔄) shows EN (+PL) and plays audio. 3 peeks per board are free; more cost stars. Peeked words come back sooner in the flashcards.
- A post-game summary with the peeked words and a "Ćwicz teraz" (practise now) button.
- Deterministic deals from a seed, checked by a solver, so that Etap 3 duels can give both players the same board.
- Played games are stored locally and synced (Etap 3 needs them for the league).
- Works at 375 px, offline, in light and dark mode.

**Non-goals (later)**: duels, league, co-op (Etap 3+); drag and drop (tap-to-move only); desktop layout; sounds and animations beyond simple transitions.

**Anti-goals**: unwinnable deals; a game that replaces the flashcards (it does not count toward the daily goal or streak); hidden SRS penalties the player cannot see.

## 2. Rules (Claude's call)

- **Deck**: K categories. Each category has 1 category card plus N word cards, so the deck has K·(N+1) cards.
- **Tableau**: 4 columns with 2, 3, 4 and 5 cards. In each column only the top card is face up.
- **Stock**: the remaining cards, face down. Tapping the stock turns its top card onto the waste pile, where it is playable. When the stock is empty, tapping it turns the waste back into the stock. That costs a move.
- **Category slots**: S slots, where S < K at higher levels. A category card placed in an empty slot opens that category. A word card can go onto the open slot of its category. When a slot holds N words, the category is complete and the slot frees up.
- **Tableau moves**: a face-up card (word or category card) may be placed on a column whose top card belongs to the same category. The face-up run on top of a column can be moved as a whole if every card in it is the same category. Any card or valid run can go into an empty column. Moving the top card off a column turns the next card face up.
- **Moves**: every move counts, including turning the stock. The move limit is solver par × 1.5, rounded up, plus 5.
- **Win**: all K categories completed. **Loss**: no moves left, or the player gives up.
- **Stars**: a win gives 3 stars. Minus 1 star if moves > par × 1.2. Minus 1 star per 2 peeks beyond the 3 free ones. A win never scores less than 1 star.

## 3. Categories

A category = `{ id, label (German, e.g. "Essen und Trinken" or "Artikel: die"), hint (Polish), test(word) }`.
- **Topic** (one per vocab topic): German label, matches `word.topic`.
- **Grammar** (from data, no new tags):
  - gender: `der` / `die` / `das` (nouns),
  - plural ending: `-(e)n`, `-e`, `-er`, `-s` (nouns whose plural ≠ singular),
  - `trennbare Verben` (verbs whose note contains "trennbar"),
  - prepositions: `+ Dativ` (aus, bei, mit, nach, von, zu), `+ Akkusativ` (für, ohne, um), `Wechselpräpositionen` (in, an, auf, vor, hinter, neben, unter, über, zwischen).
- A word may match several categories. A deal uses each word in exactly one category of the board, and the **generator never puts a word on a board where it also matches another category of that same board**. This keeps the solution unambiguous.

## 4. Map and difficulty

| City | Boards | K categories | N words | Slots S | Categories |
|---|---|---|---|---|---|
| Berlin | 5 | 3 | 3 | 3 | topics only |
| Hamburg | 5 | 4 | 3 | 3 | topics + gender |
| München | 5 | 4 | 4 | 3 | + plural endings |
| Wien | 5 | 5 | 4 | 4 | + verbs and prepositions |
| Zürich | 5 | 5 | 5 | 4 | all |

The first board is unlocked. Each won board unlocks the next, and the first board of the next city opens after the last board of the current one. Boards can be replayed; the best stars are kept.

## 5. Choosing words (personal decks)

The deal is made by `generateDeal(seed, level, pool)`.
- **Solo**: the pool is personalised from the player's SRS. Category choice prefers categories with many of the player's started words. Inside a category, words are picked in this order: due or learning (~60%), then known (~30%), then not yet introduced in introduction order (~10%). If any group runs short, the next group fills in. With few started words early on, boards simply contain more new words.
- **Duel (Etap 3)**: the pool is all words of the level, with no personal data, so the same seed gives the same board for both players.
- If the solver cannot clear a deal within its node budget, the next seed is tried (`seed + 1`, …) and the seed actually used is stored.

## 6. Solver

A pure function `solve(deal) → { solvable, par }`. It runs DFS with memoised state hashes, prefers obviously good moves (onto a slot, freeing a face-down card) and has a node budget of about 200k. Par = the solution length found (not necessarily optimal). It runs in the generator before the board reaches the player; target < 100 ms on a phone.

## 7. SRS integration

- **Peek**: if the word has cards, its `de_en` card becomes due now (dirty; `updatedAt` follows the monotonic rule). If it has no cards yet, nothing changes, because the game was only an exposure.
- **"Ćwicz teraz"**: starts a review session made only of the peeked words (de_en cards, created as new if missing).
- Game time does not count toward the daily goal or the streak (Claude's call).

## 8. Data and sync

- **Local (per-profile Dexie, schema v2)**: `games` with `{ id (uuid), level, seed, won, stars, moves, peeks, peekedWordIds, durationMs, playedAt, localDay, synced }`, plus a `meta` key `wortpasjansProgress` that caches the best stars per level. Progress is derived from `games`, so the cache can always be rebuilt.
- **Supabase**: migration `0003_game_sessions.sql` adds `game_sessions` (append-only, RLS through `profiles.owner_id`, `server_seq` + `changed_at`, same pull rules as `reviews`). Sync pushes and pulls games exactly like reviews.

## 9. UI

- A new bottom tab **„Gra”**, so 5 tabs. The map screen shows a vertical route of the 5 cities with board dots and stars, and locked cities greyed out.
- **Board screen** (375 px):
  - top: moves left, peeks left, ✕;
  - a row of S category slots;
  - 4 columns, with face-down cards drawn as overlapping card backs;
  - bottom: stock and waste.
- **Cards**: category cards have a distinct frame and a 📂 icon. Word cards show the German word with its article in gender colour. Tap selects (highlighting legal targets), tap on a target moves. Long press or 🔄 peeks.
- **Summary**: stars, moves, peeked words with EN, „Ćwicz teraz”, „Następna plansza”.
- **Heute**: a tile „Plansza dnia: <city> <n>/5” that opens the next unfinished board.

## 10. Testing

- Unit tests:
  - rules engine: every move type, illegal moves, completion, stock recycling, win/loss;
  - generator: determinism per seed, no ambiguous words, level sizes;
  - solver: solvable and unsolvable fixtures, node budget;
  - stars;
  - SRS peek effect;
  - game persistence and sync (fake backend);
  - SQL migration in PGlite.
- E2E at 375 px: open the map, play a fixed-seed board to a win through the UI (the test seed is solved by the solver and its moves are replayed by taps), see the summary.
