import { LocalStore } from './localStore';
import { SyncEngine } from './sync';
import { FakeRemote } from './fakeRemote';
import { seedIfEmpty } from './seed';
import { DEFAULT_PROGRAM } from '../domain/program';
import type { Profile } from '../domain/types';

test('al primo avvio scrive la scheda e il profilo, una volta sola', async () => {
  const remote = new FakeRemote();
  const engine = new SyncEngine(await LocalStore.open('seed-1'), remote, () => true);
  await engine.init();
  const { pulled } = await engine.sync();
  expect(await seedIfEmpty(engine, pulled)).toBe(true);
  expect(engine.rows('exercises')).toHaveLength(DEFAULT_PROGRAM.length);
  expect(engine.rows<Profile>('profile')[0]).toMatchObject({ id: 'me', currentCycle: 1, currentWeek: 1, baseline: null });
  expect(await seedIfEmpty(engine, pulled)).toBe(false);
  expect(engine.rows('exercises')).toHaveLength(DEFAULT_PROGRAM.length);
});

test('se lo scaricamento fallisce non scrive i valori iniziali sopra i dati online', async () => {
  const remote = new FakeRemote();
  remote.seed('profile', [{ id: 'me', currentCycle: 1, currentWeek: 9, baseline: { weightKg: 82 }, updatedAt: '2026-11-01T00:00:00.000Z' }]);
  remote.failPull = true;
  const engine = new SyncEngine(await LocalStore.open('seed-2'), remote, () => true);
  await engine.init();
  const { pulled } = await engine.sync();
  expect(await seedIfEmpty(engine, pulled)).toBe(false);
  expect(engine.rows('exercises')).toHaveLength(0);
  await engine.flush();
  expect(remote.rows('profile')[0]).toMatchObject({ currentWeek: 9 });
});
