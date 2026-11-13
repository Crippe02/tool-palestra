import type { Exercise, SetLog } from './types';
import { parseKg, parseReps, previousLoad, suggestLoad, loadDelta } from './progression';

const base = { day: 'legs' as const, position: 0, active: true, isNew: false, updatedAt: '1970-01-01T00:00:00Z' };
const hackSquat: Exercise = { ...base, id: 'hs', name: 'Hack squat', sets: 4, repMin: 6, repMax: 8, startKg: 70, kind: 'compound' };
const lateral: Exercise = { ...base, day: 'push', id: 'lat', name: 'Alzate laterali', sets: 4, repMin: 12, repMax: 15, startKg: 14, kind: 'isolation' };
const log = (ex: Exercise, cycle: number, week: number, kg: number | null, reps = ''): SetLog =>
  ({ day: ex.day, exerciseId: ex.id, cycle, week, kg, reps, updatedAt: '2026-11-13T00:00:00Z' });

test('parseKg accetta la virgola e rifiuta il testo', () => {
  expect(parseKg('52,5')).toBe(52.5);
  expect(parseKg('')).toBeNull();
  expect(parseKg('abc')).toBeNull();
});

test('parseReps accetta separatori diversi', () => {
  for (const s of ['8,8,7', '8 8 7', '8-8-7', '8/8/7']) expect(parseReps(s)).toEqual([8, 8, 7]);
  expect(parseReps('8,8,')).toEqual([8, 8]);
  expect(parseReps('')).toEqual([]);
});

test('previousLoad senza log usa il carico iniziale', () => {
  expect(previousLoad([], hackSquat, 1, 1)).toEqual({ kg: 70, source: 'iniziale' });
});

test('previousLoad salta le settimane senza kg', () => {
  const logs = [log(hackSquat, 1, 2, 72.5), log(hackSquat, 1, 3, null)];
  expect(previousLoad(logs, hackSquat, 1, 4)).toEqual({ kg: 72.5, source: 'S2' });
});

test('previousLoad guarda nel ciclo precedente', () => {
  expect(previousLoad([log(hackSquat, 1, 24, 90)], hackSquat, 2, 1)).toEqual({ kg: 90, source: 'C1 S24' });
});

test('suggestLoad aumenta di 2,5 kg sui multiarticolari a fine range', () => {
  const s = suggestLoad(hackSquat, [log(hackSquat, 1, 1, 70, '8,8,8,8')], 1, 2);
  expect(s.kg).toBe(72.5);
  expect(s.reason).toContain('+2,5 kg');
});

test('suggestLoad tiene il carico se mancano serie', () => {
  const s = suggestLoad(hackSquat, [log(hackSquat, 1, 1, 70, '8,8,8')], 1, 2);
  expect(s.kg).toBe(70);
  expect(s.reason).toContain('ripetizione in più');
});

test('suggestLoad aumenta di 1 kg sugli isolamenti', () => {
  expect(suggestLoad(lateral, [log(lateral, 1, 1, 14, '15,15,15,15')], 1, 2).kg).toBe(15);
});

test('suggestLoad senza carico iniziale chiede di sceglierlo', () => {
  expect(suggestLoad({ ...hackSquat, startKg: null }, [], 1, 1)).toEqual({ kg: null, reason: 'Scegli il carico di partenza' });
});

test('lo storico resta agganciato se cambiano nome e schema', () => {
  const renamed = { ...hackSquat, name: 'Pressa', sets: 3, repMin: 8, repMax: 10 };
  expect(previousLoad([log(hackSquat, 1, 2, 75)], renamed, 1, 3)).toEqual({ kg: 75, source: 'S2' });
});

test('loadDelta', () => {
  expect(loadDelta(72.5, { kg: 70 })).toBe(2.5);
  expect(loadDelta(null, { kg: 70 })).toBeNull();
});
