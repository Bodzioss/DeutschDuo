import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentProfile } from '@/stores/profileStore';
import { useProfileGames } from './useProfileGames';
import { LEVELS } from '@/domain/wortpasjans/levels';
import { bestStarsByLevel, isUnlocked, nextBoard } from '@/domain/wortpasjans/scoring';

const CITY_EMOJI: Record<string, string> = { Berlin: '🐻', Hamburg: '⚓', München: '🥨', Wien: '🎻', Zürich: '🏔️' };

export function MapScreen() {
  const profile = useCurrentProfile();
  const games = useProfileGames(profile?.id);
  const best = useMemo(() => bestStarsByLevel(games ?? []), [games]);
  const next = nextBoard(best);
  const cities = [...new Set(LEVELS.map((l) => l.city))];
  const totalStars = Object.values(best).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Wortpasjans</h1>
        <p className="text-sm text-muted">Ułóż słowa w kategorie. Przytrzymaj kartę, żeby podejrzeć tłumaczenie. ⭐ {totalStars}/{LEVELS.length * 3}</p>
      </header>
      <Link to={`/game/${next}`} className="block rounded-2xl bg-accent px-4 py-4 text-center text-lg font-semibold text-white shadow">
        Graj: {LEVELS.find((l) => l.id === next)!.city} {LEVELS.find((l) => l.id === next)!.index}/5
      </Link>
      <ol className="space-y-3">
        {cities.map((city, ci) => {
          const levels = LEVELS.filter((l) => l.city === city);
          const open = isUnlocked(levels[0].id, best);
          return (
            <li key={city} className={`rounded-2xl bg-surface p-4 ring-1 ring-muted/10 ${open ? '' : 'opacity-50'}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">{CITY_EMOJI[city]} {city}</h2>
                <span className="text-xs text-muted">{ci === 0 ? 'tematy' : ci === 1 ? '+ rodzajniki' : ci === 2 ? '+ liczba mnoga' : '+ czasowniki, przyimki'}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {levels.map((l) => {
                  const unlocked = isUnlocked(l.id, best);
                  const s = best[l.id] ?? 0;
                  const cls = `flex flex-col items-center rounded-xl py-2 text-sm ${l.id === next ? 'ring-2 ring-accent' : 'ring-1 ring-muted/20'}`;
                  const body = (
                    <>
                      <span className="font-semibold">{l.index}</span>
                      <span className="text-[10px] leading-none">{unlocked ? (s ? '⭐'.repeat(s) : '·') : '🔒'}</span>
                    </>
                  );
                  return unlocked ? (
                    <Link key={l.id} to={`/game/${l.id}`} className={cls} aria-label={`${city} ${l.index}, gwiazdki: ${s}`}>{body}</Link>
                  ) : (
                    <span key={l.id} className={cls} aria-label={`${city} ${l.index}, zablokowana`}>{body}</span>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
