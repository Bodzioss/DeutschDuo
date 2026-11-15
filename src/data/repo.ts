import { newCard, rateCard } from '@/domain/fsrs';
import { localDay, startOfNextLocalDay } from '@/domain/day';
import { cardId, type CardRecord, type Grade, type ReviewRecord } from '@/domain/types';
import type { SessionItem } from '@/domain/sessionBuilder';
import type { DuoDB } from './db';

export const UNLOCKED_AT = new Date(0).toISOString();

export async function recordReview(
  db: DuoDB,
  p: { item: SessionItem; grade: Grade; durationMs: number; answer?: string; now: Date; closesQueue: boolean },
): Promise<{ card: CardRecord; review: ReviewRecord; unlocked?: CardRecord }> {
  return db.transaction('rw', db.cards, db.reviews, async () => {
    const { item, grade, now } = p;
    const existing = (await db.cards.get(item.cardId)) ?? newCard(item.wordId, item.direction, now);
    const wasNew = existing.fsrs.reps === 0;
    const card = rateCard(existing, grade, now);

    const review: ReviewRecord = {
      id: crypto.randomUUID(),
      cardId: card.id,
      rating: grade,
      durationMs: p.durationMs,
      reviewedAt: now.toISOString(),
      localDay: localDay(now),
      wasNew,
      closesQueue: p.closesQueue,
      scheduledDays: card.fsrs.scheduled_days,
      synced: 0,
    };
    if (p.answer !== undefined) review.answer = p.answer;

    await db.cards.put(card);
    await db.reviews.add(review);

    let unlocked: CardRecord | undefined;
    if (item.direction === 'de_en' && grade >= 3) {
      const enDeId = cardId(item.wordId, 'en_de');
      if (!(await db.cards.get(enDeId))) {
        // Minimal updatedAt: a real review of this card on another device must always win over this blank copy.
        unlocked = { ...newCard(item.wordId, 'en_de', now, startOfNextLocalDay(now)), updatedAt: UNLOCKED_AT };
        await db.cards.add(unlocked);
      }
    }
    return { card, review, unlocked };
  });
}

/** The card as it would be after rating it now — without writing anything. */
export async function previewRating(db: DuoDB, item: SessionItem, grade: Grade, now: Date): Promise<CardRecord> {
  const existing = (await db.cards.get(item.cardId)) ?? newCard(item.wordId, item.direction, now);
  return rateCard(existing, grade, now);
}

export async function loadAll(db: DuoDB): Promise<{ cards: CardRecord[]; reviews: ReviewRecord[] }> {
  const [cards, reviews] = await Promise.all([db.cards.toArray(), db.reviews.toArray()]);
  return { cards, reviews };
}
