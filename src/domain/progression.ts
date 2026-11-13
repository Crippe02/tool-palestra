import type { Exercise, SetLog } from './types';

export function parseKg(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseReps(text: string): number[] {
  return text.split(/\D+/).filter((p) => p !== '').map(Number);
}

const order = (l: SetLog) => l.cycle * 1000 + l.week;

/** Log con kg dello stesso esercizio prima di (cycle, week), dal più recente. */
function earlierWithKg(logs: SetLog[], ex: Exercise, cycle: number, week: number): SetLog[] {
  const limit = cycle * 1000 + week;
  return logs
    .filter((l) => l.day === ex.day && l.exerciseId === ex.id && l.kg != null && order(l) < limit)
    .sort((a, b) => order(b) - order(a));
}

export function previousLoad(logs: SetLog[], ex: Exercise, cycle: number, week: number): { kg: number; source: string } | null {
  const last = earlierWithKg(logs, ex, cycle, week)[0];
  if (last) return { kg: last.kg!, source: last.cycle === cycle ? `S${last.week}` : `C${last.cycle} S${last.week}` };
  return ex.startKg != null ? { kg: ex.startKg, source: 'iniziale' } : null;
}

const fmt = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 2 });

export function suggestLoad(ex: Exercise, logs: SetLog[], cycle: number, week: number): { kg: number | null; reason: string } {
  const last = earlierWithKg(logs, ex, cycle, week)[0];
  if (!last) {
    return ex.startKg != null ? { kg: ex.startKg, reason: 'Carico iniziale' } : { kg: null, reason: 'Scegli il carico di partenza' };
  }
  const reps = parseReps(last.reps);
  if (reps.length >= ex.sets && reps.every((r) => r >= ex.repMax)) {
    const inc = ex.kind === 'compound' ? 2.5 : 1;
    return { kg: last.kg! + inc, reason: `Hai chiuso tutte le serie a ${ex.repMax}: +${fmt(inc)} kg` };
  }
  return { kg: last.kg!, reason: 'Stesso carico, cerca una ripetizione in più' };
}

export function loadDelta(currentKg: number | null, prev: { kg: number } | null): number | null {
  if (currentKg == null || prev == null) return null;
  return Math.round((currentKg - prev.kg) * 100) / 100;
}
