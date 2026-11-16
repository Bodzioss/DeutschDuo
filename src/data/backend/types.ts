import type { CardRecord, GameRecord, Profile, ReviewRecord } from '@/domain/types';

export type BackendErrorCode = 'bad_password' | 'offline' | 'unauthorized';

export class BackendError extends Error {
  constructor(public code: BackendErrorCode) {
    super(code);
  }
}

/** Opaque server-side cursor for incremental pulls. */
export type Cursor = string | null;

export interface Backend {
  /** Signs this device into the shared pair account. Throws BackendError('bad_password' | 'offline'). */
  signIn(password: string): Promise<void>;
  isSignedIn(): Promise<boolean>;
  signOut(): Promise<void>;
  /**
   * Called after an 'unauthorized' response. Tries to refresh the session; true when the device is still signed in
   * (refreshed, or the failure was transient), false only when the server definitively rejected the session.
   */
  recoverSession(): Promise<boolean>;
  fetchProfiles(): Promise<Profile[]>;
  updateProfile(p: Profile): Promise<void>;
  /** Idempotent by review id. */
  pushReviews(profileId: string, reviews: ReviewRecord[]): Promise<void>;
  /** Server keeps a card only when the pushed updatedAt is newer than what it has. */
  pushCards(profileId: string, cards: CardRecord[]): Promise<void>;
  /**
   * Rows changed since the cursor. May re-deliver already-seen rows (overlap window), so callers must merge
   * idempotently and must not treat a non-empty result as "something changed".
   */
  pullReviews(profileId: string, since: Cursor): Promise<{ rows: ReviewRecord[]; cursor: Cursor }>;
  pullCards(profileId: string, since: Cursor): Promise<{ rows: CardRecord[]; cursor: Cursor }>;
  /** Finished Wortpasjans boards; append-only, idempotent by id (like reviews). */
  pushGames(profileId: string, games: GameRecord[]): Promise<void>;
  pullGames(profileId: string, since: Cursor): Promise<{ rows: GameRecord[]; cursor: Cursor }>;
  /** Registers this device for Web Push for a profile; moves the endpoint when it already belongs to another profile. */
  savePushSubscription(profileId: string, sub: { endpoint: string; p256dh: string; auth: string; tz: string }): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<void>;
  /** Best effort nudge to the partner (duel / overtake). Never throws. */
  notifyPartner(e: { kind: 'duel' | 'overtake'; from: string; to: string; duelBothPlayed?: boolean }): Promise<void>;
}
