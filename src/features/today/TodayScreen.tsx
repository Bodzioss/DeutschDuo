import { useNavigate } from 'react-router-dom';
import { useCurrentProfile } from '@/stores/profileStore';
import { isResumable, useSessionStore } from '@/stores/sessionStore';
import { Button } from '@/ui/Button';
import { ProgressBar } from '@/ui/ProgressBar';
import { useToday } from './useToday';
import { useProfileGames } from '@/features/game/useProfileGames';
import { bestStarsByLevel, nextBoard } from '@/domain/wortpasjans/scoring';
import { levelById } from '@/domain/wortpasjans/levels';
import { Link } from 'react-router-dom';

export function TodayScreen() {
  const profile = useCurrentProfile();
  const t = useToday(profile);
  const navigate = useNavigate();
  const games = useProfileGames(profile?.id);
  const nextGame = levelById(nextBoard(bestStarsByLevel(games ?? [])))!;
  const inProgress = useSessionStore((s) => !!profile && s.index > 0 && isResumable(s, profile.id, new Date()));

  if (!profile || !t) return null;
  const waitMin = t.nextDueAt ? Math.max(1, Math.ceil((Date.parse(t.nextDueAt) - Date.now()) / 60_000)) : null;
  const minutes = Math.floor(t.minutesToday);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-muted">Hallo,</p>
        <h1 className="text-3xl font-bold">{profile.displayName} 👋</h1>
      </header>

      <section className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-muted/10">
        <div>
          <p className="text-3xl font-bold" aria-label={`Streak ${t.streak} dni`}>🔥 {t.streak}</p>
          <p className="text-xs text-muted">{t.streak === 1 ? 'dzień z rzędu' : 'dni z rzędu'}</p>
        </div>
        <div className="text-right" aria-label={`Zamrożenia: ${t.freezes}`}>
          <p className="text-2xl">{t.freezes > 0 ? '❄️'.repeat(t.freezes) : '—'}</p>
          <p className="text-xs text-muted">zamrożenia</p>
        </div>
      </section>

      <section className="space-y-2 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-muted/10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Cel dzienny</h2>
          <span className="text-sm tabular-nums text-muted" data-testid="minutes-today">
            {t.goalMet ? '✓ zrobione' : `${minutes} / ${t.goalMin} min`}
          </span>
        </div>
        <ProgressBar value={t.goalMet ? 1 : t.minutesToday} max={t.goalMet ? 1 : t.goalMin} label="Cel dzienny" />
      </section>

      <section className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl bg-surface p-4 ring-1 ring-muted/10">
          <p className="text-2xl font-bold tabular-nums" data-testid="due-count">{t.dueCount}</p>
          <p className="text-xs text-muted">powtórki</p>
        </div>
        <div className="rounded-2xl bg-surface p-4 ring-1 ring-muted/10">
          <p className="text-2xl font-bold tabular-nums" data-testid="new-count">{t.newCount}</p>
          <p className="text-xs text-muted">nowe słowa</p>
        </div>
      </section>

      {t.status === 'done' && !inProgress ? (
        <p className="rounded-2xl bg-das/10 p-6 text-center text-lg font-semibold text-das">Na dziś wszystko ✓</p>
      ) : t.status === 'wait' && !inProgress ? (
        <p className="rounded-2xl bg-amber-500/10 p-6 text-center text-amber-700 dark:text-amber-300">
          Cel jeszcze nie zaliczony.{' '}
          {waitMin ? `Kilka kart wróci za ${waitMin} min — wtedy dokończ sesję.` : `Zostało ${Math.max(0, t.goalMin - minutes)} min nauki.`}
        </p>
      ) : (
        <Button className="w-full py-5 text-xl" onClick={() => navigate('/review')}>
          {inProgress ? 'Kontynuuj' : 'Start'}
        </Button>
      )}
      <Link to={`/game/${nextGame.id}`} className="flex items-center justify-between rounded-2xl bg-surface p-4 ring-1 ring-muted/10">
        <span>
          <span className="block font-semibold">🃏 Plansza dnia</span>
          <span className="text-sm text-muted">Wortpasjans · {nextGame.city} {nextGame.index}/5</span>
        </span>
        <span aria-hidden className="text-muted">›</span>
      </Link>
    </div>
  );
}
