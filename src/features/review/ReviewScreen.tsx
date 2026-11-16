import { useEffect, useState } from 'react';
import type { Grade } from '@/domain/types';
import { formatInterval, intervalsFor } from '@/domain/intervals';
import { newCard } from '@/domain/fsrs';
import { openProfileDb } from '@/data/db';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resolveReviewStart, useSessionStore } from '@/stores/sessionStore';
import { useCurrentProfile } from '@/stores/profileStore';
import { getWord } from '@/data/words';
import { ProgressBar } from '@/ui/ProgressBar';
import { Button } from '@/ui/Button';
import { DeEnCard } from './DeEnCard';
import { EnDeCard } from './EnDeCard';

export function ReviewScreen() {
  const profile = useCurrentProfile();
  const navigate = useNavigate();
  const { queue, index, done, start, answer, kind } = useSessionStore();
  const [params] = useSearchParams();
  const intent = params.get('practice') === '1' ? 'practice' : 'daily';

  useEffect(() => {
    // Resume only a same-day, same-profile, unfinished session; otherwise build today's queue.
    if (profile && resolveReviewStart(useSessionStore.getState(), profile.id, intent, new Date()) === 'start-daily') void start(profile);
  }, [profile?.id, intent]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Dobrze · 10 min": what each rating button will schedule for the current card
  const current = queue[index];
  const [hints, setHints] = useState<Record<Grade, string> | null>(null);
  useEffect(() => {
    setHints(null);
    if (!profile || !current) return;
    let alive = true;
    void openProfileDb(profile.id)
      .cards.get(current.cardId)
      .then((c) => {
        const now = new Date();
        const ms = intervalsFor(c ?? newCard(current.wordId, current.direction, now), now);
        if (alive) setHints({ 1: formatInterval(ms[1]), 2: formatInterval(ms[2]), 3: formatInterval(ms[3]), 4: formatInterval(ms[4]) });
      });
    return () => {
      alive = false;
    };
  }, [profile?.id, current?.cardId, index]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return null;
  const item = queue[index];
  const word = item ? getWord(item.wordId) : undefined;

  return (
    <div className="mx-auto flex min-h-full max-w-[480px] flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/" className="shrink-0 text-sm text-muted">
          ✕ Przerwij
        </Link>
        <ProgressBar value={index} max={queue.length} label="Postęp sesji" />
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {Math.min(index, queue.length)}/{queue.length}
        </span>
      </header>
      {done || !item || !word ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="text-6xl">🎉</div>
          <h1 className="text-2xl font-semibold">{kind === 'practice' ? 'Powtórka zrobiona!' : 'Na dziś wszystko!'}</h1>
          <p className="text-muted">Gut gemacht, {profile.displayName}.</p>
          <Button onClick={() => navigate(kind === 'practice' ? '/game' : '/')}>{kind === 'practice' ? 'Wróć do gry' : 'Wróć do Heute'}</Button>
        </div>
      ) : item.direction === 'de_en' ? (
        <DeEnCard key={`${item.cardId}-${index}`} word={word} showPl={profile.showPl} hints={hints} onRate={(g) => answer(g)} />
      ) : (
        <EnDeCard key={`${item.cardId}-${index}`} word={word} showPl={profile.showPl} hints={hints} onRate={(g, a) => answer(g, a)} />
      )}
    </div>
  );
}
