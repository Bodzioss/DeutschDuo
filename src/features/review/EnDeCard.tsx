import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Grade, Word } from '@/domain/types';
import { checkAnswer, expectedAnswer, type Verdict } from '@/domain/answerCheck';
import { getWords } from '@/data/words';
import { GenderWord } from '@/ui/GenderWord';
import { AudioButton } from '@/ui/AudioButton';
import { Button } from '@/ui/Button';
import { UmlautBar } from '@/ui/UmlautBar';
import { speak } from '@/ui/speech';
import { RatingBar } from './RatingBar';

const MESSAGES: Record<Verdict, string> = {
  correct: 'Dobrze! ✓',
  typo: 'Prawie — mała literówka',
  wrong: 'Niestety nie',
  missing_article: 'Rodzajnik! Rzeczownik zawsze z der/die/das',
  wrong_article: 'Rodzajnik! Zły rodzaj',
  other_word: 'Poprawne słowo, ale szukamy innego — spróbuj jeszcze raz',
};

export function EnDeCard({ word, showPl, onRate }: { word: Word; showPl: boolean; onRate: (g: Grade, answer: string) => void }) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<ReturnType<typeof checkAnswer> | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue('');
    setResult(null);
    setHint(null);
    inputRef.current?.focus();
  }, [word]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!value.trim()) return;
    const r = checkAnswer(word, value, getWords());
    if (r.verdict === 'other_word') {
      setHint(MESSAGES.other_word);
      setValue('');
      inputRef.current?.focus();
      return;
    }
    setResult(r);
    speak(expectedAnswer(word));
  };

  const ok = result && (result.verdict === 'correct' || result.verdict === 'typo');
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        {word.emoji && <div className="text-5xl">{word.emoji}</div>}
        <p className="text-2xl">{word.en_prompt ?? word.en}</p>
        {showPl && word.pl && <p className="text-muted">{word.pl}</p>}
        {result && (
          <div className="mt-3 space-y-2">
            <p className={`font-semibold ${ok ? 'text-das' : 'text-die'}`}>{MESSAGES[result.verdict]}</p>
            {!ok && <p className="text-muted line-through">{value}</p>}
            <div className="flex items-center justify-center gap-2">
              <GenderWord word={word} showPlural className="text-3xl" />
              <AudioButton text={expectedAnswer(word)} />
            </div>
            <p className="text-sm italic">{word.example_de}</p>
          </div>
        )}
        {hint && !result && <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{hint}</p>}
      </div>
      <div className="space-y-3 pb-2">
        {result ? (
          <RatingBar suggested={result.suggested} onRate={(g) => onRate(g, value)} />
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Odpowiedź po niemiecku"
              placeholder={word.pos === 'noun' ? 'der/die/das …' : 'po niemiecku…'}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              lang="de"
              className="w-full rounded-xl bg-surface px-4 py-3 text-lg ring-1 ring-muted/30 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <UmlautBar inputRef={inputRef} value={value} onChange={setValue} />
            <Button type="submit" className="w-full" disabled={!value.trim()}>
              Sprawdź
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
