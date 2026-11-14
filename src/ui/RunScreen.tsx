import { useEffect, useState } from 'react';
import type { Feeling, RunLog } from '../domain/types';
import { nextRun, visibleRuns } from '../domain/runPlan';
import { formatNumber, formatPace, formatTime, parseDuration } from '../domain/format';
import { parseKg } from '../domain/progression';
import { todayLocal } from '../domain/dates';
import { useEngine, useRows } from '../data/store';
import { startConnect, stravaClientId, useStrava } from '../data/strava';

const FEELINGS: Feeling[] = ['facile', 'giusta', 'dura'];
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const runText = (r: RunLog) => `${formatNumber(r.distanceKm, 1)} km in ${formatTime(r.durationS)}`;

type StravaState = 'checking' | 'off' | 'on' | 'syncing' | 'error';

/** Collegamento a Strava e aggiornamento delle corse all'apertura della sezione. */
function useStravaState(): [StravaState, () => Promise<void>] {
  const strava = useStrava();
  const engine = useEngine();
  const [state, setState] = useState<StravaState>(strava ? 'checking' : 'off');
  useEffect(() => {
    if (!strava) return;
    let alive = true;
    (async () => {
      try {
        const { connected } = await strava.status();
        if (!alive) return;
        if (!connected) { setState('off'); return; }
        setState('syncing');
        await strava.sync();
        await engine.pull();
        if (alive) setState('on');
      } catch {
        if (alive) setState('error');
      }
    })();
    return () => { alive = false; };
  }, [strava, engine]);
  const disconnect = async () => {
    if (!strava) return;
    try { await strava.disconnect(); setState('off'); } catch { setState('error'); }
  };
  return [state, disconnect];
}

function StravaBox({ clientId }: { clientId: string | null }) {
  const [state, disconnect] = useStravaState();
  if (state === 'checking') return null;
  if (state === 'off') {
    return (
      <div className="card stack">
        <p>Collega Strava e le tue corse arriveranno da sole.</p>
        <button className="btn" disabled={!clientId} onClick={() => clientId && startConnect(clientId)}>Collega Strava</button>
        <p className="muted small">Meglio farlo dal PC: si fa una volta sola.</p>
      </div>
    );
  }
  return (
    <p className="muted small strava-line">
      {state === 'syncing' && 'Aggiorno da Strava…'}
      {state === 'on' && <>Strava collegato · <button className="link" onClick={() => void disconnect()}>Scollega</button></>}
      {state === 'error' && 'Non riesco a sentire Strava, riprovo dopo.'}
    </p>
  );
}

export function RunScreen({ today = todayLocal(), clientId = stravaClientId }: { today?: string; clientId?: string | null }) {
  const engine = useEngine();
  const runs = useRows<RunLog>('run_logs');
  const visible = visibleRuns(runs);
  const next = nextRun(runs, today);
  const toRate = [...visible].reverse().find((r) => !r.feeling);
  const recent = [...visible].reverse().slice(0, 8);

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [distance, setDistance] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');

  const update = (r: RunLog, patch: Partial<RunLog>) => {
    const { updatedAt: _u, ...rest } = r;
    void engine.write('run_logs', { ...rest, ...patch });
  };

  const save = () => {
    const km = parseKg(distance);
    const s = parseDuration(time);
    if (km == null || km <= 0) { setError('Scrivi la distanza in km, per esempio 5 o 7,5'); return; }
    if (s == null || s <= 0) { setError('Scrivi il tempo come 27:40'); return; }
    const row: Omit<RunLog, 'updatedAt'> = {
      id: crypto.randomUUID(), date, type: 'corsa', distanceKm: km, durationS: s, source: 'manual', externalId: null,
      startTime: null, feeling: null, best5kS: null, best10kS: null, hidden: false,
    };
    void engine.write('run_logs', row);
    setOpen(false); setTime(''); setDistance(''); setError('');
  };

  return (
    <section className="stack">
      <StravaBox clientId={clientId} />

      {toRate && (
        <div className="card stack rate">
          <p>Corsa del {shortDate(toRate.date)}: {runText(toRate)} — com'è andata?</p>
          <div className="row-actions">
            {FEELINGS.map((f) => <button key={f} className="btn secondary" onClick={() => update(toRate, { feeling: f })}>{f}</button>)}
          </div>
        </div>
      )}

      <div className="card stack">
        <p className="muted eyebrow">Prossima corsa</p>
        <h2 className="next-run">{next.text}</h2>
        {next.last && (
          <p className="muted small">
            L'ultima volta: {runText(next.last.run)}, {next.last.completed ? 'completata ✓' : 'non completata'}
          </p>
        )}
      </div>

      {recent.length > 0 && (
        <div className="card">
          <h3>Ultime corse</h3>
          <ul className="plain runs">
            {recent.map((r) => (
              <li key={r.id}>
                <div>
                  {shortDate(r.date)} · {runText(r)} ({formatPace(r.durationS / r.distanceKm)})
                  {r.source === 'strava' && <span className="tag"> strava</span>}
                </div>
                <div className="row-actions">
                  {FEELINGS.map((f) => (
                    <button key={f} className={`chip${r.feeling === f ? ' on' : ''}`} aria-pressed={r.feeling === f}
                      aria-label={`${f} (${shortDate(r.date)})`} onClick={() => update(r, { feeling: f })}>{f}</button>
                  ))}
                  <button className="link" aria-label={`Nascondi la corsa del ${shortDate(r.date)}`} onClick={() => update(r, { hidden: true })}>Nascondi</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!open && <button className="btn secondary" onClick={() => { setOpen(true); setDistance(String(next.distanceKm)); }}>Aggiungi una corsa a mano</button>}
      {open && (
        <div className="card stack">
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
    </section>
  );
}
