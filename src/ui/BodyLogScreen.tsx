import { useState } from 'react';
import type { BodyLog } from '../domain/types';
import { parseKg } from '../domain/progression';
import { formatNumber } from '../domain/format';
import { todayLocal } from '../domain/dates';
import { useEngine, useRows } from '../data/store';

const FIELDS = [
  ['weightKg', 'Peso (kg)'], ['waistCm', 'Vita (cm)'], ['chestCm', 'Petto (cm)'], ['armCm', 'Braccio (cm)'], ['thighCm', 'Coscia (cm)'],
] as const;
type Field = (typeof FIELDS)[number][0];

export function BodyLogScreen() {
  const engine = useEngine();
  const logs = useRows<BodyLog>('body_logs');
  const [values, setValues] = useState<Record<Field, string>>({ weightKg: '', waistCm: '', chestCm: '', armCm: '', thighCm: '' });
  const [msg, setMsg] = useState('');

  const save = () => {
    const weightKg = parseKg(values.weightKg);
    if (weightKg == null) { setMsg('Scrivi almeno il peso'); return; }
    const row: Omit<BodyLog, 'updatedAt'> = {
      date: todayLocal(), weightKg, waistCm: parseKg(values.waistCm), chestCm: parseKg(values.chestCm),
      armCm: parseKg(values.armCm), thighCm: parseKg(values.thighCm),
    };
    void engine.write('body_logs', row);
    setMsg('Misure salvate');
  };

  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <section className="stack">
      <h2>Misure di oggi</h2>
      <div className="fields">
        {FIELDS.map(([k, label]) => (
          <label key={k}>{label}
            <input inputMode="decimal" value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <button className="btn" onClick={save}>Salva misure</button>
      {msg && <p className="muted">{msg}</p>}
      {recent.length > 0 && (
        <ul className="card plain">
          {recent.map((l) => (
            <li key={l.date}>{l.date}: {l.weightKg != null ? `${formatNumber(l.weightKg)} kg` : '—'}{l.waistCm != null ? ` · vita ${formatNumber(l.waistCm)} cm` : ''}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
