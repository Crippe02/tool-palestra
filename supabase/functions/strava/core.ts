// Logica pura della funzione Strava: niente API di Deno, così si testa con Vitest.
// Regola: niente console.log di token o dati personali (il repository è pubblico).

export interface Tokens { athleteId: number; accessToken: string; refreshToken: string; expiresAt: number; lastActivityAt: string | null }
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface StravaActivity {
  id: number; name: string; type?: string; sport_type?: string; distance: number; moving_time: number;
  start_date: string; start_date_local: string;
}
export interface StravaDetail { best_efforts?: { name: string; moving_time: number; elapsed_time: number }[] }

/** Colonne di run_logs scritte dalla funzione. Mai feeling né hidden: sono dell'utente. */
export interface RunRow {
  id: string; date: string; type: 'corsa'; distance_km: number; duration_s: number; source: 'strava';
  external_id: string; start_time: string; best_5k_s: number | null; best_10k_s: number | null; updated_at: string;
}

const TOKEN_URL = 'https://www.strava.com/oauth/token';
const API = 'https://www.strava.com/api/v3';
const DAY = 86_400;
const FIRST_SYNC_DAYS = 90;
const RECHECK_DAYS = 14;
const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

export function isRun(a: StravaActivity): boolean {
  return RUN_TYPES.has(a.sport_type ?? a.type ?? '');
}

function bestEffort(detail: StravaDetail | null, name: string): number | null {
  const e = detail?.best_efforts?.find((b) => b.name.toLowerCase() === name);
  return e ? e.moving_time : null;
}

export function toRunRow(a: StravaActivity, detail: StravaDetail | null, nowIso: string): RunRow {
  return {
    id: `strava-${a.id}`,
    date: a.start_date_local.slice(0, 10),
    type: 'corsa',
    distance_km: Math.round(a.distance / 10) / 100,
    duration_s: a.moving_time,
    source: 'strava',
    external_id: String(a.id),
    start_time: a.start_date,
    best_5k_s: bestEffort(detail, '5k'),
    best_10k_s: bestEffort(detail, '10k'),
    updated_at: nowIso,
  };
}

/** Primo sync: ultimi 90 giorni. Poi dall'ultima corsa importata, ricontrollando sempre gli ultimi 14 giorni. */
export function syncAfter(lastActivityAt: string | null, nowS: number): number {
  if (!lastActivityAt) return nowS - FIRST_SYNC_DAYS * DAY;
  return Math.min(Date.parse(lastActivityAt) / 1000, nowS - RECHECK_DAYS * DAY);
}

async function tokenRequest(f: Fetch, params: Record<string, string>) {
  const res = await f(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  // 400/401: autorizzazione revocata o refresh token non più valido → va ricollegato.
  if (res.status === 400 || res.status === 401) throw new Error('strava_reauth');
  if (!res.ok) throw new Error(`strava_token_${res.status}`);
  return (await res.json()) as { access_token: string; refresh_token: string; expires_at: number; athlete?: { id: number } };
}

export async function exchangeCode(f: Fetch, clientId: string, secret: string, code: string): Promise<Tokens> {
  const j = await tokenRequest(f, { client_id: clientId, client_secret: secret, code, grant_type: 'authorization_code' });
  if (!j.athlete) throw new Error('strava_no_athlete');
  return { athleteId: j.athlete.id, accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: j.expires_at, lastActivityAt: null };
}

/** Rinnova il token se scade entro un minuto. Strava può cambiare il refresh token: va salvato quello nuovo. */
export async function freshTokens(f: Fetch, t: Tokens, clientId: string, secret: string, nowS: number): Promise<Tokens> {
  if (t.expiresAt > nowS + 60) return t;
  const j = await tokenRequest(f, { client_id: clientId, client_secret: secret, refresh_token: t.refreshToken, grant_type: 'refresh_token' });
  return { ...t, accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: j.expires_at };
}

const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : Date.parse(b) > Date.parse(a) ? b : a);

export async function syncRuns(deps: {
  f: Fetch; existing: Map<string, { distanceKm: number; durationS: number }>; t: Tokens; nowS: number; nowIso: string; maxDetails?: number;
}): Promise<{ rows: RunRow[]; lastActivityAt: string | null; more: boolean; reauth?: boolean }> {
  const { f, existing, t, nowS, nowIso, maxDetails = 40 } = deps;
  const auth = { headers: { authorization: `Bearer ${t.accessToken}` } };
  const after = Math.floor(syncAfter(t.lastActivityAt, nowS));

  const all: StravaActivity[] = [];
  for (let page = 1; ; page++) {
    const res = await f(`${API}/athlete/activities?after=${after}&per_page=100&page=${page}`, auth);
    if (res.status === 401) return { rows: [], lastActivityAt: t.lastActivityAt, more: false, reauth: true };
    if (!res.ok) return { rows: [], lastActivityAt: t.lastActivityAt, more: true };
    const list = (await res.json()) as StravaActivity[];
    all.push(...list);
    if (list.length < 100) break;
  }

  const runs = all.filter(isRun).sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date));
  const rows: RunRow[] = [];
  let lastActivityAt = t.lastActivityAt;
  let details = 0;
  for (const a of runs) {
    const known = existing.get(`strava-${a.id}`);
    const unchanged = known && Math.abs(known.distanceKm - Math.round(a.distance / 10) / 100) < 0.005 && known.durationS === a.moving_time;
    if (!unchanged) {
      if (details >= maxDetails) return { rows, lastActivityAt, more: true };
      const res = await f(`${API}/activities/${a.id}`, auth);
      details++;
      // Attività cancellata o resa privata nel frattempo: si salta. Limiti ed errori del server: ci si ferma e si riprova.
      if (res.status === 404 || res.status === 403) { lastActivityAt = later(lastActivityAt, a.start_date); continue; }
      if (!res.ok) return { rows, lastActivityAt, more: true };
      rows.push(toRunRow(a, (await res.json()) as StravaDetail, nowIso));
    }
    lastActivityAt = later(lastActivityAt, a.start_date);
  }
  return { rows, lastActivityAt, more: false };
}
