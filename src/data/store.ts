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
