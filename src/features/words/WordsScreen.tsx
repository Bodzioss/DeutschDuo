import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWords, TOPIC_LABELS, TOPIC_ORDER } from '@/data/words';
import { useProfileData } from '@/data/useProfileData';
import { useCurrentProfile } from '@/stores/profileStore';
import { normalize } from '@/domain/answerCheck';
import { wordStatus, type WordStatus } from '@/domain/status';
import type { CardRecord } from '@/domain/types';
import { GenderWord } from '@/ui/GenderWord';

export const STATUS_LABELS: Record<WordStatus, string> = { new: 'nowe', learning: 'uczę się', known: 'znam', mastered: 'opanowane' };
export const STATUS_DOT: Record<WordStatus, string> = { new: 'bg-muted/40', learning: 'bg-amber-500', known: 'bg-das', mastered: 'bg-der' };

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-sm ${active ? 'bg-accent text-white' : 'bg-surface ring-1 ring-muted/30'}`}
    >
      {children}
    </button>
  );
}

export function WordsScreen() {
  const profile = useCurrentProfile();
  const data = useProfileData(profile?.id);
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState<string | null>(null);
  const [status, setStatus] = useState<WordStatus | null>(null);

  const cardsByWord = useMemo(() => {
    const m = new Map<string, CardRecord[]>();
    for (const c of data?.cards ?? []) m.set(c.wordId, [...(m.get(c.wordId) ?? []), c]);
    return m;
  }, [data]);

  const list = useMemo(() => {
    const nq = normalize(q);
    return getWords()
      .map((w) => ({ w, s: wordStatus(cardsByWord.get(w.id) ?? []) }))
      .filter(({ w, s }) => {
        if (topic && w.topic !== topic) return false;
        if (status && s !== status) return false;
        if (!nq) return true;
        return [w.de, w.article ? `${w.article} ${w.de}` : '', w.en, w.pl ?? ''].some((t) => normalize(t).includes(nq));
      });
  }, [q, topic, status, cardsByWord]);

  const topics = TOPIC_ORDER.filter((t) => getWords().some((w) => w.topic === t));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Słowa</h1>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Szukaj (DE / EN / PL)…"
        aria-label="Szukaj słowa"
        className="w-full rounded-xl bg-surface px-4 py-3 ring-1 ring-muted/30 focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={topic === null} onClick={() => setTopic(null)}>Wszystkie</Chip>
        {topics.map((t) => (
          <Chip key={t} active={topic === t} onClick={() => setTopic(topic === t ? null : t)}>{TOPIC_LABELS[t] ?? t}</Chip>
        ))}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(Object.keys(STATUS_LABELS) as WordStatus[]).map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(status === s ? null : s)}>{STATUS_LABELS[s]}</Chip>
        ))}
      </div>
      <p className="text-xs text-muted">{list.length} słów</p>
      <ul className="divide-y divide-muted/10 rounded-2xl bg-surface ring-1 ring-muted/10">
        {list.map(({ w, s }) => (
          <li key={w.id}>
            <Link to={`/words/${w.id}`} className="flex items-center gap-3 px-4 py-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[s]}`} aria-label={STATUS_LABELS[s]} />
              <GenderWord word={w} className="min-w-0 flex-1 truncate" />
              <span className="min-w-0 max-w-[45%] truncate text-right text-sm text-muted">{w.en}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
