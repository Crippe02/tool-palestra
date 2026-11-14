import type { Feeling, RunLog } from './types';
import { nextRun, visibleRuns, tenKTimeS } from './runPlan';

const r = (date: string, km: number, timeS: number, extra: Partial<RunLog> & { feeling?: Feeling | null } = {}): RunLog => ({
  id: `strava-${date}-${km}`, date, type: 'corsa', distanceKm: km, durationS: timeS, source: 'strava', externalId: null,
  updatedAt: '2026-11-14T00:00:00.000Z', startTime: `${date}T08:00:00.000Z`, feeling: 'giusta', ...extra,
});

test('senza corse si parte da 5 km', () => {
  const n = nextRun([], '2026-11-14');
  expect(n).toMatchObject({ phase: 1, distanceKm: 5, last: null, targetTimeS: null });
  expect(n.text).toContain('5 km');
});

test('corsa completata e giusta: +0,5 km', () => {
  const n = nextRun([r('2026-11-01', 5.0, 1800)], '2026-11-08');
  expect(n.distanceKm).toBe(5.5);
  expect(n.last).toMatchObject({ plannedKm: 5, completed: true });
});

test('corsa dura: stessa distanza; senza feeling conta come giusta', () => {
  expect(nextRun([r('2026-11-01', 5.0, 1800, { feeling: 'dura' })], '2026-11-08').distanceKm).toBe(5);
  expect(nextRun([r('2026-11-01', 5.0, 1800, { feeling: null })], '2026-11-08').distanceKm).toBe(5.5);
});

test('distanza non raggiunta: si ripete', () => {
  const n = nextRun([r('2026-11-01', 5.0, 1800), r('2026-11-08', 5.2, 1880)], '2026-11-14');
  expect(n.distanceKm).toBe(5.5);
  expect(n.last).toMatchObject({ plannedKm: 5.5, completed: false });
});

test('arrivati a 10 km si passa al tempo', () => {
  const runs = [r('2026-10-01', 9.5, 3400), r('2026-10-08', 10.0, 3600)];
  // 9,5 km parte da un piano di 5 km: completata → 5,5; poi 10 km → fase 2
  const n = nextRun(runs, '2026-10-15');
  expect(n).toMatchObject({ phase: 2, distanceKm: 10, targetTimeS: 3585 });
  expect(n.text).toContain('59:45');
  expect(n.text).toContain('5:59/km');
});

test('fase 2: obiettivo battuto, non battuto, battuto ma duro', () => {
  const base = [r('2026-10-01', 10.0, 3600)];
  expect(nextRun([...base, r('2026-10-08', 10.0, 3580)], '2026-10-15').targetTimeS).toBe(3565);
  expect(nextRun([...base, r('2026-10-08', 10.0, 3610)], '2026-10-15').targetTimeS).toBe(3585);
  expect(nextRun([...base, r('2026-10-08', 10.0, 3580, { feeling: 'dura' })], '2026-10-15').targetTimeS).toBe(3585);
});

test('dopo una pausa di più di 3 settimane si fa un passo indietro', () => {
  const fase1 = [r('2026-09-17', 6.0, 2200), r('2026-09-24', 6.5, 2400), r('2026-10-01', 7.0, 2600)];
  // piani: 5 → 5,5 → 6 → 6,5: ogni corsa supera il suo piano
  expect(nextRun(fase1, '2026-10-08').distanceKm).toBe(6.5);
  const pausa = nextRun(fase1, '2026-11-14');
  expect(pausa.distanceKm).toBe(5.5);
  const fase2 = [r('2026-09-01', 10.0, 3600)];
  expect(nextRun(fase2, '2026-11-14').targetTimeS).toBe(3585 + 30);
});

test('corse nascoste e corse a mano doppie non contano', () => {
  const runs = [
    r('2026-11-01', 5.0, 1800, { hidden: true }),
    r('2026-11-10', 5.0, 1800),
    { ...r('2026-11-10', 5.1, 1810), id: 'm1', source: 'manual' as const },
    { ...r('2026-11-12', 4.0, 1500), id: 'm2', source: 'manual' as const },
  ];
  expect(visibleRuns(runs).map((x) => x.id)).toEqual(['strava-2026-11-10-5', 'm2']);
});

test('tempo sui 10 km', () => {
  expect(tenKTimeS(r('2026-11-01', 12, 4300, { best10kS: 3500 }))).toBe(3500);
  expect(tenKTimeS(r('2026-11-01', 10.2, 3672))).toBe(3600);
  expect(tenKTimeS(r('2026-11-01', 8, 3000))).toBeNull();
});
