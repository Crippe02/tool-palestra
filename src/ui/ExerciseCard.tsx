import { useEffect, useRef, useState } from 'react';
import type { Exercise, SetLog } from '../domain/types';
import { loadDelta, parseKg, previousLoad, suggestLoad } from '../domain/progression';
import { formatNumber } from '../domain/format';

const kgText = (n: number) => `${formatNumber(n, 2)} kg`;
const scheme = (e: Exercise) => `${e.sets}×${e.repMin === e.repMax ? e.repMin : `${e.repMin}-${e.repMax}`}`;
const kgField = (kg: number | null | undefined) => (kg != null ? formatNumber(kg, 2) : '');

export type SetPatch = { kg: number | null } | { reps: string };

export function ExerciseCard({ ex, logs, cycle, week, onSave }: {
  ex: Exercise; logs: SetLog[]; cycle: number; week: number;
  onSave: (patch: SetPatch) => void;
}) {
  const current = logs.find((l) => l.day === ex.day && l.exerciseId === ex.id && l.cycle === cycle && l.week === week);
  const [kg, setKg] = useState(kgField(current?.kg));
  const [reps, setReps] = useState(current?.reps ?? '');
  const kgRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);

  // Se il valore salvato cambia (dati arrivati dal server o da un altro dispositivo)
  // e l'utente non sta scrivendo in quel campo, il campo si aggiorna.
  useEffect(() => {
    if (document.activeElement !== kgRef.current && parseKg(kg) !== (current?.kg ?? null)) setKg(kgField(current?.kg));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.kg]);
  useEffect(() => {
    if (document.activeElement !== repsRef.current && reps.trim() !== (current?.reps ?? '')) setReps(current?.reps ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.reps]);

  const prev = previousLoad(logs, ex, cycle, week);
  const tip = suggestLoad(ex, logs, cycle, week);
  const delta = loadDelta(parseKg(kg), prev);
  const id = `${ex.day}-${ex.id}`;

  return (
    <article className="ex card" aria-label={ex.name}>
      <div className="ex-name">{ex.name}{ex.isNew && <span className="tag"> nuovo</span>}</div>
      <div className="ex-scheme">{scheme(ex)}</div>
      <div className="ex-ref">
        {prev ? <span>Precedente ({prev.source}): <b>{kgText(prev.kg)}</b></span> : <span>Nessun carico precedente</span>}
        {delta != null && (delta > 0 ? <span className="up">+{formatNumber(delta, 2)} kg</span>
          : delta < 0 ? <span className="down">−{formatNumber(-delta, 2)} kg</span> : <span>= stesso carico</span>)}
      </div>
      <div className="ex-tip">{tip.kg != null ? <><b>Oggi: {kgText(tip.kg)}</b> — {tip.reason}</> : tip.reason}</div>
      <div className="fields">
        <label htmlFor={`${id}-kg`}>Carico (kg)
          <input ref={kgRef} id={`${id}-kg`} inputMode="decimal" value={kg} placeholder={tip.kg != null ? formatNumber(tip.kg, 2) : '—'}
            onChange={(e) => { setKg(e.target.value); onSave({ kg: parseKg(e.target.value) }); }} />
        </label>
        <label htmlFor={`${id}-reps`}>Ripetizioni
          <input ref={repsRef} id={`${id}-reps`} inputMode="text" value={reps} placeholder="es. 8,8,7"
            onChange={(e) => { setReps(e.target.value); onSave({ reps: e.target.value.trim() }); }} />
        </label>
      </div>
    </article>
  );
}
