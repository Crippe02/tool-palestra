import type { Baseline, BodyLog, Exercise, RunLog, SetLog } from './types';
import { buildDashboard, seriesFor } from './dashboard';
import { formatPercent, formatTime, parseDuration, formatPace } from './format';

const T = '2026-11-13T00:00:00.000Z';
const baseline: Baseline = { date: '2026-11-01', weightKg: 82, waistCm: 88, chestCm: null, armCm: null, thighCm: null };
const body = (date: string, weightKg: number | null, waistCm: number | null = null): BodyLog =>
  ({ date, weightKg, waistCm, chestCm: null, armCm: null, thighCm: null, updatedAt: T });
const ex = (id: string, kind: Exercise['kind'], startKg: number | null): Exercise =>
  ({ day: 'push', id, name: id === 'inc' ? 'Panca inclinata manubri' : 'Alzate laterali', sets: 3, repMin: 6, repMax: 8, startKg, kind, position: 0, active: true, isNew: false, updatedAt: T });
const set = (id: string, week: number, kg: number): SetLog => ({ day: 'push', exerciseId: id, cycle: 1, week, kg, reps: '', updatedAt: T });
const run = (date: string, distanceKm: number, durationS: number, extra: Partial<RunLog> = {}): RunLog =>
  ({ id: date + distanceKm, date, type: 'corsa', distanceKm, durationS, source: 'strava', externalId: null, updatedAt: T, ...extra });
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

test('corsa: distanza più lunga, migliori 5 km e passo medio', () => {
  const rows = buildDashboard({ ...empty, runLogs: [run('2026-10-01', 5.0, 1810, { best5kS: 1810 }), run('2026-11-10', 8.2, 2952, { best5kS: 1660 })] });
  const by = (label: string) => rows.find((r) => r.section === 'corsa' && r.label === label);
  expect(by('Distanza più lunga')).toMatchObject({ from: '5,0 km', to: '8,2 km', change: '+3,2 km', good: true });
  expect(by('Migliori 5 km')).toMatchObject({ from: '30:10', to: '27:40', change: '−2:30', good: true });
  expect(by('Passo medio')).toMatchObject({ from: '6:02/km', to: '6:00/km', change: '−0:02/km', good: true });
  expect(by('Migliori 10 km')).toBeUndefined();
});

test('corsa: il primo 10 km compare come nuovo', () => {
  const rows = buildDashboard({ ...empty, runLogs: [run('2026-10-01', 5, 1810), run('2026-11-10', 10, 3600)] });
  expect(rows.find((r) => r.label === 'Migliori 10 km')).toMatchObject({ from: '—', to: '1:00:00', change: 'nuovo', good: null });
});

test('corsa: le corse nascoste non contano', () => {
  const rows = buildDashboard({ ...empty, runLogs: [run('2026-10-01', 5, 1810), run('2026-11-10', 15, 4000, { hidden: true })] });
  expect(rows.find((r) => r.label === 'Distanza più lunga')).toMatchObject({ to: '5,0 km' });
});

test('serie storica di una riga: dal punto di partenza a oggi', () => {
  const input = { ...empty, bodyLogs: [body('2026-11-12', 79.4), body('2026-11-05', 80.5)] };
  const peso = buildDashboard(input).find((r) => r.label === 'Peso')!;
  expect(peso.key).toBe('corpo:weightKg');
  expect(seriesFor(peso.key, input)).toEqual([
    { x: '2026-11-01', y: 82 }, { x: '2026-11-05', y: 80.5 }, { x: '2026-11-12', y: 79.4 },
  ]);
  const runs = { ...empty, runLogs: [run('2026-11-10', 6, 2100), run('2026-10-01', 5, 1810)] };
  expect(seriesFor('corsa:distanza', runs)).toEqual([{ x: '2026-10-01', y: 5 }, { x: '2026-11-10', y: 6 }]);
  expect(seriesFor('corsa:passo', runs)).toEqual([{ x: '2026-10-01', y: 362 }, { x: '2026-11-10', y: 350 }]);
});

test('righe senza un valore di oggi non compaiono', () => {
  expect(buildDashboard(empty)).toEqual([]);
});

test('corsa: i 5 km valgono anche da una corsa di circa 5 km senza best effort', () => {
  const rows = buildDashboard({ ...empty, runLogs: [run('2026-10-01', 5.2, 1820), run('2026-11-10', 5.0, 1700)] });
  expect(rows.find((r) => r.label === 'Migliori 5 km')).toMatchObject({ from: '29:10', to: '28:20', change: '−0:50' });
});
