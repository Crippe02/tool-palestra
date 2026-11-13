import type { Exercise, ExerciseKind, GymDay } from './types';

export function parseScheme(s: string): { sets: number; repMin: number; repMax: number } {
  const m = s.trim().match(/^(\d+)\s*[×xX*]\s*(\d+)(?:\s*-\s*(\d+))?$/);
  if (!m) throw new Error(`Schema non valido: ${s}`);
  const repMin = Number(m[2]);
  return { sets: Number(m[1]), repMin, repMax: m[3] ? Number(m[3]) : repMin };
}

export const DAY_LABELS: Record<GymDay | 'run', { title: string; focus: string }> = {
  push: { title: 'Push', focus: 'Petto (focus alto), spalle, tricipiti' },
  pull: { title: 'Pull', focus: 'Dorsali, centro schiena, deltoide posteriore, bicipiti' },
  legs: { title: 'Legs', focus: 'Quadricipiti e femorali' },
  upper: { title: 'Upper', focus: 'Volume extra parte alta' },
  lower: { title: 'Lower', focus: 'Storico (giorno sostituito dalla corsa)' },
  run: { title: 'Corsa', focus: '10 km sempre più veloce' },
};

type Row = [id: string, name: string, scheme: string, startKg: number | null, kind: ExerciseKind, extra?: { isNew?: boolean; active?: boolean }];

const C: ExerciseKind = 'compound';
const I: ExerciseKind = 'isolation';

const ROWS: Record<GymDay, Row[]> = {
  push: [
    ['inc', 'Panca inclinata manubri', '3×6-8', 50, C], ['chp', 'Chest press', '3×8-10', 95, C],
    ['mil', 'Military press', '3×6-8', 15, C], ['crc', 'Croci ai cavi dal basso', '3×12-15', 35, I],
    ['lat', 'Alzate laterali', '4×12-15', 14, I], ['pd', 'Push-down', '3×10-12', 85, I],
  ],
  pull: [
    ['lm', 'Lat machine', '3×8-10', 95, C], ['tb', 'Rematore T-bar / petto in appoggio', '3×8-10', null, C, { isNew: true }],
    ['pul', 'Pulley basso presa stretta', '3×10-12', 70, C], ['dp', 'Deltoide posteriore', '3×15', 35, I],
    ['cm', 'Curl manubri', '3×10', 18, I], ['ham', 'Curl a martello', '2×12', 12, I],
  ],
  legs: [
    ['hs', 'Hack squat', '4×6-8', 70, C], ['rdl', 'Stacco rumeno', '3×6-8', null, C, { isNew: true }],
    ['lp', 'Leg press', '2×10-12', 75, C], ['le', 'Leg extension', '2×12-15', null, I],
    ['lc', 'Leg curl', '3×10-12', null, I], ['cal', 'Polpacci', '4×10-15', null, I, { isNew: true }],
  ],
  upper: [
    ['inc', 'Panca inclinata', '3×8-10', 36, C], ['pdn', 'Pull down presa stretta', '3×10', 75, C],
    ['sp', 'Shoulder press manubri', '3×8-10', 30, C], ['rb', 'Rematore bilanciere', '3×8', 30, C],
    ['latc', 'Alzate laterali al cavo', '3×15', 17, I], ['ss', 'Superset curl + push-down', '3×12', null, I],
  ],
  lower: [
    ['rdl', 'Stacco rumeno', '3×6-8', null, C, { active: false }], ['lc', 'Leg curl', '3×10-12', null, I, { active: false }],
    ['bss', 'Bulgarian split squat / hip thrust', '3×8-10', null, C, { active: false }],
    ['le', 'Leg extension', '2×15', null, I, { active: false }], ['cal', 'Polpacci', '4×10-15', null, I, { active: false }],
  ],
};

export const DEFAULT_PROGRAM: Exercise[] = (Object.keys(ROWS) as GymDay[]).flatMap((day) =>
  ROWS[day].map(([id, name, scheme, startKg, kind, extra], position) => ({
    day, id, name, ...parseScheme(scheme), startKg, kind, position,
    active: extra?.active ?? true, isNew: extra?.isNew ?? false, updatedAt: '1970-01-01T00:00:00Z',
  })),
);
