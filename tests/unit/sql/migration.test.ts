// @vitest-environment node
import { beforeAll, describe, expect, test } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';

// Minimal stand-in for what Supabase provides: auth schema, auth.uid(), anon/authenticated roles.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
let db: PGlite;
let P1: string;
let P2: string;

async function as(uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  await db.exec(uid ? 'set role authenticated' : 'set role anon');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

const card = (id: string, updatedAt: string, stability = 1) => ({
  card_id: id, word_id: id.split(':')[0], direction: 'de_en', fsrs: { stability }, updated_at: updatedAt,
});

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
  }
  await db.exec(`insert into auth.users values ('${U1}'), ('${U2}')`);
  P1 = (await db.query<{ id: string }>(`insert into profiles (owner_id, display_name) values ('${U1}', 'Nikola') returning id`)).rows[0].id;
  P2 = (await db.query<{ id: string }>(`insert into profiles (owner_id, display_name) values ('${U2}', 'Obcy') returning id`)).rows[0].id;
});

describe('0001_init.sql', () => {
  test('owner sees only own profiles; anon sees nothing', async () => {
    expect((await as(U1, 'select display_name from profiles')).rows).toEqual([{ display_name: 'Nikola' }]);
    await expect(as(null, 'select * from profiles')).rejects.toThrow(/permission denied/);
  });

  test('profiles cannot be deleted or re-owned by the app', async () => {
    await expect(as(U1, `delete from profiles where id = $1`, [P1])).rejects.toThrow(/permission denied/);
    await expect(as(U1, `update profiles set owner_id = $1 where id = $2`, [U2, P1])).rejects.toThrow();
    await as(U1, `update profiles set new_per_day = 12 where id = $1`, [P1]);
    expect((await db.query<{ new_per_day: number }>(`select new_per_day from profiles where id = $1`, [P1])).rows[0].new_per_day).toBe(12);
  });

  test('upsert_cards: last write wins and duplicates in one batch collapse to the newest', async () => {
    const c = (u: string, s: number) => JSON.stringify([card('a:de_en', u, s)]);
    await as(U1, `select upsert_cards($1, $2::jsonb)`, [P1, c('2026-11-16T10:00:00Z', 1)]);
    await as(U1, `select upsert_cards($1, $2::jsonb)`, [P1, c('2026-11-16T09:00:00Z', 9)]); // older: ignored
    await as(U1, `select upsert_cards($1, $2::jsonb)`, [
      P1,
      JSON.stringify([card('a:de_en', '2026-11-16T11:00:00Z', 2), card('a:de_en', '2026-11-16T12:00:00Z', 3)]),
    ]);
    const r = await as(U1, `select fsrs->>'stability' as s, server_seq from user_cards where card_id = 'a:de_en'`);
    expect(r.rows).toHaveLength(1);
    expect((r.rows[0] as { s: string }).s).toBe('3');
  });

  test('server_seq grows on every accepted update', async () => {
    const seq = async () => Number(((await as(U1, `select server_seq from user_cards where card_id = 'b:de_en'`)).rows[0] as { server_seq: number }).server_seq);
    await as(U1, `select upsert_cards($1, $2::jsonb)`, [P1, JSON.stringify([card('b:de_en', '2026-11-16T10:00:00Z')])]);
    const s1 = await seq();
    await as(U1, `select upsert_cards($1, $2::jsonb)`, [P1, JSON.stringify([card('b:de_en', '2026-11-16T11:00:00Z')])]);
    expect(await seq()).toBeGreaterThan(s1);
  });

  test("cannot write cards or reviews into someone else's profile", async () => {
    await expect(as(U1, `select upsert_cards($1, $2::jsonb)`, [P2, JSON.stringify([card('x:de_en', '2026-11-16T10:00:00Z')])])).rejects.toThrow(/row-level security/);
    await expect(
      as(U1, `insert into reviews (id, profile_id, card_id, rating, duration_ms, reviewed_at, local_day, was_new) values (gen_random_uuid(), $1, 'x:de_en', 3, 1, now(), '2026-11-16', true)`, [P2]),
    ).rejects.toThrow(/row-level security/);
  });

  test('reviews: insert + select for owner, no update/delete, duplicate ids ignored', async () => {
    const id = '33333333-3333-4333-8333-333333333333';
    const ins = `insert into reviews (id, profile_id, card_id, rating, duration_ms, reviewed_at, local_day, was_new, closes_queue)
                 values ($1, $2, 'a:de_en', 3, 1000, now(), '2026-11-16', true, true) on conflict (id) do nothing`;
    await as(U1, ins, [id, P1]);
    await as(U1, ins, [id, P1]);
    expect((await as(U1, `select count(*)::int as n from reviews where id = $1`, [id])).rows[0]).toEqual({ n: 1 });
    await expect(as(U1, `update reviews set rating = 1 where id = $1`, [id])).rejects.toThrow(/permission denied/);
    await expect(as(U1, `delete from reviews where id = $1`, [id])).rejects.toThrow(/permission denied/);
    expect((await as(U2, `select count(*)::int as n from reviews`)).rows[0]).toEqual({ n: 0 });
  });

  test('clients cannot choose server_seq of reviews', async () => {
    await expect(
      as(U1, `insert into reviews (id, profile_id, card_id, rating, duration_ms, reviewed_at, local_day, was_new, server_seq) values (gen_random_uuid(), $1, 'a', 3, 1, now(), '2026-11-16', true, 999999)`, [P1]),
    ).rejects.toThrow();
  });

  test('changed_at is set by the server clock on insert and bumped on update', async () => {
    const at = async () => ((await as(U1, `select changed_at from user_cards where card_id = 'c:de_en'`)).rows[0] as { changed_at: Date }).changed_at;
    await as(U1, `select upsert_cards($1, $2::jsonb)`, [P1, JSON.stringify([card('c:de_en', '2026-11-16T10:00:00Z')])]);
    const t1 = await at();
    await new Promise((r) => setTimeout(r, 5));
    await as(U1, `select upsert_cards($1, $2::jsonb)`, [P1, JSON.stringify([card('c:de_en', '2026-11-16T11:00:00Z')])]);
    expect((await at()).getTime()).toBeGreaterThan(t1.getTime());
    const r = await as(U1, `select changed_at from reviews limit 1`);
    expect(r.rows.length === 0 || (r.rows[0] as { changed_at: Date }).changed_at instanceof Date).toBe(true);
  });

  test('0002: reviews store the daily goal snapshot', async () => {
    const id = '44444444-4444-4444-8444-444444444444';
    await as(U1, `insert into reviews (id, profile_id, card_id, rating, duration_ms, reviewed_at, local_day, was_new, goal_min)
                  values ($1, $2, 'a:de_en', 3, 1, now(), '2026-11-16', false, 20)`, [id, P1]);
    expect((await as(U1, `select goal_min from reviews where id = $1`, [id])).rows[0]).toEqual({ goal_min: 20 });
  });

  test('0003: game_sessions are append-only and private to the owner', async () => {
    const id = '55555555-5555-4555-8555-555555555555';
    const ins = `insert into game_sessions (id, profile_id, level, seed, won, stars, moves, par, peeks, peeked_word_ids, duration_ms, played_at, local_day)
                 values ($1, $2, 'berlin-1', 7, true, 3, 20, 18, 1, '{hallo}', 60000, now(), '2026-11-16') on conflict (id) do nothing`;
    await as(U1, ins, [id, P1]);
    await as(U1, ins, [id, P1]);
    expect((await as(U1, `select count(*)::int as n, max(stars) as s from game_sessions`)).rows[0]).toEqual({ n: 1, s: 3 });
    expect((await as(U2, `select count(*)::int as n from game_sessions`)).rows[0]).toEqual({ n: 0 });
    await expect(as(U1, `update game_sessions set stars = 1 where id = $1`, [id])).rejects.toThrow(/permission denied/);
    await expect(as(U1, ins.replace(' on conflict (id) do nothing', ''), ['66666666-6666-4666-8666-666666666666', P2])).rejects.toThrow(/row-level security/);
  });

  test('0004: game_sessions store the duel day', async () => {
    const id = '77777777-7777-4777-8777-777777777777';
    await as(U1, `insert into game_sessions (id, profile_id, level, seed, won, stars, moves, par, peeks, duration_ms, played_at, local_day, duel_day)
                  values ($1, $2, 'berlin-2', 9, true, 2, 30, 20, 0, 1000, now(), '2026-11-16', '2026-11-16')`, [id, P1]);
    const r = (await as(U1, `select to_char(duel_day, 'YYYY-MM-DD') as d from game_sessions where id = $1`, [id])).rows[0];
    expect(r).toEqual({ d: '2026-11-16' });
  });
});

