import { LocalStore, rowKey } from './localStore';
import { SyncEngine } from './sync';
import { FakeRemote } from './fakeRemote';
import { toRemote, fromRemote } from './supabaseRemote';
import type { SetLog } from '../domain/types';

let n = 0;
const dbName = () => `test-${++n}`;
const log = (week: number, kg: number, updatedAt = '2026-11-01T00:00:00.000Z'): SetLog =>
  ({ day: 'push', exerciseId: 'inc', cycle: 1, week, kg, reps: '8,8,8', updatedAt });

async function setup(online = true) {
  const local = await LocalStore.open(dbName());
  const remote = new FakeRemote();
  let isOnline = online;
  const engine = new SyncEngine(local, remote, () => isOnline);
  await engine.init();
  return { local, remote, engine, goOnline: () => { isOnline = true; remote.offline = false; } };
}

test('rowKey dei set_logs', () => {
  expect(rowKey('set_logs', { day: 'push', exerciseId: 'inc', cycle: 1, week: 3 })).toBe('push|inc|1|3');
  expect(rowKey('profile', { id: 'me' })).toBe('me');
});

test('scrittura offline resta in coda e parte al ritorno della rete', async () => {
  const { remote, engine, goOnline } = await setup(false);
  remote.offline = true;
  await engine.write('set_logs', log(1, 50));
  expect(await engine.pendingCount()).toBe(1);
  expect(remote.rows('set_logs')).toHaveLength(0);
  goOnline();
  expect(await engine.flush()).toEqual({ sent: 1 });
  expect(await engine.pendingCount()).toBe(0);
  expect(remote.rows('set_logs')).toHaveLength(1);
});

test('se il remoto fallisce la coda non si perde', async () => {
  const { remote, engine } = await setup(true);
  remote.offline = true;
  await engine.write('set_logs', log(1, 50));
  expect(await engine.flush()).toEqual({ sent: 0 });
  expect(await engine.pendingCount()).toBe(1);
});

test('la coda sopravvive alla chiusura dell\'app', async () => {
  const name = dbName();
  const local = await LocalStore.open(name);
  const engine = new SyncEngine(local, new FakeRemote(), () => false);
  await engine.init();
  await engine.write('set_logs', log(2, 52.5));
  local.close();
  const reopened = await LocalStore.open(name);
  const pending = await reopened.pending();
  expect(pending).toHaveLength(1);
  expect(pending[0].row).toMatchObject({ week: 2, kg: 52.5 });
});

test('telefono vuoto: pull riscarica tutto dal remoto', async () => {
  const { local, remote, engine } = await setup(true);
  remote.seed('set_logs', [log(1, 50), log(2, 52.5), log(3, 55)]);
  await engine.pull();
  expect(await local.all('set_logs')).toHaveLength(3);
  expect(engine.rows('set_logs')).toHaveLength(3);
});

test('pull non sovrascrive una modifica locale ancora in coda', async () => {
  const { local, remote, engine } = await setup(false);
  await engine.write('set_logs', log(1, 80));
  remote.seed('set_logs', [log(1, 75, '2099-01-01T00:00:00.000Z')]);
  await engine.pull();
  const rows = await local.all<SetLog>('set_logs');
  expect(rows[0].kg).toBe(80);
});

test('pull sostituisce una riga locale più vecchia', async () => {
  const { local, remote, engine } = await setup(true);
  await local.put('set_logs', log(1, 70, '2026-01-01T00:00:00.000Z'));
  remote.seed('set_logs', [log(1, 75, '2026-02-01T00:00:00.000Z')]);
  await engine.pull();
  expect((await local.all<SetLog>('set_logs'))[0].kg).toBe(75);
});

test('una modifica fatta durante l\'invio resta in coda', async () => {
  const { remote, engine } = await setup(true);
  remote.offline = true;
  await engine.write('set_logs', log(1, 50));
  remote.offline = false;
  const realUpsert = remote.upsert.bind(remote);
  remote.upsert = async (t, rows) => { await engine.write('set_logs', log(1, 55)); return realUpsert(t, rows); };
  await engine.flush();
  expect(await engine.pendingCount()).toBe(1);
});

test('conversione verso e da Supabase', () => {
  const remote = toRemote('set_logs', log(3, 52.5));
  expect(remote).toEqual({ day: 'push', exercise_id: 'inc', cycle: 1, week: 3, kg: 52.5, reps: '8,8,8', updated_at: '2026-11-01T00:00:00.000Z' });
  const back = fromRemote('set_logs', { ...remote, user_id: 'u1', kg: '52.5', updated_at: '2026-11-01T00:00:00+00:00' });
  expect(back).toEqual(log(3, 52.5));
  const profile = fromRemote('profile', { user_id: 'u1', id: 'me', current_cycle: 1, current_week: 4, baseline: { weightKg: 82 }, updated_at: '2026-11-01T00:00:00+00:00' });
  expect(profile).toEqual({ id: 'me', currentCycle: 1, currentWeek: 4, baseline: { weightKg: 82 }, updatedAt: '2026-11-01T00:00:00.000Z' });
});
