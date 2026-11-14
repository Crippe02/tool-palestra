// Supabase Edge Function "strava": collegamento e import delle corse.
// Segreti (Edge Functions → Secrets): STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY li fornisce Supabase.
// Niente log di token o dati: il repository è pubblico.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { exchangeCode, freshTokens, syncRuns, type Tokens } from './core.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const secret = Deno.env.get('STRAVA_CLIENT_SECRET');
    if (!clientId || !secret) return reply({ error: 'not_configured' }, 500);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: who, error: whoError } = await admin.auth.getUser(jwt);
    if (whoError || !who.user) return reply({ error: 'unauthorized' }, 401);
    const userId = who.user.id;

    const body = (await req.json().catch(() => ({}))) as { action?: string; code?: unknown };

    const load = async (): Promise<Tokens | null> => {
      const { data, error } = await admin.from('strava_tokens').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw new Error('db_tokens_read');
      return data
        ? { athleteId: Number(data.athlete_id), accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Number(data.expires_at), lastActivityAt: data.last_activity_at }
        : null;
    };
    const save = async (t: Tokens) => {
      const { error } = await admin.from('strava_tokens').upsert({
        user_id: userId, athlete_id: t.athleteId, access_token: t.accessToken, refresh_token: t.refreshToken,
        expires_at: t.expiresAt, last_activity_at: t.lastActivityAt, updated_at: new Date().toISOString(),
      });
      if (error) throw new Error('db_tokens_write');
    };

    switch (body.action) {
      case 'status':
        return reply({ connected: (await load()) != null });

      case 'connect': {
        if (typeof body.code !== 'string' || !body.code) return reply({ error: 'bad_request' }, 400);
        await save(await exchangeCode(fetch, clientId, secret, body.code));
        return reply({ connected: true });
      }

      case 'disconnect': {
        const { error } = await admin.from('strava_tokens').delete().eq('user_id', userId);
        if (error) throw new Error('db_tokens_delete');
        return reply({ connected: false });
      }

      case 'sync': {
        let t = await load();
        if (!t) return reply({ error: 'not_connected' }, 409);
        const nowS = Math.floor(Date.now() / 1000);
        const fresh = await freshTokens(fetch, t, clientId, secret, nowS);
        if (fresh !== t) { await save(fresh); t = fresh; }

        const { data: known, error: knownError } = await admin.from('run_logs')
          .select('id, distance_km, duration_s').eq('user_id', userId).eq('source', 'strava');
        if (knownError) throw new Error('db_runs_read');
        const existing = new Map((known ?? []).map((r) => [r.id as string, { distanceKm: Number(r.distance_km), durationS: Number(r.duration_s) }]));

        const res = await syncRuns({ f: fetch, existing, t, nowS, nowIso: new Date().toISOString() });
        if (res.rows.length > 0) {
          const { error } = await admin.from('run_logs').upsert(res.rows.map((r) => ({ ...r, user_id: userId })), { onConflict: 'user_id,id' });
          if (error) throw new Error('db_runs_write');
        }
        if (res.lastActivityAt !== t.lastActivityAt) await save({ ...t, lastActivityAt: res.lastActivityAt });
        return reply({ imported: res.rows.length, more: res.more });
      }

      default:
        return reply({ error: 'bad_request' }, 400);
    }
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : 'error' }, 502);
  }
});
