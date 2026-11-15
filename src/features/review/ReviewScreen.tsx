import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSessionStore } from '@/stores/sessionStore';
import { useCurrentProfile } from '@/stores/profileStore';
import { getWord } from '@/data/words';
import { ProgressBar } from '@/ui/ProgressBar';
import { Button } from '@/ui/Button';
import { DeEnCard } from './DeEnCard';
import { EnDeCard } from './EnDeCard';

export function ReviewScreen() {
  const profile = useCurrentProfile();
  const navigate = useNavigate();
  const { queue, index, done, profileId, start, answer } = useSessionStore();

  useEffect(() => {
    // Start (or rebuild) the session when entering for this profile or after a finished one.
    if (profile && (profileId !== profile.id || done)) void start(profile);
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <h1 className="text-2xl font-semibold">Na dziś wszystko!</h1>
          <p className="text-muted">Gut gemacht, {profile.displayName}.</p>
          <Button onClick={() => navigate('/')}>Wróć do Heute</Button>
        </div>
      ) : item.direction === 'de_en' ? (
        <DeEnCard key={`${item.cardId}-${index}`} word={word} showPl={profile.showPl} onRate={(g) => answer(g)} />
      ) : (
        <EnDeCard key={`${item.cardId}-${index}`} word={word} showPl={profile.showPl} onRate={(g, a) => answer(g, a)} />
      )}
    </div>
  );
}
