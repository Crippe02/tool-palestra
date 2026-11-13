import { openDB, type IDBPDatabase } from 'idb';
import type { TableName } from '../domain/types';

export const TABLES: TableName[] = ['exercises', 'set_logs', 'body_logs', 'run_logs', 'profile'];

type AnyRow = Record<string, unknown>;

/** Chiave naturale della riga (come la chiave primaria su Supabase, senza user_id). */
export function rowKey(table: TableName, row: object): string {
  const r = row as AnyRow;
  switch (table) {
    case 'exercises': return `${r.day}|${r.id}`;
    case 'set_logs': return `${r.day}|${r.exerciseId}|${r.cycle}|${r.week}`;
    case 'body_logs': return String(r.date);
    case 'run_logs': return String(r.id);
    case 'profile': return 'me';
  }
}

export const pendingKey = (table: TableName, row: object) => `${table}:${rowKey(table, row)}`;

export interface PendingEntry { key: string; table: TableName; row: AnyRow }

export class LocalStore {
  private constructor(private db: IDBPDatabase) {}

  static async open(name = 'tool-palestra'): Promise<LocalStore> {
    const db = await openDB(name, 1, {
      upgrade(db) {
        for (const t of TABLES) db.createObjectStore(t);
        db.createObjectStore('pending');
        db.createObjectStore('meta');
      },
    });
    return new LocalStore(db);
  }

  close() { this.db.close(); }

  async all<T>(table: TableName): Promise<T[]> { return (await this.db.getAll(table)) as T[]; }
  async get<T>(table: TableName, key: string): Promise<T | undefined> { return (await this.db.get(table, key)) as T | undefined; }
  async put(table: TableName, row: object): Promise<void> { await this.db.put(table, row, rowKey(table, row)); }

  async enqueue(table: TableName, row: object): Promise<void> {
    const key = pendingKey(table, row);
    await this.db.put('pending', { key, table, row }, key);
  }
  async pending(): Promise<PendingEntry[]> { return (await this.db.getAll('pending')) as PendingEntry[]; }
  async pendingEntry(key: string): Promise<PendingEntry | undefined> { return (await this.db.get('pending', key)) as PendingEntry | undefined; }
  async clearPending(keys: string[]): Promise<void> {
    const tx = this.db.transaction('pending', 'readwrite');
    await Promise.all([...keys.map((k) => tx.store.delete(k)), tx.done]);
  }

  async getMeta(k: string): Promise<string | null> { return ((await this.db.get('meta', k)) as string | undefined) ?? null; }
  async setMeta(k: string, v: string): Promise<void> { await this.db.put('meta', v, k); }
}
