import { describe, expect, test } from 'vitest';
import { createSyncScheduler, handleSyncError } from '@/data/useSync';
import { BackendError } from '@/data/backend/types';

const deferred = () => {
  let resolve!: () => void;
  const p = new Promise<void>((r) => (resolve = r));
  return { p, resolve };
};

describe('createSyncScheduler', () => {
  test('a different profile is not blocked by an in-flight sync', async () => {
    const runs: string[] = [];
    const gate = deferred();
    const s = createSyncScheduler(async (id) => {
      runs.push(id);
      if (id === 'A') await gate.p;
    });
    const a = s('A');
    await s('B');
    expect(runs).toEqual(['A', 'B']);
    gate.resolve();
    await a;
  });
  test('a trigger during an in-flight sync of the same profile runs once more afterwards', async () => {
    const runs: string[] = [];
    let gate = deferred();
    const s = createSyncScheduler(async (id) => {
      runs.push(id);
      await gate.p;
    });
    const first = s('A');
    const second = s('A');
    const third = s('A');
    const g1 = gate;
    gate = deferred();
    gate.resolve();
    g1.resolve();
    await Promise.all([first, second, third]);
    expect(runs).toEqual(['A', 'A']);
  });
});

describe('handleSyncError', () => {
  const backend = (recovered: boolean) => {
    const calls: string[] = [];
    return {
      calls,
      b: {
        recoverSession: async () => {
          calls.push('recover');
          return recovered;
        },
        signOut: async () => {
          calls.push('signOut');
        },
      },
    };
  };
  test('unauthorized but session recoverable → stays signed in', async () => {
    const { b, calls } = backend(true);
    expect(await handleSyncError(new BackendError('unauthorized'), b)).toBe('kept');
    expect(calls).toEqual(['recover']);
  });
  test('unauthorized and refresh rejected → signs out', async () => {
    const { b, calls } = backend(false);
    expect(await handleSyncError(new BackendError('unauthorized'), b)).toBe('signed_out');
    expect(calls).toEqual(['recover', 'signOut']);
  });
  test('offline / other errors → nothing happens', async () => {
    const { b, calls } = backend(false);
    expect(await handleSyncError(new BackendError('offline'), b)).toBe('kept');
    expect(await handleSyncError(new Error('500'), b)).toBe('kept');
    expect(calls).toEqual([]);
  });
});

describe('syncWithPartners', () => {
  test('partners are skipped when my own sync signed the device out', async () => {
    const { syncWithPartners } = await import('@/data/useSync');
    const calls: string[] = [];
    await syncWithPartners('me', ['p1'], async (id) => {
      calls.push(id);
      return id === 'me' ? 'signed_out' : 'ok';
    });
    expect(calls).toEqual(['me']);
  });
  test('partners sync after me when all is fine', async () => {
    const { syncWithPartners } = await import('@/data/useSync');
    const calls: string[] = [];
    await syncWithPartners('me', ['p1', 'p2'], async (id) => (calls.push(id), 'ok'));
    expect(calls).toEqual(['me', 'p1', 'p2']);
  });
});
