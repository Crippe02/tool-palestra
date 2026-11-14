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

const PAGE = 1000; // il limite di righe predefinito di Supabase

/** Colonne numeric: PostgREST può restituirle come stringhe. */
const NUMERIC = new Set(['kg', 'startKg', 'weightKg', 'waistCm', 'chestCm', 'armCm', 'thighCm', 'distanceKm', 'durationS', 'best5kS', 'best10kS']);
/** Date e ore: PostgREST le restituisce con +00:00, l'app le confronta come ISO con Z. */
const TIMESTAMPS = new Set(['updatedAt', 'syncedAt', 'startTime']);

/** Nomi con cifre che la conversione automatica non sa trattare. */
const SPECIAL: Record<string, string> = { best5kS: 'best_5k_s', best10kS: 'best_10k_s' };
const SPECIAL_BACK = Object.fromEntries(Object.entries(SPECIAL).map(([a, b]) => [b, a]));

const snake = (k: string) => SPECIAL[k] ?? k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (k: string) => SPECIAL_BACK[k] ?? k.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());

/** Conversione superficiale: il contenuto di baseline (jsonb) resta com'è. */
export function toRemote(table: TableName, row: object): Record<string, unknown> {
  const out = Object.fromEntries(Object.entries(row).map(([k, v]) => [snake(k), v]));
  // In un invio con più righe, una chiave mancante diventa NULL: hidden è NOT NULL e bloccherebbe la coda.
  if (table === 'run_logs' && out.hidden == null) out.hidden = false;
  return out;
}

export function fromRemote(_table: TableName, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'user_id') continue;
    const key = camel(k);
    if (TIMESTAMPS.has(key)) out[key] = v == null ? null : new Date(String(v)).toISOString();
    else if (NUMERIC.has(key) && v != null) out[key] = Number(v);
    else out[key] = v;
  }
  return out;
}

/** Scarica pagina dopo pagina finché una pagina non torna più corta. */
export async function fetchAllPages<T>(fetchPage: (from: number, to: number) => Promise<T[]>, pageSize = PAGE): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}

/** Senza sessione valida le richieste andrebbero come anonimo e la RLS restituirebbe zero righe: meglio fallire. */
async function requireSession(client: SupabaseClient) {
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error('Sessione non disponibile');
}

export function createSupabaseRemote(client: SupabaseClient): Remote {
  return {
    async upsert(table, rows) {
      await requireSession(client);
      const { error } = await client.from(table).upsert(rows.map((r) => toRemote(table, r)), { onConflict: CONFLICT[table] });
      if (error) throw error;
    },
    async pullSince(table, sinceIso) {
      await requireSession(client);
      const keys = CONFLICT[table].split(',').filter((c) => c !== 'user_id');
      const rows = await fetchAllPages(async (from, to) => {
        let q = client.from(table).select('*').order('synced_at');
        for (const k of keys) q = q.order(k);
        if (sinceIso) q = q.gte('synced_at', sinceIso);
        const { data, error } = await q.range(from, to);
        if (error) throw error;
        return (data ?? []) as Record<string, unknown>[];
      });
      return rows.map((r) => fromRemote(table, r));
    },
  };
}
