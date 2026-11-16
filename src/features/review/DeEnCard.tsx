import { useEffect, useState } from 'react';
import type { Grade, Word } from '@/domain/types';
import { GenderWord } from '@/ui/GenderWord';
import { AudioButton } from '@/ui/AudioButton';
import { Button } from '@/ui/Button';
import { speak } from '@/ui/speech';
import { expectedAnswer } from '@/domain/answerCheck';
import { RatingBar } from './RatingBar';

export function DeEnCard({ word, showPl, onRate, hints }: { word: Word; showPl: boolean; onRate: (g: Grade) => void; hints?: Record<Grade, string> | null }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setRevealed(false);
    speak(expectedAnswer(word));
  }, [word]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        {word.emoji && revealed && <div className="text-5xl">{word.emoji}</div>}
        <GenderWord word={word} showPlural className="text-4xl" />
        <AudioButton text={expectedAnswer(word)} />
        {revealed && (
          <div className="mt-2 space-y-3">
            <p className="text-2xl">{word.en}</p>
            {showPl && word.pl && <p className="text-muted">{word.pl}</p>}
            {word.false_friend && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">⚠️ {word.false_friend}</p>
            )}
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="italic">{word.example_de}</span>
              <AudioButton text={word.example_de} small label="Odsłuchaj zdanie" />
            </div>
            <p className="text-sm text-muted">{word.example_en}</p>
          </div>
        )}
      </div>
      <div className="pb-2">
        {revealed ? (
          <RatingBar onRate={onRate} hints={hints} />
        ) : (
          <Button className="w-full" onClick={() => setRevealed(true)}>
            Pokaż
          </Button>
        )}
      </div>
    </div>
  );
}
