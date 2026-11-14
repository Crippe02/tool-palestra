import { useState } from 'react';
import type { RunLog } from '../domain/types';
import { nextRunSession } from '../domain/running';
import { formatNumber, formatPace, formatTime, parseDuration } from '../domain/format';
import { parseKg } from '../domain/progression';
import { todayLocal } from '../domain/dates';
import { useEngine, useRows } from '../data/store';

const TYPE_LABEL: Record<RunLog['type'], string> = { test: 'Test', ripetute: 'Ripetute', ritmo: 'Ritmo', lungo: 'Lungo', corsa: 'Corsa' };

export function RunScreen({ today = todayLocal() }: { today?: string }) {
  const engine = useEngine();
  const runs = useRows<RunLog>('run_logs');
  const session = nextRunSession(runs, today);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [distance, setDistance] = useState(session.distanceKm != null ? String(session.distanceKm) : '');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    const km = parseKg(distance);
    const s = parseDuration(time);
    if (km == null || km <= 0) { setError('Scrivi la distanza in km, per esempio 5 o 7,5'); return; }
    if (s == null || s <= 0) { setError('Scrivi il tempo come 27:40'); return; }
    const row: Omit<RunLog, 'updatedAt'> = {
      id: crypto.randomUUID(), date, type: session.type, distanceKm: km, durationS: s, source: 'manual', externalId: null,
    };
    void engine.write('run_logs', row);
    setOpen(false); setTime(''); setError('');
  };

  const recent = [...runs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <section className="stack">
      <div className="card stack">
        <p className="muted eyebrow">Prossima corsa</p>
        <h2>{session.title}</h2>
        <ol className="steps">{session.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        {!open && <button className="btn" onClick={() => setOpen(true)}>Ho fatto questa corsa</button>}
        {open && (
          <div className="stack">
            <div className="fields">
              <label>Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <label>Distanza (km)<input inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} /></label>
              <label>Tempo<input inputMode="numeric" placeholder="27:40" value={time} onChange={(e) => setTime(e.target.value)} /></label>
            </div>
            {error && <p className="down">{error}</p>}
            <div className="row-actions">
              <button className="btn" onClick={save}>Salva corsa</button>
              <button className="btn secondary" onClick={() => { setOpen(false); setError(''); }}>Annulla</button>
            </div>
          </div>
        )}
      </div>
      {recent.length > 0 && (
        <div className="card">
          <h3>Ultime corse</h3>
          <ul className="plain">
            {recent.map((r) => (
              <li key={r.id}>
                {r.date} · {TYPE_LABEL[r.type]} · {formatNumber(r.distanceKm)} km in {formatTime(r.durationS)} ({formatPace(r.durationS / r.distanceKm)})
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="muted small">Presto le corse arriveranno da sole da Strava.</p>
    </section>
  );
}
