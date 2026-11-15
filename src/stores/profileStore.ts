import { create } from 'zustand';
import type { Profile } from '@/domain/types';
import { globalDb } from '@/data/db';
import { backend } from '@/data/backend';

const DIRTY_KEY = 'dirtyProfileIds';

interface ProfileState {
  profiles: Profile[];
  currentId: string | null;
  loaded: boolean;
  /** Loads cached profiles and the selected profile from the device. */
  loadLocal(): Promise<void>;
  /** Pushes locally changed profile settings, then fetches profiles from the backend. Silent when offline. */
  refresh(): Promise<void>;
  setProfiles(p: Profile[]): Promise<void>;
  /** Saves settings locally first, then to the backend (retried on next refresh if offline). */
  updateProfile(p: Profile): Promise<void>;
  select(id: string): Promise<void>;
  clear(): Promise<void>;
}

/** When each profile was last edited on this device (guards against an older in-flight fetch). */
const editedAt = new Map<string, number>();

async function dirtyIds(): Promise<string[]> {
  return ((await globalDb.settings.get(DIRTY_KEY))?.value as string[] | undefined) ?? [];
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  currentId: null,
  loaded: false,

  async loadLocal() {
    const [profiles, cur] = await Promise.all([globalDb.profiles.toArray(), globalDb.settings.get('currentProfileId')]);
    const currentId = (cur?.value as string | undefined) ?? null;
    set({ profiles, currentId: profiles.some((p) => p.id === currentId) ? currentId : null, loaded: true });
  },

  async refresh() {
    try {
      for (const id of await dirtyIds()) {
        const p = get().profiles.find((x) => x.id === id);
        if (!p) continue;
        await backend.updateProfile(p);
        // remove only what was pushed, and only if it did not change meanwhile
        if (get().profiles.find((x) => x.id === id) === p) {
          await globalDb.settings.put({ key: DIRTY_KEY, value: (await dirtyIds()).filter((d) => d !== id) });
        }
      }
      const fetchStarted = Date.now();
      const server = await backend.fetchProfiles();
      // local edits not yet confirmed by the server, or made while fetching, win over the fetched copy
      const dirty = new Set(await dirtyIds());
      const local = new Map(get().profiles.map((p) => [p.id, p]));
      const keepLocal = (id: string) => local.has(id) && (dirty.has(id) || (editedAt.get(id) ?? 0) >= fetchStarted);
      await get().setProfiles(server.map((p) => (keepLocal(p.id) ? local.get(p.id)! : p)));
    } catch (e) {
      console.warn('profile refresh skipped', e);
    }
  },

  async setProfiles(profiles) {
    await globalDb.transaction('rw', globalDb.profiles, async () => {
      await globalDb.profiles.clear();
      await globalDb.profiles.bulkPut(profiles);
    });
    set((s) => ({ profiles, currentId: profiles.some((p) => p.id === s.currentId) ? s.currentId : null }));
  },

  async updateProfile(p) {
    editedAt.set(p.id, Date.now());
    await globalDb.profiles.put(p);
    set((s) => ({ profiles: s.profiles.map((x) => (x.id === p.id ? p : x)) }));
    try {
      await backend.updateProfile(p);
    } catch {
      const dirty = new Set(await dirtyIds()).add(p.id);
      await globalDb.settings.put({ key: DIRTY_KEY, value: [...dirty] });
    }
  },

  async select(id) {
    await globalDb.settings.put({ key: 'currentProfileId', value: id });
    set({ currentId: id });
  },

  async clear() {
    await globalDb.settings.delete('currentProfileId');
    set({ currentId: null });
  },
}));

export const useCurrentProfile = (): Profile | null =>
  useProfileStore((s) => s.profiles.find((p) => p.id === s.currentId) ?? null);
