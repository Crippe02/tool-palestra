import type { RunLog } from './types';
import { vdot, trainingPaces, nextRunSession } from './running';

const run = (date: string, type: RunLog['type'], distanceKm: number, durationS: number): RunLog =>
  ({ id: date, date, type, distanceKm, durationS, source: 'manual', externalId: null, updatedAt: '2026-11-13T00:00:00.000Z' });

test('VDOT di un 5 km in 30 minuti', () => {
  expect(vdot(5, 1800)).toBeCloseTo(30.8, 0);
});

test('andature di allenamento da un 5 km in 30 minuti', () => {
  const p = trainingPaces(vdot(5, 1800));
  expect(p.threshold).toBeGreaterThanOrEqual(370);
  expect(p.threshold).toBeLessThanOrEqual(382);
  expect(p.interval).toBeGreaterThanOrEqual(340);
  expect(p.interval).toBeLessThanOrEqual(354);
  expect(p.easy).toBeGreaterThanOrEqual(440);
  expect(p.easy).toBeLessThanOrEqual(460);
});

test('senza corse si parte con il test sui 5 km', () => {
  expect(nextRunSession([], '2026-11-20')).toMatchObject({ type: 'test', distanceKm: 5 });
});

test('dopo il test vengono le ripetute', () => {
  const s = nextRunSession([run('2026-11-20', 'test', 5, 1800)], '2026-11-27');
  expect(s.type).toBe('ripetute');
  expect(s.steps.join(' ')).toContain('3 × 1000 m');
});

test('rotazione ripetute → ritmo → lungo', () => {
  const runs = [run('2026-11-01', 'test', 5, 1800), run('2026-11-03', 'ripetute', 6, 2400)];
  expect(nextRunSession(runs, '2026-11-08').type).toBe('ritmo');
  expect(nextRunSession([...runs, run('2026-11-06', 'ritmo', 7, 2700)], '2026-11-08').type).toBe('lungo');
});

test('test vecchio di più di 35 giorni e una corsa da 10 km: test sui 10 km', () => {
  const runs = [run('2026-10-01', 'test', 5, 1800), run('2026-10-20', 'lungo', 10, 4500)];
  expect(nextRunSession(runs, '2026-11-13')).toMatchObject({ type: 'test', distanceKm: 10 });
});

test('il lungo cresce di 1 km fino a 12', () => {
  const base = [run('2026-11-01', 'test', 5, 1800)];
  const after = (lungoKm: number) => nextRunSession(
    [...base, run('2026-11-02', 'lungo', lungoKm, 4000), run('2026-11-04', 'ripetute', 6, 2400), run('2026-11-06', 'ritmo', 7, 2700)],
    '2026-11-08',
  );
  expect(after(11.5).distanceKm).toBe(12);
  expect(after(12).distanceKm).toBe(12);
  expect(after(6).distanceKm).toBe(7);
});
