# Etap 0+1: final whole-branch review (62bdc22..3575846)

Verdict: **With fixes**. 0 Critical. The domain, sync and data layers are solid. 4 of the 5 review focuses hold; Focus 5 does not (auto-audio, I5).

## Important (status updated in place)
1. **"Na dziś wszystko ✓" hides an unfinished session.** Requeued new cards (due in ~10 min) make `empty` true while `goalMet` is false, so the streak is silently lost. Fix: show Kontynuuj while the in-memory session has items; show the done message only when `goalMet`.
2. **Stale Heute and session across time and 03:00.** `useToday` recomputes only on DB change; the session store has no day stamp, so "Kontynuuj" can resume yesterday's queue. Fix: refresh on visibility/minute timer; store `builtForDay`; rebuild in ReviewScreen when it differs.
3. **Double tap → duplicate or accidental ratings.** `answer()` has no in-flight guard; RatingBar appears exactly where Pokaż/Sprawdź was. Fix: busy guard, ignore taps ~300 ms after reveal, `touch-action: manipulation`.
4. **Changing the daily goal rewrites streak history.** Every past day is judged against the current goal. Fix: snapshot `goal_min` per review/day (migration column).
5. **Auto-audio speaks German with a non-German voice.** `speak()` must return early without a German voice. The "one-time notice in Settings" from spec §5.4 is not implemented.

## Minor (deferred unless noted)
- The 150 cap leaks: first EN→DE reviews (wasNew) are not counted; in-session requeues are uncapped.
- `voiceAvailable` caches false forever if voices load after 1 s.
- ReviewScreen briefly shows "Na dziś wszystko" while `start()` is pending; no loading state.
- iOS keyboard does not open on the next EN→DE card (focus happens outside the user gesture); umlaut bar may sit under the keyboard.
- The progress bar moves backwards on requeue.
- `answer()` rejections are unhandled (UI freezes silently).
- A11y: no aria-live on the verdict, aria-label on bare spans, small "Przerwij" target, dark-mode accent contrast ~3:1.
- "System" theme does not follow live OS changes; iOS status-bar style is unreadable in the light theme.
- No e2e test types an EN→DE answer.

## Declined to judge (reviewer) → rulings
- PostgREST quoted-timestamp `or()` filter is unverified against live Supabase → check in SETUP §5.
- vite-plugin-pwa autoUpdate mid-session, iOS speech autoplay, iOS keyboard → needs a real-device pass.
- Requeue pedagogy (two passes per new word), knownOverTime vs "znane słowa" definitions → accepted as is.
