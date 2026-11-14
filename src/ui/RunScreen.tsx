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
        setState('syncing');
        const { connected } = await strava.sync();
        if (!alive) return;
        if (!connected) { setState('off'); return; }
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

type Step = 'km' | 'tempo' | 'feeling' | '5k' | 'fatto';

/** "Ho corso": domande una alla volta, poi la corsa è salvata. */
function RunWizard({ suggestedKm, today, onClose, nextText }: { suggestedKm: number; today: string; onClose: () => void; nextText: string }) {
  const engine = useEngine();
  const [step, setStep] = useState<Step>('km');
  const [date, setDate] = useState(today);
  const [km, setKm] = useState(formatNumber(suggestedKm));
  const [time, setTime] = useState('');
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [five, setFive] = useState('');
  const [error, setError] = useState('');

  const kmN = parseKg(km);
  const timeS = parseDuration(time);
  const go = (s: Step) => { setError(''); setStep(s); };

  const save = (fiveS: number | null, f: Feeling) => {
    const row: Omit<RunLog, 'updatedAt'> = {
      id: crypto.randomUUID(), date, type: 'corsa', distanceKm: kmN!, durationS: timeS!, source: 'manual', externalId: null,
      startTime: null, feeling: f, best5kS: fiveS, best10kS: null, hidden: false,
    };
    void engine.write('run_logs', row);
    go('fatto');
  };

  const afterKm = () => (kmN == null || kmN <= 0 ? setError('Scrivi i km, per esempio 5 o 7,5') : go('tempo'));
  const afterTime = () => (timeS == null || timeS <= 0 ? setError('Scrivi il tempo come 27:40') : go('feeling'));
  const afterFeeling = (f: Feeling) => { setFeeling(f); if (kmN! >= 5) go('5k'); else save(null, f); };
  const afterFive = () => {
    const s = parseDuration(five);
    if (s == null || s <= 0) { setError('Scrivi il tempo come 27:40, oppure tocca Salta'); return; }
    if (s >= timeS!) { setError('Il tempo ai 5 km deve essere minore del tempo totale'); return; }
    save(s, feeling!);
  };

  const n = kmN != null && kmN >= 5 ? 4 : 3;
  return (
    <div className="card stack wizard">
      {step === 'km' && (
        <>
          <p className="muted eyebrow">1/{n}</p>
          <label>Quanti km hai fatto?<input inputMode="decimal" autoFocus value={km} onChange={(e) => setKm(e.target.value)} /></label>
          <label>Quando<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </>
      )}
      {step === 'tempo' && (
        <>
          <p className="muted eyebrow">2/{n}</p>
          <label>In quanto tempo?<input inputMode="numeric" autoFocus placeholder="27:40" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </>
      )}
      {step === 'feeling' && (
        <>
          <p className="muted eyebrow">3/{n}</p>
          <p className="question">Com'è andata?</p>
          <div className="row-actions">
            {FEELINGS.map((f) => <button key={f} className="btn secondary" onClick={() => afterFeeling(f)}>{f}</button>)}
          </div>
        </>
      )}
      {step === '5k' && (
        <>
          <p className="muted eyebrow">4/4</p>
          <label>Tempo ai primi 5 km?<input inputMode="numeric" autoFocus placeholder="29:40" value={five} onChange={(e) => setFive(e.target.value)} /></label>
          <p className="muted small">Lo trovi nell'app con cui registri la corsa. Se non lo sai, salta.</p>
        </>
      )}
      {step === 'fatto' && <p className="question">Fatto! Prossima corsa: {nextText}</p>}

      {error && <p className="down">{error}</p>}

      <div className="row-actions">
        {step === 'km' && <button className="btn" onClick={afterKm}>Avanti</button>}
        {step === 'tempo' && <button className="btn" onClick={afterTime}>Avanti</button>}
        {step === '5k' && <><button className="btn" onClick={afterFive}>Salva</button><button className="btn secondary" onClick={() => save(null, feeling!)}>Salta</button></>}
        {step === 'tempo' && <button className="btn secondary" onClick={() => go('km')}>Indietro</button>}
        {step === 'feeling' && <button className="btn secondary" onClick={() => go('tempo')}>Indietro</button>}
        {step === '5k' && <button className="btn secondary" onClick={() => go('feeling')}>Indietro</button>}
        <button className="btn secondary" onClick={onClose}>{step === 'fatto' ? 'Chiudi' : 'Annulla'}</button>
      </div>
    </div>
  );
}

function StravaBox({ clientId }: { clientId: string }) {
  const [state, disconnect] = useStravaState();
  if (state === 'checking') return null;
  if (state === 'off') {
    return (
      <div className="card stack">
        <p>Collega Strava e le tue corse arriveranno da sole.</p>
        <button className="btn" onClick={() => startConnect(clientId)}>Collega Strava</button>
        <p className="muted small">Meglio farlo dal PC: si fa una volta sola.</p>
      </div>
    );
  }
  return (
    <p className="muted small strava-line">
      {state === 'syncing' && 'Aggiorno da Strava…'}
      {state === 'on' && <>Strava collegato · <button className="link" onClick={() => void disconnect()}>Scollega</button></>}
      {state === 'error' && <>Non riesco a sentire Strava, riprovo dopo. · <button className="link" onClick={() => void disconnect()}>Scollega</button></>}
    </p>
  );
}

export function RunScreen({ today = todayLocal(), clientId = stravaClientId }: { today?: string; clientId?: string | null }) {
  const engine = useEngine();
  const runs = useRows<RunLog>('run_logs');
  const visible = visibleRuns(runs);
  const next = nextRun(runs, today);
  // Si chiede solo dell'ultima corsa: non di tutto lo storico importato.
  const latest = visible[visible.length - 1];
  const toRate = latest && !latest.feeling ? latest : undefined;
  const recent = [...visible].reverse().slice(0, 8);

  const [open, setOpen] = useState(false);

  const update = (r: RunLog, patch: Partial<RunLog>) => {
    const { updatedAt: _u, ...rest } = r;
    void engine.write('run_logs', { ...rest, ...patch });
  };

  return (
    <section className="stack">
      {clientId && <StravaBox clientId={clientId} />}

      {open
        ? <RunWizard suggestedKm={next.distanceKm} today={today} nextText={next.text} onClose={() => setOpen(false)} />
        : <button className="btn big" onClick={() => setOpen(true)}>Ho corso</button>}

      {toRate && !open && (
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

    </section>
  );
}
