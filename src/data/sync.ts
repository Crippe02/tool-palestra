import type { TableName } from '../domain/types';
import { LocalStore, TABLES, pendingKey, rowKey, type PendingEntry } from './localStore';

/**
 * Il remoto restituisce le righe con `syncedAt`: l'ora in cui il SERVER le ha ricevute.
 * Il cursore del pull usa quella, non `updatedAt` (ora del dispositivo che ha scritto),
 * così le righe inviate in ritardo da un altro dispositivo arrivano comunque.
 */
export interface Remote {
  upsert(table: TableName, rows: object[]): Promise<void>;
  pullSince(table: TableName, sinceIso: string | null): Promise<object[]>;
}

export interface SyncStatus { pending: number; online: boolean; lastSync: string | null }

type Row = Record<string, unknown>;

export class SyncEngine {
  private cache = new Map<TableName, Row[]>();
  private pulledOnce = new Set<TableName>();
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

  /** true se la tabella ha dati locali o è stata scaricata almeno una volta in questa sessione. */
  isReady(table: TableName): boolean {
    return this.rows(table).length > 0 || this.pulledOnce.has(table);
  }

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

  /** Invia la coda; se nel frattempo sono arrivate modifiche nuove, rifà un giro (al massimo 5). */
  private async doFlush(): Promise<{ sent: number }> {
    let sent = 0;
    for (let round = 0; round < 5; round++) {
      const r = await this.flushOnce();
      sent += r.sent;
      if (r.failed || r.sent === 0 || (await this.pendingCount()) === 0) break;
    }
    if (sent > 0) await this.local.setMeta('lastSync', new Date().toISOString());
    await this.refreshStatus();
    return { sent };
  }

  private async flushOnce(): Promise<{ sent: number; failed: boolean }> {
    const entries = await this.local.pending();
    const byTable = new Map<TableName, PendingEntry[]>();
    for (const e of entries) byTable.set(e.table, [...(byTable.get(e.table) ?? []), e]);
    let sent = 0;
    let failed = false;
    for (const [table, list] of byTable) {
      try {
        await this.remote.upsert(table, list.map((e) => e.row));
      } catch {
        failed = true;
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
    return { sent, failed };
  }

  /** Scarica le novità. Restituisce le tabelle scaricate con successo. */
  async pull(): Promise<{ pulled: Set<TableName> }> {
    const pulled = new Set<TableName>();
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
      for (const raw of rows) {
        const { syncedAt, ...r } = raw;
        const cursor = String(syncedAt ?? r.updatedAt);
        if (max == null || cursor > max) max = cursor;
        if (pendingKeys.has(pendingKey(table, r))) continue;
        const existing = await this.local.get<Row>(table, rowKey(table, r));
        if (!existing || String(r.updatedAt) > String(existing.updatedAt)) {
          await this.local.put(table, r);
          this.replaceInCache(table, r);
        }
      }
      if (max) await this.local.setMeta(`pull:${table}`, max);
      pulled.add(table);
      this.pulledOnce.add(table);
    }
    await this.refreshStatus();
    return { pulled };
  }

  async pendingCount(): Promise<number> { return (await this.local.pending()).length; }

  /** Flush + pull: all'apertura, al ritorno della rete, quando l'app torna in primo piano. */
  async sync(): Promise<{ pulled: Set<TableName> }> {
    let pulled = new Set<TableName>();
    if (this.isOnline()) {
      await this.flush();
      ({ pulled } = await this.pull());
    }
    await this.refreshStatus();
    return { pulled };
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
