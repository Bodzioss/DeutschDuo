import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentProfile } from '@/stores/profileStore';
import { useProfileData } from '@/data/useProfileData';
import { getWord } from '@/data/words';
import { addDays, localDay } from '@/domain/day';
import { dailyActivity } from '@/domain/streak';
import { hardestWords, knownOverTime, minutesPerDay, retention30d } from '@/domain/stats';
import { wordStatus } from '@/domain/status';
import { GenderWord } from '@/ui/GenderWord';
import { Heatmap } from './Heatmap';
import { LineChart } from './LineChart';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 text-center ring-1 ring-muted/10">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export function StatsScreen() {
  const profile = useCurrentProfile();
  const data = useProfileData(profile?.id);

  const s = useMemo(() => {
    if (!data) return null;
    const today = localDay(new Date());
    const activity = dailyActivity(data.reviews);
    const last60 = Array.from({ length: 60 }, (_, i) => addDays(today, i - 59));
    const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const byWord = new Map<string, typeof data.cards>();
    for (const c of data.cards) byWord.set(c.wordId, [...(byWord.get(c.wordId) ?? []), c]);
    const known = [...byWord.values()].filter((cs) => ['known', 'mastered'].includes(wordStatus(cs))).length;
    return {
      today,
      known,
      started: byWord.size,
      retention: retention30d(data.reviews, today),
      weekMinutes: minutesPerDay(activity, week).reduce((a, b) => a + b, 0),
      knownSeries: knownOverTime(data.reviews, last60).map((x) => x.known),
      minutesByDay: new Map([...activity].map(([d, a]) => [d, a.minutes])),
      hardest: hardestWords(data.cards),
    };
  }, [data]);

  if (!s) return null;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Statystyki</h1>
      <div className="grid grid-cols-3 gap-2">
        <Stat value={String(s.known)} label="znane słowa" />
        <Stat value={s.retention === null ? '—' : `${Math.round(s.retention * 100)}%`} label="retencja 30 dni" />
        <Stat value={String(Math.round(s.weekMinutes))} label="min w 7 dni" />
      </div>
      <section className="rounded-2xl bg-surface p-4 ring-1 ring-muted/10">
        <h2 className="mb-2 font-semibold">Znane słowa (60 dni)</h2>
        <LineChart values={s.knownSeries} label="Liczba znanych słów w ostatnich 60 dniach" />
        <p className="text-xs text-muted">Rozpoczęte: {s.started}</p>
      </section>
      <section className="rounded-2xl bg-surface p-4 ring-1 ring-muted/10">
        <h2 className="mb-3 font-semibold">Aktywność</h2>
        <Heatmap minutesByDay={s.minutesByDay} today={s.today} />
      </section>
      <section className="rounded-2xl bg-surface p-4 ring-1 ring-muted/10">
        <h2 className="mb-2 font-semibold">Najtrudniejsze słowa</h2>
        {s.hardest.length === 0 ? (
          <p className="text-sm text-muted">Na razie brak — tak trzymaj!</p>
        ) : (
          <ol className="divide-y divide-muted/10">
            {s.hardest.map(({ wordId, lapses }) => {
              const w = getWord(wordId);
              return w ? (
                <li key={wordId}>
                  <Link to={`/words/${wordId}`} className="flex justify-between py-2">
                    <GenderWord word={w} />
                    <span className="text-sm text-muted">{lapses}× zapomniane</span>
                  </Link>
                </li>
              ) : null;
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
