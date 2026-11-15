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
      const dirty = await dirtyIds();
      for (const id of dirty) {
        const p = get().profiles.find((x) => x.id === id);
        if (p) await backend.updateProfile(p);
      }
      await globalDb.settings.put({ key: DIRTY_KEY, value: [] });
      await get().setProfiles(await backend.fetchProfiles());
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
