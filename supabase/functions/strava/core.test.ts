import { isRun, toRunRow, syncAfter, exchangeCode, freshTokens, syncRuns, type Tokens, type StravaActivity } from './core';

const DAY = 86_400;
const NOW_S = Date.parse('2026-11-14T12:00:00Z') / 1000;
const NOW_ISO = '2026-11-14T12:00:00.000Z';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fakeFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = async (url: string, init?: RequestInit) => { calls.push({ url, init }); return handler(url, init); };
  return { f, calls };
}

const act = (id: number, day: string, type = 'Run', meters = 5012, moving = 1810): StravaActivity => ({
  id, name: `Corsa ${id}`, type, sport_type: type, distance: meters, moving_time: moving,
  start_date: `${day}T07:00:00Z`, start_date_local: `${day}T08:00:00Z`,
});

const tokens: Tokens = { athleteId: 7, accessToken: 'acc', refreshToken: 'ref', expiresAt: NOW_S + 3600, lastActivityAt: null };

test('solo le corse vengono importate', () => {
  expect(['Run', 'TrailRun', 'VirtualRun'].map((t) => isRun(act(1, '2026-11-10', t)))).toEqual([true, true, true]);
  expect(['Ride', 'Walk', 'WeightTraining'].map((t) => isRun(act(1, '2026-11-10', t)))).toEqual([false, false, false]);
  expect(isRun({ ...act(1, '2026-11-10'), sport_type: undefined, type: 'Run' })).toBe(true);
});

test('una corsa diventa una riga di run_logs, senza feeling né hidden', () => {
  const row = toRunRow({ ...act(123, '2026-11-10') }, { best_efforts: [{ name: '5K', moving_time: 1790, elapsed_time: 1795 }] }, NOW_ISO);
  expect(row).toEqual({
    id: 'strava-123', date: '2026-11-10', type: 'corsa', distance_km: 5.01, duration_s: 1810, source: 'strava',
    external_id: '123', start_time: '2026-11-10T07:00:00Z', best_5k_s: 1790, best_10k_s: null, updated_at: NOW_ISO,
  });
  expect(row).not.toHaveProperty('feeling');
  expect(row).not.toHaveProperty('hidden');
});

test('da quando scaricare', () => {
  expect(syncAfter(null, NOW_S)).toBe(NOW_S - 90 * DAY);
  expect(syncAfter('2026-11-13T12:00:00Z', NOW_S)).toBe(NOW_S - 14 * DAY);
  const old = '2026-10-25T12:00:00Z';
  expect(syncAfter(old, NOW_S)).toBe(Date.parse(old) / 1000);
});

test('scambio del codice di autorizzazione', async () => {
  const { f, calls } = fakeFetch(() => json({ access_token: 'a1', refresh_token: 'r1', expires_at: NOW_S + 21600, athlete: { id: 42 } }));
  const t = await exchangeCode(f, 'cid', 'sec', 'code1');
  expect(t).toEqual({ athleteId: 42, accessToken: 'a1', refreshToken: 'r1', expiresAt: NOW_S + 21600, lastActivityAt: null });
  expect(calls[0].url).toBe('https://www.strava.com/oauth/token');
  expect(String(calls[0].init?.body)).toContain('grant_type=authorization_code');
});

test('token valido: nessuna chiamata; scaduto: rinnovo con il nuovo refresh token', async () => {
  const none = fakeFetch(() => json({}));
  expect(await freshTokens(none.f, tokens, 'cid', 'sec', NOW_S)).toBe(tokens);
  expect(none.calls).toHaveLength(0);

  const r = fakeFetch(() => json({ access_token: 'a2', refresh_token: 'r2-nuovo', expires_at: NOW_S + 21600 }));
  const t = await freshTokens(r.f, { ...tokens, expiresAt: NOW_S - 10 }, 'cid', 'sec', NOW_S);
  expect(t).toMatchObject({ accessToken: 'a2', refreshToken: 'r2-nuovo', athleteId: 7 });
  expect(String(r.calls[0].init?.body)).toContain('grant_type=refresh_token');
});

test('rinnovo rifiutato: errore', async () => {
  const r = fakeFetch(() => json({ message: 'Bad Request' }, 400));
  await expect(freshTokens(r.f, { ...tokens, expiresAt: 0 }, 'cid', 'sec', NOW_S)).rejects.toThrow();
});

function stravaApi(list: StravaActivity[], detailStatus: (id: number) => number = () => 200) {
  return fakeFetch((url) => {
    if (url.includes('/athlete/activities')) {
      const page = Number(new URL(url).searchParams.get('page'));
      return json(page === 1 ? list : []);
    }
    const id = Number(url.split('/').pop());
    const status = detailStatus(id);
    return status === 200 ? json({ best_efforts: [] }) : json({ message: 'Rate Limit Exceeded' }, status);
  });
}

test('sync: solo le corse, una riga per corsa', async () => {
  const api = stravaApi([act(2, '2026-11-11', 'Ride'), act(1, '2026-11-10')]);
  const res = await syncRuns({ f: api.f, existing: new Map(), t: tokens, nowS: NOW_S, nowIso: NOW_ISO });
  expect(res.rows.map((r) => r.id)).toEqual(['strava-1']);
  expect(res).toMatchObject({ more: false, lastActivityAt: '2026-11-10T07:00:00Z' });
  expect(api.calls.some((c) => c.url.endsWith('/activities/2'))).toBe(false);
});

test('sync: corsa già presente e uguale non viene richiesta', async () => {
  const api = stravaApi([act(1, '2026-11-10')]);
  const existing = new Map([['strava-1', { distanceKm: 5.01, durationS: 1810 }]]);
  const res = await syncRuns({ f: api.f, existing, t: tokens, nowS: NOW_S, nowIso: NOW_ISO });
  expect(res.rows).toHaveLength(0);
  expect(api.calls.filter((c) => c.url.includes('/activities/'))).toHaveLength(0);
});

test('sync: limite di Strava a metà, si salva il punto raggiunto', async () => {
  const api = stravaApi([act(1, '2026-11-10'), act(2, '2026-11-12')], (id) => (id === 2 ? 429 : 200));
  const res = await syncRuns({ f: api.f, existing: new Map(), t: tokens, nowS: NOW_S, nowIso: NOW_ISO });
  expect(res.rows.map((r) => r.id)).toEqual(['strava-1']);
  expect(res).toMatchObject({ more: true, lastActivityAt: '2026-11-10T07:00:00Z' });
});

test('sync: elenco rifiutato, nessuna riga e il punto non si sposta', async () => {
  const api = fakeFetch(() => json({ message: 'Rate Limit Exceeded' }, 429));
  const res = await syncRuns({ f: api.f, existing: new Map(), t: { ...tokens, lastActivityAt: '2026-11-01T07:00:00Z' }, nowS: NOW_S, nowIso: NOW_ISO });
  expect(res).toEqual({ rows: [], lastActivityAt: '2026-11-01T07:00:00Z', more: true });
});
