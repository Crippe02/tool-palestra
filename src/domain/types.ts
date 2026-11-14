export type GymDay = 'push' | 'pull' | 'legs' | 'upper' | 'lower'; // 'lower' solo storico
export type ExerciseKind = 'compound' | 'isolation';

export interface Exercise {
  day: GymDay; id: string; name: string; sets: number; repMin: number; repMax: number;
  startKg: number | null; kind: ExerciseKind; position: number; active: boolean; isNew: boolean; updatedAt: string;
}
export interface SetLog { day: GymDay; exerciseId: string; cycle: number; week: number; kg: number | null; reps: string; updatedAt: string }
export interface BodyLog {
  date: string; weightKg: number | null; waistCm: number | null; chestCm: number | null;
  armCm: number | null; thighCm: number | null; updatedAt: string;
}
export type RunType = 'test' | 'ripetute' | 'ritmo' | 'lungo' | 'corsa'; // da Strava in poi solo 'corsa'
export type Feeling = 'facile' | 'giusta' | 'dura';
export interface RunLog {
  id: string; date: string; type: RunType; distanceKm: number; durationS: number;
  source: 'manual' | 'strava'; externalId: string | null; updatedAt: string;
  startTime?: string | null; feeling?: Feeling | null; best5kS?: number | null; best10kS?: number | null; hidden?: boolean;
}
export interface Baseline {
  date: string; weightKg: number | null; waistCm: number | null; chestCm: number | null;
  armCm: number | null; thighCm: number | null;
}
export interface Profile { id: 'me'; currentCycle: number; currentWeek: number; baseline: Baseline | null; updatedAt: string }
export type TableName = 'exercises' | 'set_logs' | 'body_logs' | 'run_logs' | 'profile';
export const WEEKS_PER_CYCLE = 24;
