import type { Baseline, BodyLog, Exercise, RunLog, SetLog } from './types';
import { buildDashboard } from './dashboard';
import { formatPercent, formatTime, parseDuration, formatPace } from './format';

const T = '2026-11-13T00:00:00.000Z';
const baseline: Baseline = { date: '2026-11-01', weightKg: 82, waistCm: 88, chestCm: null, armCm: null, thighCm: null };
const body = (date: string, weightKg: number | null, waistCm: number | null = null): BodyLog =>
  ({ date, weightKg, waistCm, chestCm: null, armCm: null, thighCm: null, updatedAt: T });
const ex = (id: string, kind: Exercise['kind'], startKg: number | null): Exercise =>
  ({ day: 'push', id, name: id === 'inc' ? 'Panca inclinata manubri' : 'Alzate laterali', sets: 3, repMin: 6, repMax: 8, startKg, kind, position: 0, active: true, isNew: false, updatedAt: T });
const set = (id: string, week: number, kg: number): SetLog => ({ day: 'push', exerciseId: id, cycle: 1, week, kg, reps: '', updatedAt: T });
const run = (date: string, distanceKm: number, durationS: number, type: RunLog['type'] = 'test'): RunLog =>
  ({ id: date + distanceKm, date, type, distanceKm, durationS, source: 'manual', externalId: null, updatedAt: T });
const empty = { baseline, bodyLogs: [] as BodyLog[], setLogs: [] as SetLog[], exercises: [] as Exercise[], runLogs: [] as RunLog[] };

test('formati italiani', () => {
  expect(formatPercent(-3.17)).toBe('−3,2%');
  expect(formatPercent(12)).toBe('+12%');
  expect(formatTime(1660)).toBe('27:40');
  expect(formatTime(3750)).toBe('1:02:30');
  expect(parseDuration('27:40')).toBe(1660);
  expect(parseDuration('1:02:30')).toBe(3750);
  expect(parseDuration('abc')).toBeNull();
  expect(formatPace(376)).toBe('6:16/km');
});

test('corpo: peso in percentuale, vita in cm', () => {
  const rows = buildDashboard({ ...empty, bodyLogs: [body('2026-11-05', 80.5), body('2026-11-12', 79.4, 84)] });
  const peso = rows.find((r) => r.label === 'Peso')!;
  expect(peso).toMatchObject({ section: 'corpo', from: '82,0 kg', to: '79,4 kg', change: '−3,2%', good: true });
  expect(rows.find((r) => r.label === 'Vita')).toMatchObject({ from: '88 cm', to: '84 cm', change: '−4 cm', good: true });
});

test('forza: solo multiarticolari con carico iniziale', () => {
  const rows = buildDashboard({ ...empty, exercises: [ex('inc', 'compound', 50), ex('lat', 'isolation', 14)], setLogs: [set('inc', 1, 52), set('inc', 3, 56), set('lat', 2, 16)] });
  const forza = rows.filter((r) => r.section === 'forza');
  expect(forza).toHaveLength(1);
  expect(forza[0]).toMatchObject({ label: 'Panca inclinata manubri', from: '50 kg', to: '56 kg', change: '+12%', good: true });
});

test('corsa: confronta il primo e l\'ultimo test della stessa distanza', () => {
  const rows = buildDashboard({ ...empty, runLogs: [run('2026-10-01', 5, 1810), run('2026-11-10', 5, 1660)] });
  expect(rows.find((r) => r.section === 'corsa')).toMatchObject({ label: '5 km', from: '30:10', to: '27:40', change: '−2:30', good: true });
});

test('corsa: mai 5 km contro 10 km', () => {
  const rows = buildDashboard({ ...empty, runLogs: [run('2026-10-01', 5, 1810), run('2026-11-10', 10, 3600)] });
  expect(rows.filter((r) => r.section === 'corsa')).toHaveLength(0);
});

test('righe senza un valore di oggi non compaiono', () => {
  expect(buildDashboard(empty)).toEqual([]);
});
