import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { LocalStore } from '../data/localStore';
import { SyncEngine } from '../data/sync';
import { FakeRemote } from '../data/fakeRemote';
import { SyncContext } from '../data/store';
import { DEFAULT_PROGRAM } from '../domain/program';
import type { Profile, TableName } from '../domain/types';

let n = 0;

/** Rende un componente con un SyncEngine vero su IndexedDB finto e remoto in memoria. */
export async function renderWithEngine(
  ui: ReactElement,
  opts: { profile?: Partial<Profile>; rows?: Partial<Record<TableName, object[]>> } = {},
) {
  const remote = new FakeRemote();
  const engine = new SyncEngine(await LocalStore.open(`ui-${++n}`), remote, () => false);
  await engine.init();
  for (const ex of DEFAULT_PROGRAM) await engine.write('exercises', ex);
  await engine.write('profile', { id: 'me', currentCycle: 1, currentWeek: 1, baseline: null, ...opts.profile });
  for (const [table, rows] of Object.entries(opts.rows ?? {})) {
    for (const r of rows ?? []) await engine.write(table as TableName, r);
  }
  const result = render(<SyncContext.Provider value={engine}>{ui}</SyncContext.Provider>);
  return { ...result, engine, remote };
}
