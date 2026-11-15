import type { CardRecord, Profile, ReviewRecord } from '@/domain/types';

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
}
