import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Accesso con email e password: funziona dentro l'app installata su iPhone
 * (un link via email si aprirebbe in Safari) e non dipende dalle email di Supabase.
 * Serve una volta sola: poi la sessione resta salvata.
 */
export function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMsg(/invalid/i.test(error.message) ? 'Email o password sbagliate.' : 'Non riesco ad accedere. Controlla la connessione e riprova.');
  }

  return (
    <div className="card login">
      <h2>Accedi</h2>
      <form onSubmit={signIn} className="stack">
        <label>Email<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn" disabled={busy}>Entra</button>
      </form>
      {msg && <p className="down">{msg}</p>}
    </div>
  );
}
