import type { GymDay, SetLog } from './types';
import { parseKg } from './progression';

export class ImportError extends Error {
  constructor() {
    super('Questo non sembra il file della scheda');
    this.name = 'ImportError';
  }
}

const KEY = /^(push|pull|legs|upper|lower)\.([a-z]+)\.w(\d+)$/;

/** Legge i dati copiati dalla vecchia scheda (artifact "Scheda PPL Upper/Lower"). */
export function parseOldScheda(json: string, now: string): { logs: SetLog[]; week: number; skipped: number } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ImportError();
  }
  const d = data as { log?: unknown; week?: unknown } | null;
  if (!d || typeof d !== 'object' || !d.log || typeof d.log !== 'object') throw new ImportError();

  const logs: SetLog[] = [];
  let skipped = 0;
  for (const [key, value] of Object.entries(d.log as Record<string, { kg?: unknown; reps?: unknown }>)) {
    const m = key.match(KEY);
    if (!m) { skipped++; continue; }
    const kg = parseKg(String(value?.kg ?? ''));
    const reps = String(value?.reps ?? '').trim();
    if (kg == null && reps === '') continue;
    let day = m[1] as GymDay;
    if (day === 'lower' && m[2] === 'rdl') day = 'legs';
    logs.push({ day, exerciseId: m[2], cycle: 1, week: Number(m[3]), kg, reps, updatedAt: now });
  }
  const week = Number(d.week);
  return { logs, week: Number.isInteger(week) && week >= 1 ? week : 1, skipped };
}

const key = (l: SetLog) => `${l.day}|${l.exerciseId}|${l.cycle}|${l.week}`;

/** Solo le righe importate che non esistono già: l'import non sovrascrive mai. */
export function mergeImport(existing: SetLog[], imported: SetLog[]): SetLog[] {
  const have = new Set(existing.map(key));
  return imported.filter((l) => !have.has(key(l)));
}
