import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCurrentProfile } from '@/stores/profileStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useProfileData } from '@/data/useProfileData';
import { openProfileDb } from '@/data/db';
import { markDuelStarted, peekWord, recordGame } from '@/data/games';
import { syncNow } from '@/data/useSync';
import { getWord, getWords } from '@/data/words';
import { levelById, nextLevel } from '@/domain/wortpasjans/levels';
import { duelForDay } from '@/domain/pair';
import { localDay } from '@/domain/day';
import { generateDeal } from '@/domain/wortpasjans/generator';
import { srsRank } from '@/domain/wortpasjans/pool';
import { FREE_PEEKS, stars as starsFor } from '@/domain/wortpasjans/scoring';
import { categoryOf, isCategoryCard, isWon, wordIdOf, type CardId, type Deal } from '@/domain/wortpasjans/engine';
import { expectedAnswer } from '@/domain/answerCheck';
import type { CardRecord, Profile } from '@/domain/types';
import { Button } from '@/ui/Button';
import { GenderWord } from '@/ui/GenderWord';
import { AudioButton } from '@/ui/AudioButton';
import { speak } from '@/ui/speech';
import { chime, haptic } from '@/ui/haptics';
import { CardBack, CategoryCard, WordCard } from './GameCard';
import { useBoard } from './useBoard';
import { useCardDrag } from './useCardDrag';

/** Builds a personalised solvable deal once per attempt (not on every DB change). */
function useDeal(levelId: string, cards: CardRecord[] | null, attempt: number, fixedSeed: number | null, duel: boolean) {
  const [g, setG] = useState<ReturnType<typeof generateDeal> | 'error' | null>(null);
  useEffect(() => {
    const level = levelById(levelId);
    if (!level || !cards) return;
    const words = getWords();
    // a fixed seed (?seed=…) gives a reproducible board (tests now, duels in Etap 3)
    const seed = fixedSeed !== null && attempt === 0 ? fixedSeed : (Date.now() + attempt * 7919) % 2_000_000_000;
    const intro = new Map(words.map((w, i) => [w.id, i]));
    try {
      // a duel uses introduction order so both players get exactly the same board
      setG(generateDeal(seed, level, { words, rank: duel ? (w) => intro.get(w.id) ?? 0 : srsRank(words, cards, new Date()) }));
    } catch (e) {
      console.warn('personal deal failed, falling back to introduction order', e);
      try {
        setG(generateDeal(seed, level, { words, rank: (w) => intro.get(w.id) ?? 0 }));
      } catch (e2) {
        console.error('no deal', e2);
        setG('error');
      }
    }
  }, [levelId, attempt, cards === null, duel]); // eslint-disable-line react-hooks/exhaustive-deps
  return g;
}

export function BoardScreen() {
  const { level = '' } = useParams();
  const profile = useCurrentProfile();
  const data = useProfileData(profile?.id);
  const [attempt, setAttempt] = useState(0);
  const [params] = useSearchParams();
  // ?duel=<today> → the pair's duel of the day: fixed seed + level, first opening only. The day is frozen on mount,
  // so a re-render after 03:00 does not turn a running duel into a different board.
  const [today] = useState(() => localDay(new Date()));
  const requested = params.get('duel');
  const duelValid = requested === today && duelForDay(today).levelId === level;
  const [duelMode, setDuelMode] = useState<'checking' | 'duel' | 'practice'>(requested ? 'checking' : 'practice');
  const decided = useRef(false);
  useEffect(() => {
    if (!requested || !duelValid || !profile || decided.current) return;
    decided.current = true;
    void markDuelStarted(openProfileDb(profile.id), today).then((first) => setDuelMode(first ? 'duel' : 'practice'));
  }, [requested, duelValid, profile, today]);
  const duelDay = duelMode === 'duel' && attempt === 0 ? today : null;
  const fixedSeed = duelDay ? duelForDay(duelDay).seed : params.get('seed') !== null && /^\d+$/.test(params.get('seed')!) ? Number(params.get('seed')) : null;
  const g = useDeal(level, duelMode === 'checking' ? null : (data?.cards ?? null), attempt, fixedSeed, !!duelDay);
  if (requested && !duelValid) {
    return <p className="p-6 text-center">Ten pojedynek już minął. <Link to="/para" className="text-accent">Dzisiejszy pojedynek</Link></p>;
  }
  if (!levelById(level)) return <p className="p-6">Nie ma takiej planszy. <Link to="/game" className="text-accent">Mapa</Link></p>;
  if (g === 'error') return <p className="p-6 text-center">Nie udało się rozdać tej planszy. <Link to="/game" className="text-accent">Wróć do mapy</Link></p>;
  if (!profile || !g) return <p className="p-6 text-center text-muted">Tasuję karty…</p>;
  return (
    <Board
      key={`${g.deal.seed}-${attempt}`}
      profile={profile}
      deal={g.deal}
      par={g.par}
      moveLimit={g.moveLimit}
      duelDay={duelDay}
      duelPractice={!!requested && duelMode === 'practice'}
      onRetry={() => setAttempt((a) => a + 1)}
    />
  );
}

