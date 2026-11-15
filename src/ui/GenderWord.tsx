import type { Word } from '@/domain/types';

const color = { der: 'text-der', die: 'text-die', das: 'text-das' } as const;

export function GenderWord({ word, showPlural = false, className = '' }: { word: Word; showPlural?: boolean; className?: string }) {
  const c = word.article ? color[word.article] : '';
  return (
    <span className={className}>
      <span className={`font-semibold ${c}`}>
        {word.article && <span className="opacity-80">{word.article} </span>}
        {word.de}
      </span>
      {showPlural && word.pos === 'noun' && (
        <span className="block text-sm font-normal text-muted">
          {word.plural ? <>l.mn. <span className="text-die">die</span> {word.plural}</> : 'bez l.mn.'}
        </span>
      )}
    </span>
  );
}
