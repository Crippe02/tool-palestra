import { authorizeUrl, readCallback, createStravaApi } from './strava';
import type { SupabaseClient } from '@supabase/supabase-js';

test('indirizzo di autorizzazione Strava', () => {
  const u = authorizeUrl('123', 'https://crippe02.github.io/tool-palestra/', 'abc');
  expect(u.startsWith('https://www.strava.com/oauth/authorize?')).toBe(true);
  expect(u).toContain('client_id=123');
  expect(u).toContain('scope=activity%3Aread_all');
  expect(u).toContain('redirect_uri=https%3A%2F%2Fcrippe02.github.io%2Ftool-palestra%2F');
  expect(u).toContain('response_type=code');
  expect(u).toContain('state=abc');
});

test('ritorno da Strava', () => {
  expect(readCallback('?state=abc&code=xyz&scope=read,activity:read_all', 'abc')).toEqual({ code: 'xyz' });
  expect(readCallback('?state=zzz&code=xyz&scope=read,activity:read_all', 'abc')).toEqual({ error: 'state' });
  expect(readCallback('?state=abc&error=access_denied', 'abc')).toEqual({ error: 'denied' });
  expect(readCallback('?state=abc&code=xyz&scope=read', 'abc')).toEqual({ error: 'scope' });
  expect(readCallback('', 'abc')).toBeNull();
  expect(readCallback('?code=xyz&state=abc&scope=activity:read_all', null)).toEqual({ error: 'state' });
});

test('le chiamate passano dalla funzione strava e gli errori diventano eccezioni', async () => {
  const invoke = vi.fn(async (_name: string, opts: { body: { action: string } }) =>
    opts.body.action === 'sync' ? { data: { imported: 2, more: false }, error: null } : { data: null, error: new Error('boom') });
  const api = createStravaApi({ functions: { invoke } } as unknown as SupabaseClient);
  expect(await api.sync()).toEqual({ imported: 2, more: false, connected: true });
  expect(invoke).toHaveBeenCalledWith('strava', { body: { action: 'sync' } });
  await expect(api.status()).rejects.toThrow();
});

function invokeWith(result: () => { data: unknown; error: unknown }) {
  const invoke = vi.fn(async () => result());
  return { invoke, api: createStravaApi({ functions: { invoke } } as unknown as SupabaseClient) };
}

test('sync dice se si è collegati: 409 dalla funzione = non collegato', async () => {
  const off = invokeWith(() => ({ data: null, error: Object.assign(new Error('409'), { context: new Response('{}', { status: 409 }) }) }));
  expect(await off.api.sync()).toEqual({ imported: 0, more: false, connected: false });
  const on = invokeWith(() => ({ data: { imported: 1, more: false }, error: null }));
  expect(await on.api.sync()).toEqual({ imported: 1, more: false, connected: true });
});

test('due sync insieme fanno una sola chiamata, e subito dopo non si richiama Strava', async () => {
  const { invoke, api } = invokeWith(() => ({ data: { imported: 0, more: false }, error: null }));
  await Promise.all([api.sync(), api.sync()]);
  expect(invoke).toHaveBeenCalledTimes(1);
  await api.sync();
  expect(invoke).toHaveBeenCalledTimes(1);
});
