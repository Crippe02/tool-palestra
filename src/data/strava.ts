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

export interface StravaApi {
  status(): Promise<{ connected: boolean }>;
  connect(code: string): Promise<void>;
  sync(): Promise<{ imported: number; more: boolean }>;
  disconnect(): Promise<void>;
}

export function createStravaApi(client: SupabaseClient): StravaApi {
  const call = async <T>(body: Record<string, unknown>): Promise<T> => {
    const { data, error } = await client.functions.invoke('strava', { body });
    if (error) throw error;
    return data as T;
  };
  return {
    status: () => call({ action: 'status' }),
    connect: async (code) => { await call({ action: 'connect', code }); },
    sync: () => call({ action: 'sync' }),
    disconnect: async () => { await call({ action: 'disconnect' }); },
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
