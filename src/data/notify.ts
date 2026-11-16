import { backend } from './backend';
import { getMeta, openProfileDb, setMeta } from './db';
import { loadPlayers } from './pairPlayers';
import { duelGameOf, overtook, soleLeader, standings } from '@/domain/pair';
import { useProfileStore } from '@/stores/profileStore';

const LEADER_KEY = 'leagueLeader';

/** I finished today's duel: let the partner's phone know (and whether the duel is now decided). Never throws. */
export async function reportDuel(me: string, partner: string, today: string): Promise<void> {
  try {
    if (navigator.onLine === false) return;
    const duelBothPlayed = !!duelGameOf(await openProfileDb(partner).games.toArray(), today);
    await backend.notifyPartner({ kind: 'duel', from: me, to: partner, duelBothPlayed });
  } catch (e) {
    console.warn('notify duel skipped', e);
  }
}

/** After a partner sync: remember who leads the week; tell the partners when I just took the lead. Never throws. */
export async function checkOvertake(me: string, partners: string[], today: string): Promise<void> {
  try {
    if (navigator.onLine === false) return;
    const ids = [me, ...partners];
    const profiles = useProfileStore.getState().profiles.filter((p) => ids.includes(p.id));
    const s = standings(await loadPlayers(profiles), today);
    const db = openProfileDb(me);
    const prev = (await getMeta<string | null>(db, LEADER_KEY)) ?? null;
    await setMeta(db, LEADER_KEY, soleLeader(s));
    if (prev !== null && overtook(prev, s, me)) {
      for (const to of partners) await backend.notifyPartner({ kind: 'overtake', from: me, to });
    }
  } catch (e) {
    console.warn('notify overtake skipped', e);
  }
}
