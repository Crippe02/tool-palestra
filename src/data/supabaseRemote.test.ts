import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseRemote, fetchAllPages } from './supabaseRemote';

test('senza sessione valida il remoto fallisce invece di restituire zero righe', async () => {
  const from = vi.fn();
  const client = { auth: { getSession: async () => ({ data: { session: null } }) }, from } as unknown as SupabaseClient;
  const remote = createSupabaseRemote(client);
  await expect(remote.pullSince('set_logs', null)).rejects.toThrow();
  await expect(remote.upsert('set_logs', [{}])).rejects.toThrow();
  expect(from).not.toHaveBeenCalled();
});

test('scarica tutte le pagine, non solo le prime 1000 righe', async () => {
  const all = Array.from({ length: 2500 }, (_, i) => ({ i }));
  const rows = await fetchAllPages(async (from, to) => all.slice(from, to + 1), 1000);
  expect(rows).toHaveLength(2500);
});
