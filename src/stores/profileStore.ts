import { create } from 'zustand';
import type { Profile } from '@/domain/types';
import { globalDb } from '@/data/db';

interface ProfileState {
  profiles: Profile[];
  currentId: string | null;
  loaded: boolean;
  /** Loads cached profiles and the selected profile from the device. */
  loadLocal(): Promise<void>;
  setProfiles(p: Profile[]): Promise<void>;
  select(id: string): Promise<void>;
  clear(): Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profiles: [],
  currentId: null,
  loaded: false,

  async loadLocal() {
    const [profiles, cur] = await Promise.all([globalDb.profiles.toArray(), globalDb.settings.get('currentProfileId')]);
    const currentId = (cur?.value as string | undefined) ?? null;
    set({ profiles, currentId: profiles.some((p) => p.id === currentId) ? currentId : null, loaded: true });
  },

  async setProfiles(profiles) {
    await globalDb.transaction('rw', globalDb.profiles, async () => {
      await globalDb.profiles.clear();
      await globalDb.profiles.bulkPut(profiles);
    });
    set((s) => ({ profiles, currentId: profiles.some((p) => p.id === s.currentId) ? s.currentId : null }));
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
