import type { SupabaseClient } from '@supabase/supabase-js';
import type { TableName } from '../domain/types';
import type { Remote } from './sync';

const CONFLICT: Record<TableName, string> = {
  exercises: 'user_id,day,id',
  set_logs: 'user_id,day,exercise_id,cycle,week',
  body_logs: 'user_id,date',
  run_logs: 'user_id,id',
  profile: 'user_id',
};

/** Colonne numeric: PostgREST può restituirle come stringhe. */
const NUMERIC = new Set(['kg', 'startKg', 'weightKg', 'waistCm', 'chestCm', 'armCm', 'thighCm', 'distanceKm', 'durationS']);

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (k: string) => k.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());

/** Conversione superficiale: il contenuto di baseline (jsonb) resta com'è. */
export function toRemote(_table: TableName, row: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [snake(k), v]));
}

export function fromRemote(_table: TableName, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'user_id') continue;
    const key = camel(k);
    if (key === 'updatedAt') out[key] = new Date(String(v)).toISOString();
    else if (NUMERIC.has(key) && v != null) out[key] = Number(v);
    else out[key] = v;
  }
  return out;
}

export function createSupabaseRemote(client: SupabaseClient): Remote {
  return {
    async upsert(table, rows) {
      const { error } = await client.from(table).upsert(rows.map((r) => toRemote(table, r)), { onConflict: CONFLICT[table] });
      if (error) throw error;
    },
    async pullSince(table, sinceIso) {
      let q = client.from(table).select('*').order('updated_at');
      if (sinceIso) q = q.gt('updated_at', sinceIso);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => fromRemote(table, r as Record<string, unknown>));
    },
  };
}
