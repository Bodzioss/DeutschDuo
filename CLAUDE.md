# Deutsch Duo

A German-learning PWA for two people (Nikola, Marcin), A1 → B1. Product spec: `docs/SPEC.md`. Current stage design: `docs/superpowers/specs/2026-11-15-etap-0-1-mvp-design.md`. Plan: `docs/superpowers/plans/`.

## Stack
React 18 + TypeScript (strict) + Vite 6, vite-plugin-pwa, Tailwind 3, Zustand, Dexie 4 (IndexedDB), ts-fsrs, React Router 6, Supabase (one shared "pair" account + profiles), Vitest + fake-indexeddb, Playwright.

## Commands
- `npm run dev`: dev server
- `npm test`: unit tests (Vitest, TZ=Europe/Warsaw)
- `npm run e2e`: Playwright at 375×812 (Chromium + WebKit). Builds with `VITE_BACKEND=fake`.
- `npm run typecheck`
- `npm run vocab:validate -- <kaikki.jsonl>`: checks vocabulary against Wiktextract and writes `data/vocab/report.md`

## Layout
- `src/domain/`: pure logic (FSRS, day/streak, answer checking, session building, stats). No React, no IO, always unit tested.
- `src/data/`: Dexie DB (one per profile), word loader, backend (`supabase` | `fake`), sync.
- `src/features/<feature>/`: screens. `src/ui/`: shared components. `src/stores/`: Zustand.
- `data/vocab/a1/*.json`: the source of truth for vocabulary.
- `supabase/migrations/`: SQL schema with RLS.

## Rules
- Mobile-first. Check every screen at 375 px, in light and dark mode. No horizontal scroll.
- Offline-first. Write to Dexie first and sync in the background. The network never blocks a session.
- Gender colours everywhere: der = `text-der` (blue), die = `text-die` (red), das = `text-das` (green).
- The UI is in Polish. Cards use EN as the bridge language, with optional PL.
- The local day ends at 03:00 device time (`localDay`).
- Write the test first (TDD) for anything in `src/domain` and `src/data`.
- Never commit `.env`, service keys, or Wiktextract dumps (`data/vocab/raw/`).
- Wiktionary data is CC BY-SA. Keep the attribution on the "O danych" screen.
