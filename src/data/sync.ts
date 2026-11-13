import type { TableName } from '../domain/types';
import { LocalStore, TABLES, pendingKey, rowKey, type PendingEntry } from './localStore';

export interface Remote {
  upsert(table: TableName, rows: object[]): Promise<void>;
  pullSince(table: TableName, sinceIso: string | null): Promise<object[]>;
}

export interface SyncStatus { pending: number; online: boolean; lastSync: string | null }

type Row = Record<string, unknown>;

export class SyncEngine {
  private cache = new Map<TableName, Row[]>();
  private listeners = new Set<() => void>();
  private status: SyncStatus = { pending: 0, online: true, lastSync: null };
  private flushing: Promise<{ sent: number }> | null = null;

  constructor(private local: LocalStore, private remote: Remote, private isOnline: () => boolean = () => navigator.onLine) {}

  /** Carica in memoria i dati locali. Va chiamato una volta prima di usare rows(). */
  async init(): Promise<void> {
    for (const t of TABLES) this.cache.set(t, await this.local.all<Row>(t));
    await this.refreshStatus();
  }

  rows<T>(table: TableName): T[] { return (this.cache.get(table) ?? []) as T[]; }
  getStatus(): SyncStatus { return this.status; }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => { this.listeners.delete(cb); };
  }

  async write(table: TableName, row: object): Promise<void> {
    const stamped = { ...(row as Row), updatedAt: new Date().toISOString() };
    await this.local.put(table, stamped);
    await this.local.enqueue(table, stamped);
    this.replaceInCache(table, stamped);
    await this.refreshStatus();
    if (this.isOnline()) void this.flush();
  }

  async flush(): Promise<{ sent: number }> {
    if (this.flushing) return this.flushing;
    this.flushing = this.doFlush().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  private async doFlush(): Promise<{ sent: number }> {
    const entries = await this.local.pending();
    const byTable = new Map<TableName, PendingEntry[]>();
    for (const e of entries) byTable.set(e.table, [...(byTable.get(e.table) ?? []), e]);
    let sent = 0;
    for (const [table, list] of byTable) {
      try {
        await this.remote.upsert(table, list.map((e) => e.row));
      } catch {
        continue; // resta in coda, si riprova più tardi
      }
      // Toglie dalla coda solo le voci non modificate nel frattempo.
      const done: string[] = [];
      for (const e of list) {
        const now = await this.local.pendingEntry(e.key);
        if (now && JSON.stringify(now.row) === JSON.stringify(e.row)) done.push(e.key);
      }
      await this.local.clearPending(done);
      sent += list.length;
    }
    if (sent > 0) await this.local.setMeta('lastSync', new Date().toISOString());
    await this.refreshStatus();
    return { sent };
  }

  async pull(): Promise<void> {
    const pendingKeys = new Set((await this.local.pending()).map((e) => e.key));
    for (const table of TABLES) {
      const since = await this.local.getMeta(`pull:${table}`);
      let rows: Row[];
      try {
        rows = (await this.remote.pullSince(table, since)) as Row[];
      } catch {
        continue;
      }
      let max = since;
      for (const r of rows) {
        const updated = String(r.updatedAt);
        if (max == null || updated > max) max = updated;
        if (pendingKeys.has(pendingKey(table, r))) continue;
        const existing = await this.local.get<Row>(table, rowKey(table, r));
        if (!existing || updated > String(existing.updatedAt)) {
          await this.local.put(table, r);
          this.replaceInCache(table, r);
        }
      }
      if (max) await this.local.setMeta(`pull:${table}`, max);
    }
    await this.refreshStatus();
  }

  async pendingCount(): Promise<number> { return (await this.local.pending()).length; }

  /** Flush + pull: all'apertura, al ritorno della rete, quando l'app torna in primo piano. */
  async sync(): Promise<void> {
    if (this.isOnline()) {
      await this.flush();
      await this.pull();
    }
    await this.refreshStatus();
  }

  private replaceInCache(table: TableName, row: Row) {
    const key = rowKey(table, row);
    const list = (this.cache.get(table) ?? []).filter((r) => rowKey(table, r) !== key);
    this.cache.set(table, [...list, row]);
    this.emit();
  }

  private async refreshStatus() {
    this.status = { pending: await this.pendingCount(), online: this.isOnline(), lastSync: await this.local.getMeta('lastSync') };
    this.emit();
  }

  private emit() { for (const l of this.listeners) l(); }
}
