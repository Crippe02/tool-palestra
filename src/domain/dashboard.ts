import type { Baseline, BodyLog, Exercise, RunLog, SetLog } from './types';
import { formatNumber, formatPercent, formatSigned, formatTime, formatTimeDiff } from './format';

export interface DashboardRow {
  key: string;
  section: 'corpo' | 'forza' | 'corsa';
  label: string;
  from: string;
  to: string;
  change: string;
  good: boolean | null;
}

type BodyField = 'weightKg' | 'waistCm' | 'chestCm' | 'armCm' | 'thighCm';

const BODY: { field: BodyField; label: string; lowerIsBetter: boolean }[] = [
  { field: 'weightKg', label: 'Peso', lowerIsBetter: true },
  { field: 'waistCm', label: 'Vita', lowerIsBetter: true },
  { field: 'chestCm', label: 'Petto', lowerIsBetter: false },
  { field: 'armCm', label: 'Braccio', lowerIsBetter: false },
  { field: 'thighCm', label: 'Coscia', lowerIsBetter: false },
];

/** true se è migliorato, false se è peggiorato, null se uguale. */
function better(from: number, to: number, lowerIsBetter: boolean): boolean | null {
  if (to === from) return null;
  return lowerIsBetter ? to < from : to > from;
}

function bodyRows(baseline: Baseline | null, logs: BodyLog[]): DashboardRow[] {
  if (!baseline) return [];
  const byDate = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const rows: DashboardRow[] = [];
  for (const { field, label, lowerIsBetter } of BODY) {
    const from = baseline[field];
    const to = [...byDate].reverse().find((l) => l[field] != null)?.[field];
    if (from == null || to == null) continue;
    if (field === 'weightKg') {
      rows.push({ key: `corpo:${field}`, section: 'corpo', label, from: `${formatNumber(from, 1, 1)} kg`, to: `${formatNumber(to, 1, 1)} kg`,
        change: formatPercent(((to - from) / from) * 100), good: better(from, to, lowerIsBetter) });
    } else {
      rows.push({ key: `corpo:${field}`, section: 'corpo', label, from: `${formatNumber(from)} cm`, to: `${formatNumber(to)} cm`,
        change: formatSigned(Math.round((to - from) * 10) / 10, 'cm'), good: field === 'waistCm' ? better(from, to, true) : null });
    }
  }
  return rows;
}

function strengthRows(exercises: Exercise[], logs: SetLog[]): DashboardRow[] {
  const rows: DashboardRow[] = [];
  const active = exercises.filter((e) => e.active && e.kind === 'compound' && e.startKg != null)
    .sort((a, b) => a.day.localeCompare(b.day) || a.position - b.position);
  for (const ex of active) {
    const last = logs
      .filter((l) => l.day === ex.day && l.exerciseId === ex.id && l.kg != null)
      .sort((a, b) => b.cycle - a.cycle || b.week - a.week)[0];
    if (!last) continue;
    const from = ex.startKg!;
    const to = last.kg!;
    rows.push({ key: `forza:${ex.day}:${ex.id}`, section: 'forza', label: ex.name, from: `${formatNumber(from, 2)} kg`, to: `${formatNumber(to, 2)} kg`,
      change: formatPercent(((to - from) / from) * 100), good: better(from, to, false) });
  }
  return rows;
}

function runRows(runs: RunLog[]): DashboardRow[] {
  const tests = runs.filter((r) => r.type === 'test').sort((a, b) => a.date.localeCompare(b.date));
  const distances = [...new Set(tests.map((t) => t.distanceKm))].sort((a, b) => a - b);
  const rows: DashboardRow[] = [];
  for (const d of distances) {
    const same = tests.filter((t) => t.distanceKm === d);
    if (same.length < 2) continue;
    const first = same[0];
    const last = same[same.length - 1];
    rows.push({ key: `corsa:${d}`, section: 'corsa', label: `${formatNumber(d)} km`, from: formatTime(first.durationS), to: formatTime(last.durationS),
      change: formatTimeDiff(last.durationS - first.durationS), good: better(first.durationS, last.durationS, true) });
  }
  return rows;
}

export function buildDashboard(i: {
  baseline: Baseline | null; bodyLogs: BodyLog[]; setLogs: SetLog[]; exercises: Exercise[]; runLogs: RunLog[];
}): DashboardRow[] {
  return [...bodyRows(i.baseline, i.bodyLogs), ...strengthRows(i.exercises, i.setLogs), ...runRows(i.runLogs)];
}

export interface SeriesPoint { x: string; y: number }

type DashboardInput = Parameters<typeof buildDashboard>[0];

/** Valori nel tempo di una riga del cruscotto (per il grafico). */
export function seriesFor(key: string, i: DashboardInput): SeriesPoint[] {
  const [section, a, b] = key.split(':');
  if (section === 'corpo') {
    const field = a as BodyField;
    const start = i.baseline?.[field];
    const points = [...i.bodyLogs].filter((l) => l[field] != null).sort((x, y) => x.date.localeCompare(y.date))
      .map((l) => ({ x: l.date, y: l[field]! }));
    return start != null && i.baseline ? [{ x: i.baseline.date, y: start }, ...points] : points;
  }
  if (section === 'forza') {
    const ex = i.exercises.find((e) => e.day === a && e.id === b);
    const points = i.setLogs.filter((l) => l.day === a && l.exerciseId === b && l.kg != null)
      .sort((x, y) => x.cycle - y.cycle || x.week - y.week)
      .map((l) => ({ x: l.cycle > 1 ? `C${l.cycle} S${l.week}` : `S${l.week}`, y: l.kg! }));
    return ex?.startKg != null ? [{ x: 'inizio', y: ex.startKg }, ...points] : points;
  }
  if (section === 'corsa') {
    const d = Number(a);
    return i.runLogs.filter((r) => r.type === 'test' && r.distanceKm === d).sort((x, y) => x.date.localeCompare(y.date))
      .map((r) => ({ x: r.date, y: r.durationS }));
  }
  return [];
}
