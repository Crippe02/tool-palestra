import { parseOldScheda, mergeImport, ImportError } from './importScheda';
import type { SetLog } from './types';

const NOW = '2026-11-13T12:00:00.000Z';
const parse = (log: object, week?: number) => parseOldScheda(JSON.stringify({ log, week }), NOW);

test('legge una voce della scheda e la settimana', () => {
  const r = parse({ 'push.inc.w3': { kg: '52.5', reps: '8,8,7' } }, 4);
  expect(r.week).toBe(4);
  expect(r.logs).toEqual([{ day: 'push', exerciseId: 'inc', cycle: 1, week: 3, kg: 52.5, reps: '8,8,7', updatedAt: NOW }]);
});

test('lo stacco rumeno del Lower passa a Legs, il resto del Lower resta storico', () => {
  const r = parse({ 'lower.rdl.w2': { kg: '60' }, 'lower.bss.w2': { kg: '20' } });
  expect(r.logs.find((l) => l.exerciseId === 'rdl')!.day).toBe('legs');
  expect(r.logs.find((l) => l.exerciseId === 'bss')!.day).toBe('lower');
});

test('salta le voci vuote e conta quelle non riconosciute', () => {
  const r = parse({ 'push.chp.w1': { kg: '', reps: '' }, 'foo.w1': {} });
  expect(r.logs).toHaveLength(0);
  expect(r.skipped).toBe(1);
});

test('voce con sole ripetizioni ha kg null', () => {
  expect(parse({ 'pull.lm.w1': { reps: '10,10,9' } }).logs[0].kg).toBeNull();
});

test('settimana assente vale 1', () => {
  expect(parse({}).week).toBe(1);
});

test('testo non valido lancia ImportError', () => {
  expect(() => parseOldScheda('ciao', NOW)).toThrow(ImportError);
  expect(() => parseOldScheda('{"a":1}', NOW)).toThrow('Questo non sembra il file della scheda');
});

test('mergeImport non sovrascrive i dati già presenti', () => {
  const l = (week: number, kg: number): SetLog => ({ day: 'push', exerciseId: 'inc', cycle: 1, week, kg, reps: '', updatedAt: NOW });
  expect(mergeImport([l(3, 55)], [l(3, 52.5), l(4, 57.5)])).toEqual([l(4, 57.5)]);
});
