import type { RunLog, RunType } from './types';
import { formatPace } from './format';

// Formule di Jack Daniels (VDOT). v in m/min, t in minuti.
const A = 0.000104;
const B = 0.182258;
const C = -4.6;

export function vdot(distanceKm: number, durationS: number): number {
  const t = durationS / 60;
  const v = (distanceKm * 1000) / t;
  const vo2 = C + B * v + A * v * v;
  const pctMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  return vo2 / pctMax;
}

/** Passo (s/km) alla frazione f del VDOT: risolve VO2 = f·VDOT per v. */
function paceAt(v: number, f: number): number {
  const vo2 = f * v;
  const speed = (-B + Math.sqrt(B * B + 4 * A * (vo2 - C))) / (2 * A);
  return (1000 / speed) * 60;
}

export function trainingPaces(v: number): { easy: number; threshold: number; interval: number } {
  return { easy: paceAt(v, 0.7), threshold: paceAt(v, 0.88), interval: paceAt(v, 0.975) };
}

export interface RunSession { type: RunType; title: string; steps: string[]; distanceKm?: number }

const DAY_MS = 86_400_000;
const byDate = (a: RunLog, b: RunLog) => a.date.localeCompare(b.date);

function testSession(distanceKm: number): RunSession {
  return {
    type: 'test', title: `Test ${distanceKm} km`, distanceKm,
    steps: [
      "10' di corsa facile per scaldarti",
      `${distanceKm} km al massimo che riesci a tenere fino in fondo, cronometrati`,
      "5' di camminata o corsa molto facile",
    ],
  };
}

export function nextRunSession(runs: RunLog[], today: string): RunSession {
  const sorted = [...runs].sort(byDate);
  const tests = sorted.filter((r) => r.type === 'test');
  const lastTest = tests[tests.length - 1];
  if (!lastTest) return testSession(5);

  const days = (Date.parse(today) - Date.parse(lastTest.date)) / DAY_MS;
  if (days >= 35) return testSession(sorted.some((r) => r.distanceKm >= 10) ? 10 : 5);

  const p = trainingPaces(vdot(lastTest.distanceKm, lastTest.durationS));
  const others = sorted.filter((r) => r.type !== 'test');
  const lastType = others[others.length - 1]?.type;
  const count = (t: RunType) => others.filter((r) => r.type === t).length;

  if (lastType === undefined || lastType === 'lungo') {
    const n = Math.min(6, 3 + count('ripetute'));
    return {
      type: 'ripetute', title: 'Ripetute',
      steps: [
        `10' di corsa facile a ${formatPace(p.easy)}`,
        `${n} × 1000 m a ${formatPace(p.interval)}, con 2' di recupero camminando`,
        "5' di corsa facile",
      ],
    };
  }
  if (lastType === 'ripetute') {
    const m = Math.min(30, 15 + 5 * count('ritmo'));
    return {
      type: 'ritmo', title: 'Corsa a ritmo',
      steps: [`10' di corsa facile a ${formatPace(p.easy)}`, `${m}' a ${formatPace(p.threshold)}`, "5' di corsa facile"],
    };
  }
  const lastLungo = others.filter((r) => r.type === 'lungo').pop();
  const km = Math.min(12, Math.max(5, lastLungo ? Math.floor(lastLungo.distanceKm) + 1 : 5));
  return {
    type: 'lungo', title: 'Corsa lunga', distanceKm: km,
    steps: [`${km} km a ${formatPace(p.easy)}, tranquillo: devi riuscire a parlare`],
  };
}
