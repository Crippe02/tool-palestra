// Remote in memoria per i test: può andare offline o fallire. Come il server vero,
// assegna `syncedAt` (ora di ricezione) a ogni riga e filtra il pull su quello.
import type { TableName } from '../domain/types';
import type { Remote } from './sync';
import { rowKey } from './localStore';

export class FakeRemote implements Remote {
  tables = new Map<TableName, Map<string, Record<string, unknown>>>();
  offline = false;
  failPull = false;
  upserts = 0;
  private t(table: TableName) {
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    return this.tables.get(table)!;
  }
  seed(table: TableName, rows: object[]) {
    const syncedAt = new Date().toISOString();
    for (const r of rows) this.t(table).set(rowKey(table, r), { ...(r as Record<string, unknown>), syncedAt });
  }
  rows(table: TableName) { return [...this.t(table).values()]; }
  async upsert(table: TableName, rows: object[]) {
    if (this.offline) throw new Error('offline');
    this.upserts++;
    this.seed(table, rows);
  }
  async pullSince(table: TableName, sinceIso: string | null) {
    if (this.offline || this.failPull) throw new Error('offline');
    return this.rows(table).filter((r) => sinceIso == null || String(r.syncedAt) >= sinceIso);
  }
}
