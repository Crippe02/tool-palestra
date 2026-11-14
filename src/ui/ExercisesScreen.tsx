import { useState } from 'react';
import type { Exercise, ExerciseKind, GymDay } from '../domain/types';
import { DAY_LABELS, parseScheme } from '../domain/program';
import { parseKg } from '../domain/progression';
import { formatNumber } from '../domain/format';
import { useEngine, useRows } from '../data/store';

const DAYS: GymDay[] = ['push', 'pull', 'legs', 'upper', 'lower'];
const schemeText = (e: Exercise) => `${e.sets}×${e.repMin === e.repMax ? e.repMin : `${e.repMin}-${e.repMax}`}`;
const SCHEME_ERROR = 'Scrivi lo schema come 3×8-10 (serie × ripetizioni)';

function tryScheme(s: string) {
  try { return parseScheme(s); } catch { return null; }
}

function slug(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'ex';
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}${i}`;
  return id;
}

function ExerciseRow({ ex, onSave, onMove }: { ex: Exercise; onSave: (e: Exercise) => void; onMove: (dir: -1 | 1) => void }) {
  const [name, setName] = useState(ex.name);
  const [scheme, setScheme] = useState(schemeText(ex));
  const [startKg, setStartKg] = useState(ex.startKg != null ? formatNumber(ex.startKg, 2) : '');
  const [kind, setKind] = useState<ExerciseKind>(ex.kind);
  const [error, setError] = useState('');

  const save = () => {
    const s = tryScheme(scheme);
    if (!s) { setError(SCHEME_ERROR); return; }
    if (!name.trim()) { setError('Il nome non può essere vuoto'); return; }
    setError('');
    onSave({ ...ex, name: name.trim(), ...s, startKg: parseKg(startKg), kind });
  };

  return (
    <fieldset className="card stack ex-edit" aria-label={ex.name} disabled={false}>
      <div className="fields">
        <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Schema<input value={scheme} onChange={(e) => setScheme(e.target.value)} /></label>
        <label>Carico iniziale (kg)<input inputMode="decimal" value={startKg} onChange={(e) => setStartKg(e.target.value)} /></label>
        <label>Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
            <option value="compound">Multiarticolare</option>
            <option value="isolation">Isolamento</option>
          </select>
        </label>
      </div>
      {error && <p className="down">{error}</p>}
      <div className="row-actions">
        <button type="button" className="btn" onClick={save}>Salva</button>
        <button type="button" className="btn secondary" onClick={() => onSave({ ...ex, active: !ex.active })}>{ex.active ? 'Disattiva' : 'Riattiva'}</button>
        <button type="button" className="btn secondary" aria-label="Sposta su" onClick={() => onMove(-1)}>↑</button>
        <button type="button" className="btn secondary" aria-label="Sposta giù" onClick={() => onMove(1)}>↓</button>
      </div>
    </fieldset>
  );
}

export function ExercisesScreen() {
  const engine = useEngine();
  const all = useRows<Exercise>('exercises');
  const [day, setDay] = useState<GymDay>('push');
  const [newName, setNewName] = useState('');
  const [newScheme, setNewScheme] = useState('');
  const [newError, setNewError] = useState('');

  const list = all.filter((e) => e.day === day).sort((a, b) => Number(b.active) - Number(a.active) || a.position - b.position);
  const save = (e: Exercise) => void engine.write('exercises', e);

  const move = (ex: Exercise, dir: -1 | 1) => {
    const active = list.filter((e) => e.active);
    const i = active.findIndex((e) => e.id === ex.id);
    const other = active[i + dir];
    if (!other) return;
    save({ ...ex, position: other.position });
    save({ ...other, position: ex.position });
  };

  const add = () => {
    const s = tryScheme(newScheme);
    if (!newName.trim()) { setNewError('Scrivi il nome'); return; }
    if (!s) { setNewError(SCHEME_ERROR); return; }
    const sameDay = all.filter((e) => e.day === day);
    const ex: Exercise = {
      day, id: slug(newName, new Set(sameDay.map((e) => e.id))), name: newName.trim(), ...s, startKg: null, kind: 'isolation',
      position: Math.max(-1, ...sameDay.map((e) => e.position)) + 1, active: true, isNew: true, updatedAt: '',
    };
    save(ex);
    setNewName(''); setNewScheme(''); setNewError('');
  };

  return (
    <section className="stack">
      <h2>Esercizi</h2>
      <label>Giorno
        <select value={day} onChange={(e) => setDay(e.target.value as GymDay)}>
          {DAYS.map((d) => <option key={d} value={d}>{DAY_LABELS[d].title}</option>)}
        </select>
      </label>
      {list.map((ex) => <ExerciseRow key={`${ex.day}-${ex.id}-${ex.updatedAt}`} ex={ex} onSave={save} onMove={(dir) => move(ex, dir)} />)}
      <div className="card stack">
        <div className="fields">
          <label>Nuovo esercizio<input value={newName} onChange={(e) => setNewName(e.target.value)} /></label>
          <label>Schema del nuovo esercizio<input value={newScheme} placeholder="3×10-12" onChange={(e) => setNewScheme(e.target.value)} /></label>
        </div>
        {newError && <p className="down">{newError}</p>}
        <button className="btn" onClick={add}>Aggiungi esercizio</button>
      </div>
    </section>
  );
}
