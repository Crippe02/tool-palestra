import { TABLES } from '../data/localStore';
import { useEngine } from '../data/store';
import { todayLocal } from '../domain/dates';

export function BackupButton() {
  const engine = useEngine();
  const exportBackup = () => {
    const data = Object.fromEntries(TABLES.map((t) => [t, engine.rows(t)]));
    const blob = new Blob([JSON.stringify({ app: 'tool-palestra', exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tool-palestra-backup-${todayLocal()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="stack">
      <h2>Backup</h2>
      <p className="muted">Scarica una copia di tutti i tuoi dati in un file.</p>
      <button className="btn secondary" onClick={exportBackup}>Esporta backup</button>
    </section>
  );
}
