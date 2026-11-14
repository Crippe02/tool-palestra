import { DEFAULT_PROGRAM } from '../domain/program';
import type { Profile } from '../domain/types';
import type { SyncEngine } from './sync';

/** Primo avvio (dopo il pull): se non ci sono esercizi scrive la scheda di partenza e il profilo. */
export async function seedIfEmpty(engine: SyncEngine): Promise<boolean> {
  if (engine.rows('exercises').length > 0) return false;
  for (const ex of DEFAULT_PROGRAM) await engine.write('exercises', ex);
  if (engine.rows<Profile>('profile').length === 0) {
    const profile: Omit<Profile, 'updatedAt'> = { id: 'me', currentCycle: 1, currentWeek: 1, baseline: null };
    await engine.write('profile', profile);
  }
  return true;
}
