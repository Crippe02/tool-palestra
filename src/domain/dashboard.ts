import type { Baseline, BodyLog, Exercise, RunLog, SetLog } from './types';
import { formatNumber, formatPace, formatPercent, formatSigned, formatTime, formatTimeDiff } from './format';
import { tenKTimeS, visibleRuns } from './runPlan';

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

const paceS = (r: RunLog) => Math.round(r.durationS / r.distanceKm);
const km1 = (n: number) => `${formatNumber(n, 1, 1)} km`;

/** Riga di un "migliore" (tempo più basso): dal primo valore al migliore; con un solo valore è "nuovo". */
function bestTimeRow(key: string, label: string, values: number[]): DashboardRow | null {
  if (values.length === 0) return null;
  const best = Math.min(...values);
  if (values.length === 1) return { key, section: 'corsa', label, from: '—', to: formatTime(best), change: 'nuovo', good: null };
  const first = values[0];
  return { key, section: 'corsa', label, from: formatTime(first), to: formatTime(best), change: formatTimeDiff(best - first), good: better(first, best, true) };
}

function runRows(all: RunLog[]): DashboardRow[] {
  const runs = visibleRuns(all);
  if (runs.length === 0) return [];
  const rows: DashboardRow[] = [];
  const first = runs[0];
  const last = runs[runs.length - 1];
  const longest = Math.max(...runs.map((r) => r.distanceKm));
  rows.push({ key: 'corsa:distanza', section: 'corsa', label: 'Distanza più lunga', from: km1(first.distanceKm), to: km1(longest),
    change: formatSigned(Math.round((longest - first.distanceKm) * 10) / 10, 'km'), good: better(first.distanceKm, longest, false) });
  const r5 = bestTimeRow('corsa:5k', 'Migliori 5 km', runs.map((r) => r.best5kS).filter((v): v is number => v != null));
  const r10 = bestTimeRow('corsa:10k', 'Migliori 10 km', runs.map(tenKTimeS).filter((v): v is number => v != null));
  if (r5) rows.push(r5);
  if (r10) rows.push(r10);
  rows.push({ key: 'corsa:passo', section: 'corsa', label: 'Passo medio', from: formatPace(paceS(first)), to: formatPace(paceS(last)),
    change: `${formatTimeDiff(paceS(last) - paceS(first))}/km`, good: better(paceS(first), paceS(last), true) });
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
    const runs = visibleRuns(i.runLogs);
    const pick: Record<string, (r: RunLog) => number | null | undefined> = {
      distanza: (r) => r.distanceKm, '5k': (r) => r.best5kS, '10k': tenKTimeS, passo: paceS,
    };
    const f = pick[a];
    if (!f) return [];
    return runs.flatMap((r) => { const y = f(r); return y == null ? [] : [{ x: r.date, y }]; });
  }
  return [];
}
