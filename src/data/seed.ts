import { DEFAULT_PROGRAM } from '../domain/program';
import type { Profile, TableName } from '../domain/types';
import type { SyncEngine } from './sync';

/**
 * Primo avvio: se il remoto non ha esercizi scrive la scheda di partenza e il profilo.
 * Solo dopo un pull RIUSCITO di esercizi e profilo: con un pull fallito la cache vuota
 * non dice nulla sul remoto, e scrivere i valori iniziali li sovrascriverebbe.
 */
export async function seedIfEmpty(engine: SyncEngine, pulled: Set<TableName>): Promise<boolean> {
  if (!pulled.has('exercises') || !pulled.has('profile')) return false;
  if (engine.rows('exercises').length > 0) return false;
  for (const ex of DEFAULT_PROGRAM) await engine.write('exercises', ex);
  if (engine.rows<Profile>('profile').length === 0) {
    const profile: Omit<Profile, 'updatedAt'> = { id: 'me', currentCycle: 1, currentWeek: 1, baseline: null };
    await engine.write('profile', profile);
  }
  return true;
}
