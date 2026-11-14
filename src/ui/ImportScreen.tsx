import { useState } from 'react';
import type { SetLog } from '../domain/types';
import { ImportError, mergeImport, parseOldScheda } from '../domain/importScheda';
import { useEngine, useProfile, useProfileReady, useRows } from '../data/store';

export function ImportScreen() {
  const engine = useEngine();
  const profile = useProfile();
  const ready = useProfileReady();
  const existing = useRows<SetLog>('set_logs');
  const [text, setText] = useState('');
  const [done, setDone] = useState('');

  let parsed: ReturnType<typeof parseOldScheda> | null = null;
  let error = '';
  if (text.trim()) {
    try { parsed = parseOldScheda(text, new Date().toISOString()); }
    catch (e) { error = e instanceof ImportError ? e.message : 'Errore nella lettura dei dati'; }
  }

  const doImport = async () => {
    if (!parsed) return;
    const rows = mergeImport(existing, parsed.logs);
    for (const r of rows) await engine.write('set_logs', r);
    await engine.write('profile', { ...profile, currentWeek: parsed.week });
    setDone(`Importate ${rows.length} voci. Riprendi dalla settimana ${parsed.week}.`);
    setText('');
  };

  return (
    <section className="stack">
      <h2>Importa dalla vecchia scheda</h2>
      <p className="muted">Nella vecchia scheda tocca “Copia i dati per la nuova app”, poi incolla qui.</p>
      <label>Dati copiati dalla scheda
        <textarea rows={5} value={text} onChange={(e) => { setText(e.target.value); setDone(''); }} />
      </label>
      {error && <p className="down">{error}</p>}
      {parsed && (
        <>
          <p>Voci trovate: {parsed.logs.length} · settimana {parsed.week}</p>
          <button className="btn" disabled={!ready} onClick={() => void doImport()}>Importa</button>
          {!ready && <p className="muted">Aspetta che i dati siano scaricati.</p>}
        </>
      )}
      {done && <p className="up">{done}</p>}
    </section>
  );
}
