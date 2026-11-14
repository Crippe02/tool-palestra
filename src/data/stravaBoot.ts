import { readCallback, type StravaApi } from './strava';

const ERRORS = {
  denied: 'Collegamento a Strava annullato.',
  state: 'Collegamento a Strava non riuscito: riprova dal pulsante "Collega Strava".',
  scope: 'Per leggere le corse serve autorizzare "Visualizza i dati delle tue attività". Riprova e lascia la casella spuntata.',
  failed: 'Collegamento a Strava non riuscito: riprova tra poco.',
} as const;

/**
 * Gestisce il ritorno da Strava dopo "Collega Strava": collega e restituisce il messaggio da mostrare.
 * null se l'indirizzo non è un ritorno da Strava.
 */
export async function processStravaReturn(search: string, savedState: string | null, api: StravaApi): Promise<string | null> {
  const res = readCallback(search, savedState);
  if (!res) return null;
  if ('error' in res) return ERRORS[res.error];
  try {
    await api.connect(res.code);
    return 'Strava collegato: arrivano le corse degli ultimi 3 mesi.';
  } catch {
    return ERRORS.failed;
  }
}
