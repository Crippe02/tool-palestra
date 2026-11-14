import { createContext, useContext } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

const SCOPE = 'activity:read_all';
const STATE_KEY = 'tool-palestra:strava-state';

export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', approval_prompt: 'auto', scope: SCOPE, state,
  });
  return `https://www.strava.com/oauth/authorize?${q.toString()}`;
}

/** Legge il ritorno da Strava nell'indirizzo. null se non è un ritorno da Strava. */
export function readCallback(search: string, expectedState: string | null): { code: string } | { error: 'denied' | 'state' | 'scope' } | null {
  const p = new URLSearchParams(search);
  if (!p.has('code') && !p.has('error')) return null;
  if (!expectedState || p.get('state') !== expectedState) return { error: 'state' };
  if (p.has('error')) return { error: 'denied' };
  if (!(p.get('scope') ?? '').split(',').includes(SCOPE)) return { error: 'scope' };
  return { code: p.get('code')! };
}

export interface SyncResult { imported: number; more: boolean; connected: boolean }

export interface StravaApi {
  status(): Promise<{ connected: boolean }>;
  connect(code: string): Promise<void>;
  /** Scarica le corse nuove. connected: false se Strava non è collegato (o va ricollegato). */
  sync(): Promise<SyncResult>;
  disconnect(): Promise<void>;
}

const COOLDOWN_MS = 30_000;

export function createStravaApi(client: SupabaseClient): StravaApi {
  const call = async <T>(body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await client.functions.invoke('strava', { body });
    if (error) throw error;
    return data as T;
  };

  // Una sola sync alla volta, e niente nuove chiamate a Strava per 30 secondi dopo una riuscita
  // (apertura dell'app e sezione Corsa partono quasi insieme).
  let inFlight: Promise<SyncResult> | null = null;
  let lastOk = 0;
  const doSync = async (): Promise<SyncResult> => {
    try {
      const r = await call<{ imported: number; more: boolean }>({ action: 'sync' });
      lastOk = Date.now();
      return { ...r, connected: true };
    } catch (e) {
      const status = (e as { context?: { status?: number } }).context?.status;
      if (status === 409) return { imported: 0, more: false, connected: false };
      throw e;
    }
  };

  return {
    status: () => call({ action: 'status' }),
    connect: async (code) => { await call({ action: 'connect', code }); lastOk = 0; },
    sync: () => {
      if (inFlight) return inFlight;
      if (Date.now() - lastOk < COOLDOWN_MS) return Promise.resolve({ imported: 0, more: false, connected: true });
      inFlight = doSync().finally(() => { inFlight = null; });
      return inFlight;
    },
    disconnect: async () => { await call({ action: 'disconnect' }); lastOk = 0; },
  };
}

export const stravaClientId = (import.meta.env.VITE_STRAVA_CLIENT_ID as string | undefined) || null;
export const redirectUri = () => `${location.origin}${import.meta.env.BASE_URL}`;

/** Apre la pagina di Strava per autorizzare l'app. */
export function startConnect(clientId: string): void {
  const state = crypto.randomUUID();
  try { sessionStorage.setItem(STATE_KEY, state); } catch { /* senza storage il ritorno verrà rifiutato */ }
  location.assign(authorizeUrl(clientId, redirectUri(), state));
}

export function takeSavedState(): string | null {
  try {
    const s = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    return s;
  } catch { return null; }
}

export const StravaContext = createContext<StravaApi | null>(null);
export const useStrava = () => useContext(StravaContext);
