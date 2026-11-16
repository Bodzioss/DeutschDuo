import { useEffect, useMemo, useState } from 'react';
import { useProfileStore } from '@/stores/profileStore';
import { syncWithPartners } from '@/data/useSync';
import { isDuelStarted } from '@/data/games';
import { openProfileDb } from '@/data/db';
import { Link } from 'react-router-dom';
import { useCurrentProfile } from '@/stores/profileStore';
import { localDay, addDays } from '@/domain/day';
import { dailyActivity } from '@/domain/streak';
import { JOINT_WEEKLY_REVIEWS, duelForDay, duelGameOf, duelWinner, isTie, pairStreak, standings, weekStart } from '@/domain/pair';
import { levelById } from '@/domain/wortpasjans/levels';
import type { GameRecord } from '@/domain/types';
import { ProgressBar } from '@/ui/ProgressBar';
import { usePairData } from './usePairData';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const fmtTime = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}`;

export function duelLine(g: GameRecord | undefined): string {
  if (!g) return 'jeszcze nie grał(a)';
  return `${g.won ? '✓' : '✗'} ${g.moves} ruchów · ${fmtTime(g.durationMs)} · 👁 ${g.peeks}`;
}

export function PairScreen() {
  const me = useCurrentProfile();
  const players = usePairData();
  const today = localDay(new Date());
  const partnerIds = useProfileStore((s) => s.profiles.filter((p) => p.id !== me?.id).map((p) => p.id).join(','));
  const [duelStarted, setDuelStarted] = useState(false);

  // fresh partner results when the screen opens (background sync covers the rest)
  useEffect(() => {
    if (!me) return;
    if (navigator.onLine !== false) void syncWithPartners(me.id, partnerIds.split(',').filter(Boolean));
    void isDuelStarted(openProfileDb(me.id), today).then(setDuelStarted);
  }, [me?.id, partnerIds, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => {
    if (!players || !me) return null;
    const mine = players.find((p) => p.profileId === me.id)!;
    const partner = players.find((p) => p.profileId !== me.id);
    const table = standings(players, today);
    const lastWeekEnd = addDays(weekStart(today), -1);
    const lastWeek = standings(players, lastWeekEnd, { complete: true });
    const streak = partner
      ? pairStreak(dailyActivity(mine.reviews), dailyActivity(partner.reviews), today, mine.goalMin, partner.goalMin)
      : 0;
    const together = table.reduce((s, r) => s + r.reviews, 0);
    const duel = duelForDay(today);
    const myDuel = duelGameOf(mine.games, today);
    const theirDuel = partner ? duelGameOf(partner.games, today) : undefined;
    const w = duelWinner(myDuel, theirDuel);
    const lastWeekPlayed = lastWeek.some((r) => r.reviews > 0);
    return { mine, partner, table, tie: isTie(table), lastWeek: lastWeekPlayed ? lastWeek : null, lastWeekTie: isTie(lastWeek), streak, together, duel, myDuel, theirDuel, w };
  }, [players, me, today]);

  if (!me || !view) return <p className="p-6 text-center text-muted">Wczytuję ligę…</p>;
  const level = levelById(view.duel.levelId)!;
  const partnerName = view.partner?.name ?? 'partner';

  return (
    <div className="space-y-5">
      <Link to="/" className="text-sm text-muted">← Heute</Link>
      <h1 className="text-2xl font-bold">🏆 Liga tygodnia</h1>

      <section aria-label="Tabela ligi" className="space-y-2">
        {view.table.map((r, i) => (
          <div key={r.profileId} className={`flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ${i === 0 ? 'ring-amber-400/60' : 'ring-muted/10'}`}>
            <span className="text-2xl">{view.tie ? '🤝' : i === 0 ? '🥇' : '🥈'}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.name}{r.profileId === me.id ? ' (Ty)' : ''}</p>
              <p className="text-xs text-muted">cel {r.goalMin} min · {r.daysMet} dni · {r.reviews} powtórek · ⚔️ {r.duelWins}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums">{pct(r.goalPct)}</p>
              <p className="text-xs tabular-nums text-muted">{r.xp} XP</p>
            </div>
          </div>
        ))}
        <p className="text-xs text-muted">Wygrywa systematyczność: średni % realizacji własnego celu dziennego, przy remisie liczba dni z celem, potem XP. Reset w poniedziałek.</p>
      </section>

      {!view.partner && <p className="rounded-2xl bg-surface p-4 text-sm text-muted ring-1 ring-muted/10">Liga i pojedynki działają, gdy w parze są dwa profile.</p>}
      {view.partner && <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface p-4 text-center ring-1 ring-muted/10">
          <p className="text-2xl font-bold">🔥 {view.streak}</p>
          <p className="text-xs text-muted">streak pary</p>
        </div>
        <div className="space-y-2 rounded-2xl bg-surface p-4 ring-1 ring-muted/10">
          <p className="text-sm font-semibold">Wspólny cel</p>
          <ProgressBar value={view.together} max={JOINT_WEEKLY_REVIEWS} label="Wspólny cel tygodnia" />
          <p className="text-xs tabular-nums text-muted">{Math.min(view.together, JOINT_WEEKLY_REVIEWS)}/{JOINT_WEEKLY_REVIEWS} powtórek</p>
        </div>
      </section>}

      {view.partner && <section aria-label="Pojedynek dnia" className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-muted/10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">⚔️ Pojedynek dnia</h2>
          <span className="text-xs text-muted">{level.city} {level.index}/5</span>
        </div>
        <ul className="space-y-1 text-sm">
          <li className="flex justify-between gap-2"><span className="min-w-0 truncate">{me.displayName}</span><span className="shrink-0 text-right text-muted">{!view.myDuel && duelStarted ? 'przerwany' : duelLine(view.myDuel)}</span></li>
          <li className="flex justify-between gap-2"><span className="min-w-0 truncate">{partnerName}</span><span className="shrink-0 text-right text-muted">{duelLine(view.theirDuel)}</span></li>
        </ul>
        {view.w && (
          <p className="text-center font-semibold" data-testid="duel-result">
            {view.w === 'draw' ? 'Remis!' : `Wygrywa ${view.w === 'a' ? me.displayName : partnerName}!`}
          </p>
        )}
        {!view.myDuel && !duelStarted && (
          <Link to={`/game/${view.duel.levelId}?duel=${today}`} className="block rounded-xl bg-accent py-3 text-center font-semibold text-white">
            Zagraj pojedynek
          </Link>
        )}
        {view.myDuel && !view.theirDuel && <p className="text-center text-sm text-muted">Czekamy na wynik: {partnerName}.</p>}
        {!view.myDuel && duelStarted && <p className="text-center text-sm text-muted">Pojedynek został rozpoczęty i przerwany na tym telefonie.</p>}
      </section>}

      {view.lastWeek && (
        <p className="text-center text-sm text-muted">
          {view.lastWeekTie ? (
            <>Zeszły tydzień: remis 🤝 ({pct(view.lastWeek[0].goalPct)})</>
          ) : (
            <>Zeszły tydzień: wygrał(a) <strong>{view.lastWeek[0].name}</strong> ({pct(view.lastWeek[0].goalPct)}). Przegrany stawia kawę ☕</>
          )}
        </p>
      )}
    </div>
  );
}