describe('0005_notifications.sql', () => {
  const sub = (ep: string, pid: string) => [ep, pid, 'p256', 'authkey'];
  const ins = `insert into push_subscriptions (endpoint, profile_id, p256dh, auth) values ($1, $2, $3, $4)`;

  test('owner can insert a subscription for own profile; another user cannot', async () => {
    await as(U1, ins, sub('https://push/a', P1));
    await expect(as(U2, ins, sub('https://push/b', P1))).rejects.toThrow(/row-level security/);
    expect((await as(U1, `select endpoint, tz from push_subscriptions`)).rows).toEqual([{ endpoint: 'https://push/a', tz: 'Europe/Warsaw' }]);
    expect((await as(U2, `select endpoint from push_subscriptions`)).rows).toEqual([]);
  });

  test('upsert on endpoint moves the subscription to another profile of the same owner', async () => {
    const P1b = (await db.query<{ id: string }>(`insert into profiles (owner_id, display_name) values ('${U1}', 'Marcin') returning id`)).rows[0].id;
    await as(U1, `${ins} on conflict (endpoint) do update set profile_id = excluded.profile_id`, sub('https://push/a', P1b));
    expect((await as(U1, `select profile_id from push_subscriptions where endpoint = 'https://push/a'`)).rows).toEqual([{ profile_id: P1b }]);
  });

  test('owner can delete own subscription', async () => {
    await as(U1, `delete from push_subscriptions where endpoint = 'https://push/a'`);
    expect((await as(U1, `select 1 from push_subscriptions`)).rows).toEqual([]);
  });

  test('authenticated cannot read notifications_sent', async () => {
    await expect(as(U1, `select * from notifications_sent`)).rejects.toThrow(/permission denied/);
    await expect(as(U1, `insert into notifications_sent (profile_id, day, kind) values ($1, '2026-11-16', 'goal')`, [P1])).rejects.toThrow(/permission denied/);
  });

  test('notify_goal_hour must be 6..22; defaults per spec', async () => {
    await expect(as(U1, `update profiles set notify_goal_hour = 23 where id = $1`, [P1])).rejects.toThrow(/check/);
    expect((await as(U1, `select notify_goal, notify_goal_hour, notify_streak, notify_partner from profiles where id = $1`, [P1])).rows)
      .toEqual([{ notify_goal: true, notify_goal_hour: 19, notify_streak: true, notify_partner: true }]);
  });
});