function Board({ profile, deal, par, moveLimit, duelDay, duelPractice, onRetry }: { profile: Profile; deal: Deal; par: number; moveLimit: number; duelDay: string | null; duelPractice: boolean; onRetry: () => void }) {
  const [celebrate, setCelebrate] = useState<{ label: string; key: number } | null>(null);
  // feedback runs inside the tap/drop gesture, which iPhone needs for its haptic tap
  const b = useBoard(deal, moveLimit, (prev, next, m) => {
    const finished = next.completed.slice(prev.completed.length);
    if (isWon(deal, next)) {
      haptic('win');
      chime([523.25, 659.25, 783.99, 1046.5]);
    } else if (finished.length) {
      haptic('success');
      chime();
      setCelebrate({ label: deal.categories.find((c) => c.id === finished[0])?.label ?? '', key: Date.now() });
    } else if (m.type === 'move' && m.to.kind === 'slot') haptic('light');
  });
  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(null), 1600);
    return () => clearTimeout(t);
  }, [celebrate]);
  const dnd = useCardDrag((from, to) => b.tryMove(from, to));
  const navigate = useNavigate();
  const startWords = useSessionStore((s) => s.startWords);
  const [peekCard, setPeekCard] = useState<string | null>(null);
  const [result, setResult] = useState<{ stars: number; won: boolean } | null>(null);
  const saved = useRef(false);
  const level = levelById(deal.level)!;
  const db = openProfileDb(profile.id);
  const catLabel = useMemo(() => new Map(deal.categories.map((c) => [c.id, c])), [deal]);
  // test builds only: expose the deal so E2E can solve it and replay the moves
  if (import.meta.env.VITE_BACKEND === 'fake') (window as unknown as { __duoDeal?: Deal }).__duoDeal = deal;

  const finish = async (won: boolean) => {
    if (saved.current) return;
    saved.current = true;
    const st = starsFor({ won, moves: b.state.moves, par, peeks: b.peeked.length });
    await recordGame(db, { level: deal.level, seed: deal.seed, won, stars: st, moves: b.state.moves, par, peeks: b.peeked.length, peekedWordIds: b.peeked, durationMs: b.durationMs(), now: new Date(), ...(duelDay ? { duelDay } : {}) });
    setResult({ stars: st, won });
    if (duelDay) void syncNow(profile.id); // get the duel result to the partner quickly
  };

  useEffect(() => {
    if (b.won) void finish(true);
    else if (b.lost) void finish(false);
  }, [b.won, b.lost]); // eslint-disable-line react-hooks/exhaustive-deps

  const doPeek = (wordId: string) => {
    if (!b.peeked.includes(wordId)) void peekWord(db, wordId, new Date());
    b.peek(wordId);
    b.select(null); // the first tap of the double tap selected the card
    setPeekCard(wordId);
    const w = getWord(wordId);
    if (w) speak(expectedAnswer(w));
  };

  const quit = async () => {
    if (duelDay && !result) {
      // leaving a duel counts as a loss, otherwise the fixed board could be studied for free
      if (!confirm('To pojedynek: wyjście liczy się jako przegrana. Zakończyć?')) return;
      await finish(false);
      navigate('/para');
      return;
    }
    if (b.state.moves > 0 && !result) {
      if (!confirm('Zakończyć planszę? Zostanie zapisana jako nieukończona.')) return;
      await finish(false);
    }
    navigate(duelPractice ? '/para' : '/game');
  };

  const renderCard = (card: CardId, raw: { selected: boolean; onTap: () => void; stacked?: boolean }) => {
    // the click that ends a drag is not a tap
    const opts = { ...raw, onTap: () => !dnd.wasDrag() && raw.onTap() };
    if (isCategoryCard(card)) {
      const c = catLabel.get(categoryOf(deal, card))!;
      return <CategoryCard label={c.label} hint={c.hint} {...opts} />;
    }
    const w = getWord(wordIdOf(card)!)!;
    // a double tap peeks only if its first tap selected this card (not if that tap just moved another card here)
    return <WordCard word={w} {...opts} onDoubleTap={() => (raw.selected ? !dnd.wasDrag() && doPeek(w.id) : opts.onTap())} />;
  };

  const sel = b.selected;
  const peeksLeft = Math.max(0, FREE_PEEKS - b.peeked.length);
  return (
    <div className="mx-auto flex min-h-full max-w-[480px] flex-col gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between text-sm">
        <button type="button" onClick={quit} className="py-2 pr-3 text-muted">
          ✕ {duelDay ? '⚔️ Pojedynek' : duelPractice ? 'Trening (pojedynek już rozpoczęty)' : `${level.city} ${level.index}/5`}
        </button>
        <span className="tabular-nums" aria-label="Pozostałe ruchy">🦶 {b.movesLeft}</span>
        <span className="tabular-nums" aria-label="Darmowe podglądy">👁 {peeksLeft}</span>
      </header>

      {/* progress on the left; discard pile and deck at the top right */}
      <div className="grid grid-cols-4 items-center gap-2">
        <div className="col-span-2 space-y-0.5 text-[11px] text-muted">
          <p>Ukończone: <span className="tabular-nums">{b.state.completed.length}/{deal.categories.length}</span></p>
          <p>Dotknij słowa 2× — podgląd</p>
        </div>
        <div data-testid="waste" className={`touch-none ${dnd.drag?.source.kind === 'waste' ? 'opacity-30' : ''}`}
          onPointerDown={(e) => b.state.waste.length && dnd.press(e, { kind: 'waste' }, [b.state.waste[b.state.waste.length - 1]])}>
          {b.state.waste.length ? (
            renderCard(b.state.waste[b.state.waste.length - 1], {
              selected: sel?.kind === 'waste',
              onTap: () => b.select({ kind: 'waste' }),
              stacked: false,
            })
          ) : (
            <div className="h-[3.25rem] rounded-lg border border-dashed border-muted/25" />
          )}
        </div>
        <button type="button" onClick={b.draw} aria-label={`Stos: ${b.state.stock.length} kart`}
          className="relative flex min-h-[3.25rem] items-center justify-center rounded-lg border border-muted/30 bg-gradient-to-br from-accent/50 to-accent/25 text-sm font-semibold shadow-sm">
          {b.state.stock.length ? <span className="tabular-nums">{b.state.stock.length}</span> : <span aria-hidden>↺</span>}
        </button>
      </div>

      {/* category slots */}
      <div data-testid="slots" className="grid gap-2" style={{ gridTemplateColumns: `repeat(${deal.slots}, minmax(0, 1fr))` }}>
        {b.state.slots.map((slot, i) => {
          if (!slot) {
            return (
              <button key={i} data-testid={`slot-${i}`} data-drop={`slot:${i}`} type="button" onClick={() => b.moveTo({ kind: 'slot', slot: i })} aria-label="Wolne pole kategorii"
                className={`flex min-h-[3.25rem] items-center justify-center rounded-lg border-2 border-dashed border-muted/30 text-[11px] text-muted`}>
                wolne pole
              </button>
            );
          }
          const c = catLabel.get(slot.categoryId)!;
          return (
            <div key={i} data-testid={`slot-${i}`} data-drop={`slot:${i}`}><CategoryCard label={c.label} hint={c.hint} onTap={() => b.moveTo({ kind: 'slot', slot: i })}>
              <span className="text-[11px] tabular-nums">{slot.count}/{c.wordIds.length}</span>
            </CategoryCard></div>
          );
        })}
      </div>

      {/* tableau */}
      <div className="grid flex-1 grid-cols-4 gap-2">
        {b.state.columns.map((col, ci) => {
          const empty = !col.faceDown.length && !col.faceUp.length;
          return (
            <div key={ci} data-testid={`col-${ci}`} data-drop={`col:${ci}`} className="flex min-h-[4rem] flex-col rounded-lg"
              onClick={() => empty && b.moveTo({ kind: 'column', col: ci })}>
              {empty && <div className="flex h-[3.25rem] items-center justify-center rounded-lg border border-dashed border-muted/25 text-[10px] text-muted">pusta</div>}
              {col.faceDown.map((_, i) => <CardBack key={`d${i}`} />)}
              {col.faceUp.map((card, i) => {
                const depth = col.faceUp.length - i;
                const isTop = i === col.faceUp.length - 1;
                const selected = !!sel && sel.kind === 'column' && sel.col === ci && depth <= sel.depth;
                const dragged = dnd.drag?.source.kind === 'column' && dnd.drag.source.col === ci && depth <= dnd.drag.source.depth;
                return (
                  <div key={card} data-testid={`col-${ci}-up-${i}`} className={`touch-none ${isTop ? '' : '-mb-7'} ${dragged ? 'opacity-30' : ''}`}
                    onPointerDown={(e) => dnd.press(e, b.sourceAt(ci, i), col.faceUp.slice(i))}>
                    {renderCard(card, {
                      selected,
                      stacked: !isTop,
                      // with a selection: try to move here; if that is not legal, select this card instead
                      onTap: () => {
                        if (b.selected && !(sel?.kind === 'column' && sel.col === ci) && b.moveTo({ kind: 'column', col: ci })) return;
                        b.selectInColumn(ci, i);
                      },
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {celebrate && (
        <div key={celebrate.key} role="status" className="pointer-events-none fixed left-1/2 top-[38%] z-40 animate-pop rounded-2xl bg-das px-6 py-3 text-center text-white shadow-xl motion-reduce:animate-none motion-reduce:-translate-x-1/2">
          <p className="text-lg font-bold">✓ {celebrate.label}</p>
          <p className="text-xs opacity-90">Kategoria ukończona!</p>
        </div>
      )}

      {dnd.drag && (
        <div aria-hidden className="pointer-events-none fixed z-40 drop-shadow-xl" style={{ left: dnd.drag.x - dnd.drag.dx, top: dnd.drag.y - dnd.drag.dy, width: dnd.drag.width }}>
          {dnd.drag.cards.map((card, i) => (
            <div key={card} className={i < dnd.drag!.cards.length - 1 ? '-mb-7' : ''}>
              {renderCard(card, { selected: false, stacked: i < dnd.drag!.cards.length - 1, onTap: () => {} })}
            </div>
          ))}
        </div>
      )}

      {peekCard && <PeekSheet wordId={peekCard} showPl={profile.showPl} onClose={() => setPeekCard(null)} />}
      {result && (
        <Summary
          result={result}
          moves={b.state.moves}
          peeked={b.peeked}
          levelId={deal.level}
          duel={!!duelDay}
          onPractise={async () => {
            await startWords(profile, b.peeked);
            navigate('/review?practice=1');
          }}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}

function PeekSheet({ wordId, showPl, onClose }: { wordId: string; showPl: boolean; onClose: () => void }) {
  const w = getWord(wordId);
  if (!w) return null;
  return (
    <div role="dialog" aria-label="Podgląd słowa" className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto w-full max-w-[480px] space-y-2 rounded-t-2xl bg-surface p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2">
          <GenderWord word={w} showPlural className="text-2xl" />
          <AudioButton text={expectedAnswer(w)} small />
        </div>
        <p className="text-lg">{w.en}</p>
        {showPl && w.pl && <p className="text-muted">{w.pl}</p>}
        <p className="text-xs text-muted">To słowo wróci szybciej w fiszkach.</p>
        <Button className="w-full" onClick={onClose}>OK</Button>
      </div>
    </div>
  );
}

function Summary({ result, moves, peeked, levelId, duel, onPractise, onRetry }: { result: { stars: number; won: boolean }; moves: number; peeked: string[]; levelId: string; duel: boolean; onPractise: () => void; onRetry: () => void }) {
  const navigate = useNavigate();
  const next = nextLevel(levelId);
  return (
    <div role="dialog" aria-label="Podsumowanie planszy" className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[420px] space-y-4 rounded-2xl bg-surface p-5 text-center">
        <h2 className="text-2xl font-bold">{result.won ? 'Geschafft!' : 'Nicht ganz…'}</h2>
        <p className="text-3xl" aria-label={`${result.stars} gwiazdki`}>{'⭐'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}</p>
        <p className="text-sm text-muted">Ruchy: {moves} · podglądy: {peeked.length}</p>
        {peeked.length > 0 && (
          <ul className="divide-y divide-muted/10 rounded-xl bg-bg text-left text-sm">
            {peeked.map((id) => {
              const w = getWord(id);
              return w ? (
                <li key={id} className="flex justify-between gap-2 px-3 py-2">
                  <GenderWord word={w} />
                  <span className="truncate text-muted">{w.en}</span>
                </li>
              ) : null;
            })}
          </ul>
        )}
        {duel && (
          <Button className="w-full" onClick={() => navigate('/para')}>⚔️ Zobacz wynik pojedynku</Button>
        )}
        <div className="space-y-2">
          {peeked.length > 0 && <Button className="w-full" onClick={onPractise}>Ćwicz teraz ({peeked.length})</Button>}
          {result.won && next && !duel && (
            <Button variant={peeked.length ? 'secondary' : 'primary'} className="w-full" onClick={() => navigate(`/game/${next.id}`)}>
              Następna plansza: {next.city} {next.index}/5
            </Button>
          )}
          <Button variant="secondary" className="w-full" onClick={onRetry}>Jeszcze raz</Button>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/game')}>Mapa</Button>
        </div>
      </div>
    </div>
  );
}
