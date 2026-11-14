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
  expect(await seedIfEmpty(engine)).toBe(true);
  expect(engine.rows('exercises')).toHaveLength(DEFAULT_PROGRAM.length);
  expect(engine.rows<Profile>('profile')[0]).toMatchObject({ id: 'me', currentCycle: 1, currentWeek: 1, baseline: null });
  expect(await seedIfEmpty(engine)).toBe(false);
  expect(engine.rows('exercises')).toHaveLength(DEFAULT_PROGRAM.length);
});
