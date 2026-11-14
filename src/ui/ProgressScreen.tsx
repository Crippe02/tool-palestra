import { useState } from 'react';
import type { BodyLog, Exercise, RunLog, SetLog } from '../domain/types';
import { WEEKS_PER_CYCLE } from '../domain/types';
import { buildDashboard, seriesFor, type DashboardRow } from '../domain/dashboard';
import { formatNumber, formatPace, formatTime } from '../domain/format';
import { useProfile, useRows } from '../data/store';
import { HistoryChart } from './HistoryChart';

const SECTIONS: { id: DashboardRow['section']; title: string }[] = [
  { id: 'corpo', title: 'Corpo' }, { id: 'forza', title: 'Forza' }, { id: 'corsa', title: 'Corsa' },
];

function formatterFor(key: string): (y: number) => string {
  if (key === 'corsa:distanza') return (y) => `${formatNumber(y, 1)} km`;
  if (key === 'corsa:passo') return formatPace;
  if (key.startsWith('corsa:')) return formatTime;
  if (key === 'corpo:weightKg' || key.startsWith('forza:')) return (y) => `${formatNumber(y, 2)} kg`;
  return (y) => `${formatNumber(y)} cm`;
}

export function ProgressScreen({ onSetup }: { onSetup: () => void }) {
  const profile = useProfile();
  const input = {
    baseline: profile.baseline,
    bodyLogs: useRows<BodyLog>('body_logs'),
    setLogs: useRows<SetLog>('set_logs'),
    exercises: useRows<Exercise>('exercises'),
    runLogs: useRows<RunLog>('run_logs'),
  };
  const rows = buildDashboard(input);
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <section className="stack">
      <div className="progress-head">
        <h2>Da dove sei partito → oggi</h2>
        <span className="muted">Settimana {profile.currentWeek}/{WEEKS_PER_CYCLE}</span>
      </div>

      {!profile.baseline && (
        <div className="card stack">
          <p>Imposta il punto di partenza (peso e misure) per vedere quanto stai cambiando.</p>
          <button className="btn" onClick={onSetup}>Imposta il punto di partenza</button>
        </div>
      )}

      {SECTIONS.map(({ id, title }) => {
        const list = rows.filter((r) => r.section === id);
        if (list.length === 0) return null;
        return (
          <div key={id} className="card stack">
            <h3>{title}</h3>
            {list.map((r) => (
              <div key={r.key}>
                <button className="dash-row" aria-expanded={openKey === r.key} onClick={() => setOpenKey(openKey === r.key ? null : r.key)}>
                  <span className="dash-label">{r.label}</span>
                  <span className="dash-values">{r.from} → {r.to}</span>
                  <span className={`dash-change ${r.good === true ? 'up' : r.good === false ? 'down' : ''}`}>{r.change}</span>
                </button>
                {openKey === r.key && <HistoryChart title={r.label} points={seriesFor(r.key, input)} format={formatterFor(r.key)} />}
              </div>
            ))}
          </div>
        );
      })}

      {profile.baseline && rows.length === 0 && <p className="muted">Segna allenamenti, misure e corse: qui vedrai i progressi.</p>}
    </section>
  );
}
