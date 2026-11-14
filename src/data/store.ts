import { createContext, useContext, useSyncExternalStore } from 'react';
import type { TableName } from '../domain/types';
import type { SyncEngine, SyncStatus } from './sync';

export const SyncContext = createContext<SyncEngine | null>(null);

export function useEngine(): SyncEngine {
  const engine = useContext(SyncContext);
  if (!engine) throw new Error('SyncContext mancante');
  return engine;
}

export function useRows<T>(table: TableName): T[] {
  const engine = useEngine();
  return useSyncExternalStore((cb) => engine.onChange(cb), () => engine.rows<T>(table));
}

export function useSyncStatus(): SyncStatus {
  const engine = useEngine();
  return useSyncExternalStore((cb) => engine.onChange(cb), () => engine.getStatus());
}

const DEFAULT_PROFILE = { id: 'me', currentCycle: 1, currentWeek: 1, baseline: null, updatedAt: '' } as const;

/** Il profilo (settimana corrente, punto di partenza). Prima del primo sync usa i valori iniziali. */
export function useProfile(): import('../domain/types').Profile {
  const rows = useRows<import('../domain/types').Profile>('profile');
  return rows[0] ?? DEFAULT_PROFILE;
}
