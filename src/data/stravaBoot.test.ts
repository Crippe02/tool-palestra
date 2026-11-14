import { processStravaReturn } from './stravaBoot';
import type { StravaApi } from './strava';

const api = (connect = vi.fn(async () => {})): StravaApi => ({
  status: vi.fn(async () => ({ connected: true })), connect, sync: vi.fn(async () => ({ imported: 0, more: false, connected: true })), disconnect: vi.fn(async () => {}),
});

test('ritorno con codice: collega e annuncia', async () => {
  const a = api();
  expect(await processStravaReturn('?state=s&code=c&scope=read,activity:read_all', 's', a)).toMatch(/Strava collegato/);
  expect(a.connect).toHaveBeenCalledWith('c');
});

test('ritorno annullato o collegamento fallito: messaggio, niente collegamento', async () => {
  const a = api();
  expect(await processStravaReturn('?state=s&error=access_denied', 's', a)).toMatch(/annullato/);
  expect(a.connect).not.toHaveBeenCalled();
  const failing = api(vi.fn(async () => { throw new Error('x'); }));
  expect(await processStravaReturn('?state=s&code=c&scope=activity:read_all', 's', failing)).toMatch(/non riuscito/);
});

test('nessun ritorno da Strava: niente da fare', async () => {
  expect(await processStravaReturn('', null, api())).toBeNull();
});
