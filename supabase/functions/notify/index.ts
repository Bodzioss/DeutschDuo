// Edge Function `notify`: Web Push reminders (Etap 4a). Wiring only; every decision lives in ../_shared/decide.ts.
//   { mode: 'scheduled' }  + header x-cron-secret   (pg_cron every 15 min)
//   { mode: 'partner', kind, from, to, duelBothPlayed? } + Authorization: Bearer <user JWT>   (the PWA)
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { decidePartner, decideScheduled, localClock, prevDay, type DayStat, type Kind, type Prefs, type Push } from '../_shared/decide.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

type ProfileRow = {
  id: string; owner_id: string; display_name: string; daily_goal_min: number;
  notify_goal: boolean; notify_goal_hour: number; notify_streak: boolean; notify_partner: boolean;
};
type SubRow = { endpoint: string; profile_id: string; p256dh: string; auth: string; tz: string; updated_at: string };
type ReviewRow = { local_day: string; duration_ms: number; closes_queue: boolean; goal_min: number | null };

const PROFILE_COLS = 'id, owner_id, display_name, daily_goal_min, notify_goal, notify_goal_hour, notify_streak, notify_partner';
const PAGE = 1000;

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const toPrefs = (p: ProfileRow): Prefs => ({
  goal: p.notify_goal, goalHour: p.notify_goal_hour, streak: p.notify_streak, partner: p.notify_partner,
});

/** Timezone of the profile's most recently updated subscription. */
const newestTz = (subs: SubRow[]) =>
  subs.reduce((a, b) => (b.updated_at > a.updated_at ? b : a)).tz;

async function sentKinds(profileId: string, day: string): Promise<Kind[]> {
  const { data, error } = await admin.from('notifications_sent').select('kind').eq('profile_id', profileId).eq('day', day);
  if (error) throw error;
  return (data ?? []).map((r: { kind: string }) => r.kind as Kind);
}

async function dayStats(profile: ProfileRow, day: string): Promise<{ today: DayStat; yesterday?: DayStat }> {
  const yday = prevDay(day);
  const rows: ReviewRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('reviews')
      .select('local_day, duration_ms, closes_queue, goal_min')
      .eq('profile_id', profile.id)
      .in('local_day', [day, yday])
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as ReviewRow[]));
    if (!data || data.length < PAGE) break;
  }
  const stat = (d: string): DayStat | undefined => {
    const rs = rows.filter((r) => r.local_day === d);
    if (!rs.length) return undefined;
    const goals = rs.map((r) => r.goal_min).filter((g): g is number => g != null);
    return {
      minutes: rs.reduce((s, r) => s + r.duration_ms, 0) / 60000,
      queueClosed: rs.some((r) => r.closes_queue),
      goalMin: goals.length ? Math.min(...goals) : profile.daily_goal_min,
    };
  };
  return {
    today: stat(day) ?? { minutes: 0, goalMin: profile.daily_goal_min, queueClosed: false },
    yesterday: stat(yday),
  };
}

/** Claims (profile, day, kind) in notifications_sent; true only if this call inserted the row. */
async function claim(profileId: string, day: string, kind: Kind): Promise<boolean> {
  const { data, error } = await admin
    .from('notifications_sent')
    .upsert({ profile_id: profileId, day, kind }, { onConflict: 'profile_id,day,kind', ignoreDuplicates: true })
    .select('kind');
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Sends to every subscription of the profile; drops endpoints the push service says are gone. Returns deliveries. */
async function deliver(subs: SubRow[], push: Push): Promise<number> {
  let n = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(push),
        { TTL: 3600 },
      );
      n++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      } else {
        console.error('push failed', status, (e as Error).message);
      }
    }
  }
  return n;
}

async function claimAndDeliver(profileId: string, day: string, subs: SubRow[], push: Push): Promise<number> {
  if (!(await claim(profileId, day, push.kind))) return 0;
  return deliver(subs, push);
}

async function loadSubs(profileIds?: string[]): Promise<SubRow[]> {
  let q = admin.from('push_subscriptions').select('endpoint, profile_id, p256dh, auth, tz, updated_at');
  if (profileIds) q = q.in('profile_id', profileIds);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SubRow[];
}

async function runScheduled(): Promise<number> {
  const now = new Date();
  const subs = await loadSubs();
  const byProfile = new Map<string, SubRow[]>();
  for (const s of subs) byProfile.set(s.profile_id, [...(byProfile.get(s.profile_id) ?? []), s]);
  if (!byProfile.size) return 0;

  const { data: profiles, error } = await admin.from('profiles').select(PROFILE_COLS).in('id', [...byProfile.keys()]);
  if (error) throw error;

  let sent = 0;
  for (const p of (profiles ?? []) as ProfileRow[]) {
    try {
      const psubs = byProfile.get(p.id)!;
      const tz = newestTz(psubs);
      const { day } = localClock(now, tz);
      const [{ today, yesterday }, sentToday] = await Promise.all([dayStats(p, day), sentKinds(p.id, day)]);
      for (const push of decideScheduled({ now, tz, prefs: toPrefs(p), today, yesterday, sentToday })) {
        sent += await claimAndDeliver(p.id, day, psubs, push);
      }
    } catch (e) {
      console.error('scheduled failed for profile', p.id, (e as Error).message);
    }
  }
  return sent;
}

async function runPartner(req: Request, body: Record<string, unknown>): Promise<Response> {
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'missing jwt' });
  const { data: auth, error: authErr } = await admin.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
  if (authErr || !auth?.user) return json(401, { error: 'bad jwt' });

  const { kind, from, to, duelBothPlayed } = body;
  if ((kind !== 'duel' && kind !== 'overtake') || typeof from !== 'string' || typeof to !== 'string' || from === to) {
    return json(400, { error: 'bad request' });
  }

  const { data: rows, error } = await admin.from('profiles').select(PROFILE_COLS).in('id', [from, to]);
  if (error) throw error;
  const profiles = (rows ?? []) as ProfileRow[];
  const sender = profiles.find((p) => p.id === from);
  const receiver = profiles.find((p) => p.id === to);
  if (!sender || !receiver || sender.owner_id !== auth.user.id || receiver.owner_id !== auth.user.id) {
    return json(403, { error: 'foreign profile' });
  }

  const subs = await loadSubs([receiver.id]);
  if (!subs.length) return json(200, { sent: 0 });
  const now = new Date();
  const tz = newestTz(subs);
  const { day } = localClock(now, tz);
  const push = decidePartner(kind, {
    now, tz, prefs: toPrefs(receiver), sentToday: await sentKinds(receiver.id, day),
    partnerName: sender.display_name, duelBothPlayed: duelBothPlayed === true,
  });
  if (!push) return json(200, { sent: 0 });
  return json(200, { sent: await claimAndDeliver(receiver.id, day, subs, push) });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'bad json' });
  }

  try {
    if (body.mode === 'scheduled') {
      const secret = req.headers.get('x-cron-secret');
      if (!CRON_SECRET || !secret || !safeEqual(secret, CRON_SECRET)) return json(401, { error: 'bad secret' });
      return json(200, { sent: await runScheduled() });
    }
    if (body.mode === 'partner') return await runPartner(req, body);
    return json(400, { error: 'unknown mode' });
  } catch (e) {
    console.error('notify failed', (e as Error).message);
    return json(500, { error: 'internal' });
  }
});
