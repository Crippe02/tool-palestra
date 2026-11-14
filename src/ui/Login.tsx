import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Accesso con codice via email: niente magic link, che su iPhone si aprirebbe fuori dall'app. */
export function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) setMsg('Non riesco a mandare il codice. Controlla l\'email e riprova.');
    else { setStep('code'); setMsg('Ti ho mandato un codice via email.'); }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMsg('Codice non valido o scaduto.');
  }

  return (
    <div className="card login">
      <h2>Accedi</h2>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="stack">
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn" disabled={busy}>Mandami il codice</button>
        </form>
      ) : (
        <form onSubmit={verify} className="stack">
          <label>Codice<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required value={code} onChange={(e) => setCode(e.target.value)} /></label>
          <button className="btn" disabled={busy}>Entra</button>
          <button type="button" className="btn secondary" onClick={() => setStep('email')}>Cambia email</button>
        </form>
      )}
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
