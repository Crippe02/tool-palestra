import type { RunLog } from './types';
import { formatNumber, formatPace, formatTime } from './format';

const DAY_MS = 86_400_000;
const START_KM = 5;
const GOAL_KM = 10;
const STEP_KM = 0.5;
const TOLERANCE_KM = 0.1;
const FASTER_S = 15;
const BREAK_DAYS = 21;
const BREAK_BACK_KM = 1;
const BREAK_BACK_S = 30;
/** Sotto mezzo km la corsa non conta (tapis roulant senza sensore, GPS spento): darebbe passi assurdi. */
const MIN_KM = 0.5;

const when = (r: RunLog) => r.startTime ?? `${r.date}T00:00:00.000Z`;

/** Corse che contano: senza le nascoste e senza le corse a mano dello stesso giorno di una corsa Strava. */
export function visibleRuns(runs: RunLog[]): RunLog[] {
  const stravaDays = new Set(runs.filter((r) => r.source === 'strava' && !r.hidden).map((r) => r.date));
  return runs
    .filter((r) => !r.hidden && r.distanceKm >= MIN_KM && !(r.source === 'manual' && stravaDays.has(r.date)))
    .sort((a, b) => when(a).localeCompare(when(b)));
}

/** Tempo sui 10 km: il best effort di Strava, oppure il tempo totale se la corsa è di circa 10 km. */
export function tenKTimeS(r: RunLog): number | null {
  if (r.best10kS != null) return r.best10kS;
  if (r.distanceKm >= 9.9 && r.distanceKm <= 10.5) return Math.round((r.durationS * 10) / r.distanceKm);
  return null;
}

export interface NextRun {
  phase: 1 | 2;
  distanceKm: number;
  targetTimeS: number | null;
  text: string;
  last: { run: RunLog; plannedKm: number; targetTimeS: number | null; completed: boolean } | null;
}

interface State { phase: 1 | 2; plannedKm: number; target: number | null }

const days = (fromIso: string, toIso: string) => (Date.parse(toIso) - Date.parse(fromIso)) / DAY_MS;

/** Dopo una pausa lunga si riparte un po' più piano. */
function stepBack(s: State): State {
  return s.phase === 1 ? { ...s, plannedKm: Math.max(START_KM, s.plannedKm - BREAK_BACK_KM) } : { ...s, target: (s.target ?? 0) + BREAK_BACK_S };
}

export function nextRun(runs: RunLog[], today: string): NextRun {
  let s: State = { phase: 1, plannedKm: START_KM, target: null };
  let last: NextRun['last'] = null;
  let prev: RunLog | null = null;

  for (const r of visibleRuns(runs)) {
    if (prev && days(prev.date, r.date) > BREAK_DAYS) s = stepBack(s);
    const easyEnough = r.feeling !== 'dura';
    if (s.phase === 1) {
      const completed = r.distanceKm >= s.plannedKm - TOLERANCE_KM;
      last = { run: r, plannedKm: s.plannedKm, targetTimeS: null, completed };
      const ref = r.distanceKm >= GOAL_KM - TOLERANCE_KM ? tenKTimeS(r) : null;
      if (ref != null) s = { phase: 2, plannedKm: GOAL_KM, target: ref - (easyEnough ? FASTER_S : 0) };
      else if (completed && easyEnough) s = { ...s, plannedKm: Math.min(GOAL_KM, s.plannedKm + STEP_KM) };
    } else {
      const t = tenKTimeS(r);
      const completed = t != null && s.target != null && t <= s.target;
      last = { run: r, plannedKm: GOAL_KM, targetTimeS: s.target, completed };
      if (completed && easyEnough) s = { ...s, target: t! - FASTER_S };
    }
    prev = r;
  }
  if (prev && days(prev.date, today) > BREAK_DAYS) s = stepBack(s);

  const text = s.phase === 1
    ? `${formatNumber(s.plannedKm)} km, passo tranquillo: devi riuscire a parlare`
    : `10 km in meno di ${formatTime(s.target!)} (${formatPace(s.target! / GOAL_KM)})`;
  return { phase: s.phase, distanceKm: s.plannedKm, targetTimeS: s.target, text, last };
}
