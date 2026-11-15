import { Link, useParams } from 'react-router-dom';
import { getWord, TOPIC_LABELS } from '@/data/words';
import { useProfileData } from '@/data/useProfileData';
import { useCurrentProfile } from '@/stores/profileStore';
import { wordStatus } from '@/domain/status';
import { expectedAnswer } from '@/domain/answerCheck';
import { GenderWord } from '@/ui/GenderWord';
import { AudioButton } from '@/ui/AudioButton';
import { STATUS_DOT, STATUS_LABELS } from './WordsScreen';

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

export function WordDetailScreen() {
  const { id = '' } = useParams();
  const word = getWord(id);
  const profile = useCurrentProfile();
  const data = useProfileData(profile?.id);

  if (!word) return <p>Nie znaleziono słowa. <Link to="/words" className="text-accent">Wróć</Link></p>;
  const cards = (data?.cards ?? []).filter((c) => c.wordId === word.id && c.fsrs.reps > 0);
  const status = wordStatus(cards);
  const next = cards.map((c) => c.fsrs.due).sort()[0];

  return (
    <div className="space-y-5">
      <Link to="/words" className="text-sm text-muted">← Słowa</Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          {word.emoji && <div className="mb-2 text-4xl">{word.emoji}</div>}
          <GenderWord word={word} showPlural className="text-3xl" />
        </div>
        <AudioButton text={expectedAnswer(word)} />
      </div>
      <dl className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-muted/10">
        <div><dt className="text-xs text-muted">EN</dt><dd className="text-lg">{word.en}</dd></div>
        {word.pl && <div><dt className="text-xs text-muted">PL</dt><dd>{word.pl}</dd></div>}
        <div>
          <dt className="text-xs text-muted">Przykład</dt>
          <dd className="flex items-center gap-2 italic">{word.example_de} <AudioButton text={word.example_de} small label="Odsłuchaj zdanie" /></dd>
          <dd className="text-sm text-muted">{word.example_en}</dd>
        </div>
        {word.false_friend && <div><dt className="text-xs text-muted">Uwaga</dt><dd className="text-amber-700 dark:text-amber-300">⚠️ {word.false_friend}</dd></div>}
        {word.note && <div><dt className="text-xs text-muted">Notatka</dt><dd>{word.note}</dd></div>}
        <div><dt className="text-xs text-muted">Temat</dt><dd>{TOPIC_LABELS[word.topic] ?? word.topic}</dd></div>
      </dl>
      <div className="flex items-center justify-between rounded-2xl bg-surface p-4 ring-1 ring-muted/10">
        <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />{STATUS_LABELS[status]}</span>
        <span className="text-sm text-muted">{next ? `następna powtórka: ${fmt(next)}` : 'jeszcze nie ćwiczone'}</span>
      </div>
    </div>
  );
}
