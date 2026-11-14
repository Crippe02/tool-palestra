import { useState } from 'react';
import type { Baseline } from '../domain/types';
import { parseKg } from '../domain/progression';
import { formatNumber } from '../domain/format';
import { todayLocal } from '../domain/dates';
import { useEngine, useProfile, useProfileReady } from '../data/store';

const FIELDS = [
  ['weightKg', 'Peso (kg)'], ['waistCm', 'Vita (cm)'], ['chestCm', 'Petto (cm)'], ['armCm', 'Braccio (cm)'], ['thighCm', 'Coscia (cm)'],
] as const;
type Field = (typeof FIELDS)[number][0];

export function BaselineScreen() {
  const engine = useEngine();
  const profile = useProfile();
  const ready = useProfileReady();
  const b = profile.baseline;
  const [date, setDate] = useState(b?.date ?? todayLocal());
  const [values, setValues] = useState<Record<Field, string>>(() =>
    Object.fromEntries(FIELDS.map(([k]) => [k, b?.[k] != null ? formatNumber(b[k]!, 2) : ''])) as Record<Field, string>);
  const [msg, setMsg] = useState('');

  const save = () => {
    const baseline: Baseline = {
      date, weightKg: parseKg(values.weightKg), waistCm: parseKg(values.waistCm), chestCm: parseKg(values.chestCm),
      armCm: parseKg(values.armCm), thighCm: parseKg(values.thighCm),
    };
    void engine.write('profile', { ...profile, baseline });
    setMsg('Punto di partenza salvato');
  };

  return (
    <section className="stack">
      <h2>Punto di partenza</h2>
      <p className="muted">I carichi iniziali sono quelli degli esercizi; il primo test di corsa si fa dalla sezione Corsa.</p>
      <label>Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <div className="fields">
        {FIELDS.map(([k, label]) => (
          <label key={k}>{label}
            <input inputMode="decimal" value={values[k]} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <button className="btn" disabled={!ready} onClick={save}>Salva punto di partenza</button>
      {!ready && <p className="muted">Aspetta che i dati siano scaricati.</p>}
      {msg && <p className="up">{msg}</p>}
    </section>
  );
}
