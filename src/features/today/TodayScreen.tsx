import { useNavigate } from 'react-router-dom';
import { useCurrentProfile } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import { Button } from '@/ui/Button';
import { ProgressBar } from '@/ui/ProgressBar';
import { useToday } from './useToday';

export function TodayScreen() {
  const profile = useCurrentProfile();
  const t = useToday(profile);
  const navigate = useNavigate();
  const inProgress = useSessionStore((s) => s.profileId === profile?.id && !s.done && s.index > 0);

  if (!profile || !t) return null;
  const empty = t.dueCount + t.newCount === 0;
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

      {empty ? (
        <p className="rounded-2xl bg-das/10 p-6 text-center text-lg font-semibold text-das">Na dziś wszystko ✓</p>
      ) : (
        <Button className="w-full py-5 text-xl" onClick={() => navigate('/review')}>
          {inProgress ? 'Kontynuuj' : 'Start'}
        </Button>
      )}
    </div>
  );
}
