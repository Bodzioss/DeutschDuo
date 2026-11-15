import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useProfileStore } from '@/stores/profileStore';
import { backend } from '@/data/backend';
import { FAKE_PASSWORD } from '@/data/backend/fake';
import { globalDb } from '@/data/db';

const setOnline = (v: boolean) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(v);

beforeEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  await globalDb.profiles.clear();
  await globalDb.settings.clear();
  await backend.signIn(FAKE_PASSWORD);
  await useProfileStore.getState().refresh();
});

describe('profileStore', () => {
  test('offline edit survives a failed refresh and is pushed on the next online refresh', async () => {
    const p = useProfileStore.getState().profiles[0];
    setOnline(false);
    await useProfileStore.getState().updateProfile({ ...p, newPerDay: 17 });
    await useProfileStore.getState().refresh();
    expect(useProfileStore.getState().profiles[0].newPerDay).toBe(17);
    setOnline(true);
    await useProfileStore.getState().refresh();
    expect((await backend.fetchProfiles())[0].newPerDay).toBe(17);
    expect(useProfileStore.getState().profiles[0].newPerDay).toBe(17);
  });

  test('edit made while a refresh is in flight is not overwritten nor forgotten', async () => {
    const p = useProfileStore.getState().profiles[0];
    const realFetch = backend.fetchProfiles.bind(backend);
    let release!: () => void;
    vi.spyOn(backend, 'fetchProfiles').mockImplementation(async () => {
      const server = await realFetch();
      await new Promise<void>((r) => (release = r));
      return server;
    });
    const pending = useProfileStore.getState().refresh();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    setOnline(false); // the edit cannot reach the server
    await useProfileStore.getState().updateProfile({ ...p, newPerDay: 6 });
    release();
    await pending;
    expect(useProfileStore.getState().profiles[0].newPerDay).toBe(6);
    const dirty = (await globalDb.settings.get('dirtyProfileIds'))?.value as string[];
    expect(dirty).toContain(p.id);
  });

  test('online edit made while a refresh is in flight is not reverted by the older fetch', async () => {
    const p = useProfileStore.getState().profiles[0];
    const realFetch = backend.fetchProfiles.bind(backend);
    let release!: () => void;
    vi.spyOn(backend, 'fetchProfiles').mockImplementation(async () => {
      const server = await realFetch();
      await new Promise<void>((r) => (release = r));
      return server;
    });
    const pending = useProfileStore.getState().refresh();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await useProfileStore.getState().updateProfile({ ...p, newPerDay: 8 });
    release();
    await pending;
    expect(useProfileStore.getState().profiles[0].newPerDay).toBe(8);
  });
});
