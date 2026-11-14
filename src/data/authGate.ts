/**
 * Offline il token scade dopo circa un'ora e Supabase restituisce sessione nulla.
 * Se su questo telefono si è già entrati, l'app si apre comunque con i dati locali:
 * il login serve solo la prima volta o dopo un'uscita esplicita.
 */
export function authView(s: { session: boolean | undefined; rememberedUser: string | null; signedOut: boolean }): 'loading' | 'login' | 'app' {
  if (s.session === true) return 'app';
  if (s.signedOut) return 'login';
  if (s.rememberedUser) return 'app';
  return s.session === undefined ? 'loading' : 'login';
}

const KEY = 'tool-palestra:user';

export function getRememberedUser(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function rememberUser(id: string): void {
  try { localStorage.setItem(KEY, id); } catch { /* storage non disponibile */ }
}
export function forgetUser(): void {
  try { localStorage.removeItem(KEY); } catch { /* storage non disponibile */ }
}
