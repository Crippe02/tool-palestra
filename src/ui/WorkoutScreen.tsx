import { useState } from 'react';
import type { Exercise, GymDay, SetLog } from '../domain/types';
import { WEEKS_PER_CYCLE } from '../domain/types';
import { DAY_LABELS } from '../domain/program';
import { useEngine, useProfile, useProfileReady, useRows } from '../data/store';
import { ExerciseCard, type SetPatch } from './ExerciseCard';

const DAYS: GymDay[] = ['push', 'pull', 'legs', 'upper'];

export function WorkoutScreen({ onRun }: { onRun: () => void }) {
  const engine = useEngine();
  const profile = useProfile();
  const ready = useProfileReady();
  const exercises = useRows<Exercise>('exercises');
  const logs = useRows<SetLog>('set_logs');
  const [day, setDay] = useState<GymDay>('push');
  const [askNewCycle, setAskNewCycle] = useState(false);
  const { currentCycle: cycle, currentWeek: week } = profile;

  const setWeek = (w: number, c = cycle) => {
    setAskNewCycle(false);
    if (!ready) return; // prima del primo scaricamento si cancellerebbe il profilo online
    void engine.write('profile', { ...profile, currentCycle: c, currentWeek: w });
  };
  const next = () => (week >= WEEKS_PER_CYCLE ? setAskNewCycle(true) : setWeek(week + 1));

  // Unisce la modifica alla riga salvata più recente: un campo non sovrascrive mai l'altro.
  const save = (ex: Exercise, patch: SetPatch) => {
    const stored = engine.rows<SetLog>('set_logs').find((l) => l.day === ex.day && l.exerciseId === ex.id && l.cycle === cycle && l.week === week);
    const base = { day: ex.day, exerciseId: ex.id, cycle, week, kg: stored?.kg ?? null, reps: stored?.reps ?? '' };
    void engine.write('set_logs', { ...base, ...patch });
  };

  const list = exercises.filter((e) => e.day === day && e.active).sort((a, b) => a.position - b.position);

  return (
    <section className="stack">
      <div className="tabs" role="tablist">
        {DAYS.map((d, i) => (
          <button key={d} role="tab" className="tab" aria-selected={d === day} onClick={() => setDay(d)}>
            <small>G{i + 1}</small>{DAY_LABELS[d].title}
          </button>
        ))}
        <button role="tab" className="tab" aria-selected={false} onClick={onRun}><small>G5</small>Corsa</button>
      </div>

      <div className="weekbar">
        <button aria-label="Settimana precedente" disabled={!ready || week <= 1} onClick={() => setWeek(week - 1)}>‹</button>
        <div className="weeklabel">Settimana {week}<span>di {WEEKS_PER_CYCLE}{cycle > 1 ? ` · ciclo ${cycle}` : ''}</span></div>
        <button aria-label="Settimana successiva" disabled={!ready} onClick={next}>›</button>
      </div>

      {askNewCycle && (
        <div className="card stack">
          <p>Hai finito le {WEEKS_PER_CYCLE} settimane. Inizia un nuovo ciclo: cambia angoli o varianti degli esercizi.</p>
          <button className="btn" onClick={() => setWeek(1, cycle + 1)}>Inizia il ciclo {cycle + 1}</button>
        </div>
      )}

      <div>
        <h2 className="day-title">{DAY_LABELS[day].title}</h2>
        <p className="muted day-focus">{DAY_LABELS[day].focus}</p>
      </div>

      <div className="stack">
        {list.map((ex) => (
          <ExerciseCard key={`${ex.day}-${ex.id}-${cycle}-${week}`} ex={ex} logs={logs} cycle={cycle} week={week}
            onSave={(patch) => save(ex, patch)} />
        ))}
      </div>

      <aside className="card notes">
        <h3>Regole</h3>
        <ul>
          <li>1-2 RIR sui multiarticolari, 0-1 RIR sugli isolamenti.</li>
          <li>Ogni settimana aggiungi un po' di carico o una ripetizione. Verde = salito, rosso = sceso.</li>
          <li>Se non recuperi, togli 1 serie dagli isolamenti, mai dai multiarticolari.</li>
          <li>Cambia angoli o varianti ogni 4-6 settimane.</li>
        </ul>
      </aside>
    </section>
  );
}
