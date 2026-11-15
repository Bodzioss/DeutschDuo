import { createEmptyCard, fsrs, generatorParameters, type Card, type Grade as FsrsGrade } from 'ts-fsrs';
import { cardId, type CardRecord, type Direction, type FsrsState, type Grade } from './types';

const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: false }));

function toFsrs(s: FsrsState): Card {
  return {
    ...s,
    due: new Date(s.due),
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  };
}

function fromFsrs(c: Card): FsrsState {
  const s: FsrsState = {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as FsrsState['state'],
    learning_steps: c.learning_steps,
  };
  if (c.last_review) s.last_review = c.last_review.toISOString();
  return s;
}

export function newCard(wordId: string, direction: Direction, now: Date, dueAt?: Date): CardRecord {
  const empty = fromFsrs(createEmptyCard(now));
  if (dueAt) empty.due = dueAt.toISOString();
  return { id: cardId(wordId, direction), wordId, direction, fsrs: empty, updatedAt: now.toISOString(), dirty: 1 };
}

export function rateCard(card: CardRecord, grade: Grade, now: Date): CardRecord {
  const { card: next } = scheduler.next(toFsrs(card.fsrs), now, grade as FsrsGrade);
  return { ...card, fsrs: fromFsrs(next), updatedAt: now.toISOString(), dirty: 1 };
}
